from llm_provider import get_llm_provider, log_llm_call
from database import get_db
import uuid

def generate_lead_opener(lead_id: str, actor_id: str) -> dict:
    """
    Agent B: Generate first-contact WhatsApp draft for a lead.
    HARD RULE: Lead PII → MUST use OllamaProvider (local), never Groq.
    Draft goes to outbox_message as status=draft for human approval.
    """
    with get_db() as conn:
        cur = conn.cursor()
        
        # Get lead info (contains PII)
        cur.execute(
            "SELECT name, phone, course_interest FROM lead WHERE id = %s",
            (lead_id,)
        )
        row = cur.fetchone()
        if not row:
            return {"error": "Lead not found"}
        
        lead_name, lead_phone, course_interest = row
        
        # HARD RULE: contains_pii=True forces OllamaProvider (local only)
        try:
            provider = get_llm_provider(contains_pii=True)
        except Exception as e:
            return {"error": f"Cannot connect to Ollama: {str(e)}. Is Ollama running? (ollama serve)"}
        
        system_prompt = """You are a friendly admissions assistant for We One Aviation, a DGCA-approved CPL ground-school institute in India.
Write a warm, professional first-contact WhatsApp message (max 3 sentences).
Acknowledge their interest, briefly mention our expertise, and invite them to discuss next steps.
Keep it conversational and respectful. Use Indian English."""
        
        prompt = f"""Lead name: {lead_name}
Course interest: {course_interest}

Write a first-contact WhatsApp message to introduce We One Aviation and invite them to discuss their CPL training."""
        
        try:
            draft_message = provider.generate(prompt, system_prompt)
        except Exception as e:
            return {"error": f"Error generating draft: {str(e)}"}
        
        # Insert draft into outbox for human review
        cur.execute(
            """INSERT INTO outbox_message (lead_id, type, body, status)
               VALUES (%s, %s, %s, %s::outbox_status_enum) RETURNING id""",
            (lead_id, 'opener', draft_message, 'draft')
        )
        outbox_id = cur.fetchone()[0]
        
        # Log the LLM call (includes lead_id for audit trail)
        log_llm_call(
            actor_id=actor_id,
            agent="lead_opener",
            prompt=prompt,
            response=draft_message,
            lead_id=lead_id,
            provider="ollama"
        )
        
        return {
            "outbox_id": str(outbox_id),
            "draft_message": draft_message,
            "lead_name": lead_name,
            "lead_phone": lead_phone
        }
