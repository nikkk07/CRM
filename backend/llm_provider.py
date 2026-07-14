import os
import json
import requests
from typing import Optional, Dict, Any
from database import get_db
import logging

logger = logging.getLogger(__name__)

class LLMProvider:
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        raise NotImplementedError
    
    def embed(self, text: str) -> list[float]:
        raise NotImplementedError

class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str, model: str, embedding_model: str):
        self.base_url = base_url
        self.model = model
        self.embedding_model = embedding_model
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        response = requests.post(
            f"{self.base_url}/api/chat",
            json={"model": self.model, "messages": messages, "stream": False},
            timeout=60
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    
    def embed(self, text: str) -> list[float]:
        response = requests.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.embedding_model, "prompt": text},
            timeout=30
        )
        response.raise_for_status()
        return response.json()["embedding"]

class GroqProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "llama-3.3-70b-versatile"
        self.base_url = "https://api.groq.com/openai/v1"
    
    def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={"model": self.model, "messages": messages, "temperature": 0.7, "max_tokens": 1024},
                timeout=30
            )
            
            if response.status_code == 429:
                logger.warning("Groq rate limit hit (429), backing off")
                return "[Rate limit exceeded. Please try again in a moment.]"
            
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except requests.exceptions.Timeout:
            logger.error("Groq request timeout")
            return "[Request timeout. Please try again.]"
        except Exception as e:
            logger.error(f"Groq error: {e}")
            return f"[Error: {str(e)}]"
    
    def embed(self, text: str) -> list[float]:
        raise NotImplementedError("Groq does not support embeddings")

def get_llm_provider(contains_pii: bool) -> LLMProvider:
    """Route to appropriate provider based on PII content."""
    if contains_pii:
        # HARD RULE: Lead PII must use local Ollama only
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM config WHERE key = 'ollama_model'")
            row = cur.fetchone()
            model = row[0] if row else "llama3.2:3b-instruct-q4_K_M"
            if isinstance(model, str) and model.startswith('"'):
                model = model.strip('"')
            
            cur.execute("SELECT value FROM config WHERE key = 'embedding_model'")
            row = cur.fetchone()
            embedding_model = row[0] if row else "nomic-embed-text"
            if isinstance(embedding_model, str) and embedding_model.startswith('"'):
                embedding_model = embedding_model.strip('"')
        
        return OllamaProvider(ollama_url, model, embedding_model)
    else:
        # Public/non-PII can use Groq (free tier)
        groq_key = os.getenv("GROQ_API_KEY", "")
        if not groq_key or groq_key == "your-groq-api-key-here":
            logger.warning("GROQ_API_KEY not set, falling back to Ollama for non-PII")
            return get_llm_provider(contains_pii=True)
        return GroqProvider(groq_key)

def log_llm_call(actor_id: str, agent: str, prompt: str, response: str, lead_id: Optional[str] = None, provider: str = ""):
    """Log every LLM call to audit_log."""
    with get_db() as conn:
        cur = conn.cursor()
        payload = {
            "agent": agent,
            "provider": provider,
            "prompt": prompt[:500],  # truncate for storage
            "response": response[:1000],
            "lead_id": lead_id
        }
        cur.execute(
            "INSERT INTO audit_log (actor, action, entity, payload) VALUES (%s, %s, %s, %s)",
            (actor_id, "llm_call", agent, json.dumps(payload))
        )
