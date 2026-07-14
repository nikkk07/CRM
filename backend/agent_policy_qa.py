from llm_provider import get_llm_provider, log_llm_call
from database import get_db
import numpy as np

def policy_qa(question: str, actor_id: str) -> dict:
    """
    Agent A: DGCA/Policy Q&A using RAG over policy_doc table.
    Uses Groq (public docs only, no PII).
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM policy_doc WHERE embedding IS NOT NULL")
        doc_count = cur.fetchone()[0]
        
        if doc_count == 0:
            return {
                "answer": "No policy documents found. Please upload DGCA circulars or policy docs first.",
                "sources": []
            }
    
    # Get embedding for question using local Ollama (for embedding only)
    try:
        local_provider = get_llm_provider(contains_pii=True)
        question_embedding = local_provider.embed(question)
    except Exception as e:
        return {
            "answer": f"Error generating embedding: {str(e)}. Is Ollama running? (ollama serve)",
            "sources": []
        }
    
    # Find top 3 relevant docs via pgvector similarity search
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, content, 1 - (embedding <=> %s::vector) as similarity
            FROM policy_doc
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> %s::vector
            LIMIT 3
        """, (question_embedding, question_embedding))
        
        docs = []
        for row in cur.fetchall():
            docs.append({
                "id": str(row[0]),
                "title": row[1],
                "content": row[2],
                "similarity": float(row[3])
            })
    
    if not docs:
        return {
            "answer": "No policy documents found. Please upload DGCA circulars or policy docs first.",
            "sources": []
        }
    
    # Build context from top docs
    context = "\n\n".join([f"Document: {d['title']}\n{d['content']}" for d in docs])
    
    # Generate answer using Groq (public docs, no PII)
    provider = get_llm_provider(contains_pii=False)
    
    system_prompt = """You are a DGCA policy expert for We One Aviation, a CPL ground-school institute.
Answer questions based ONLY on the provided policy documents.
Always cite which document you're referencing.
If the answer isn't in the docs, say so."""
    
    prompt = f"""Context documents:
{context}

Question: {question}

Provide a clear answer and cite the document title(s) you used."""
    
    try:
        answer = provider.generate(prompt, system_prompt)
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"
    
    # Log the LLM call
    log_llm_call(
        actor_id=actor_id,
        agent="policy_qa",
        prompt=prompt,
        response=answer,
        provider="groq" if type(provider).__name__ == "GroqProvider" else "ollama"
    )
    
    return {
        "answer": answer,
        "sources": [{"id": d["id"], "title": d["title"], "similarity": d["similarity"]} for d in docs]
    }
