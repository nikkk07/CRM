import re
from database import get_db

def normalize_phone(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('91') and len(digits) == 12:
        return f'+{digits}'
    elif len(digits) == 10:
        return f'+91{digits}'
    return f'+{digits}'

def ingest_lead(data: dict) -> dict:
    phone_normalized = normalize_phone(data.get('phone', ''))
    
    with get_db() as conn:
        cur = conn.cursor()
        
        cur.execute("SELECT id FROM lead WHERE dedup_key = %s", (phone_normalized,))
        existing = cur.fetchone()
        if existing:
            return {"status": "duplicate", "lead_id": str(existing[0])}
        
        cur.execute(
            """INSERT INTO lead (name, phone, email, address, course_interest, utm_source, utm_medium, utm_campaign, status, dedup_key)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (
                data.get('name'),
                data.get('phone'),
                data.get('email'),
                data.get('address'),
                data.get('course_interest'),
                data.get('utm_source'),
                data.get('utm_medium'),
                data.get('utm_campaign'),
                'new',
                phone_normalized
            )
        )
        lead_id = cur.fetchone()[0]
        
        cur.execute(
            """INSERT INTO audit_log (action, entity, payload)
               VALUES (%s, %s, %s)""",
            ('create', 'lead', f'{{"lead_id": "{lead_id}", "source": "website"}}')
        )
        
    return {"status": "created", "lead_id": str(lead_id)}
