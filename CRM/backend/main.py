from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from database import get_db
from auth import authenticate_employee, create_access_token, get_current_employee, hash_password
from schemas import LoginRequest, TokenResponse, EmployeeCreate
from lead_ingestion import ingest_lead, normalize_phone
import r2_storage
import io
from sla_monitor import start_sla_monitor
from quote_generator import generate_quote_pdf
from encryption import encrypt_value, decrypt_value
from mongo_bridge import start_mongo_bridge
import json
from datetime import datetime
import logging
import os
import uuid

load_dotenv()
logging.basicConfig(level=logging.INFO)

scheduler = None
mongo_scheduler = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler, mongo_scheduler
    scheduler = start_sla_monitor()
    mongo_scheduler = start_mongo_bridge()
    yield
    if scheduler:
        scheduler.shutdown()
    if mongo_scheduler:
        mongo_scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://crm-three-smoky-26.vercel.app",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

@app.get("/health")
async def health_check():
    """Health endpoint for uptime monitoring - no auth, no DB query"""
    return {"status": "ok"}

@app.post("/api/seed-admin")
async def seed_admin():
    """One-off endpoint to create initial admin user in empty DB"""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM employee WHERE department = 'Admin'")
        if cur.fetchone()[0] > 0:
            raise HTTPException(status_code=400, detail="Admin already exists")
        
        hashed = hash_password("admin")
        cur.execute("""
            INSERT INTO employee (
                id, name, phone, email, department,
                password_hash, date_of_joining, is_active, login_id
            ) VALUES (
                'EMP001', 'Admin', '+919999999999', 'admin@weoneaviation.in',
                'Admin', %s, CURRENT_DATE, true, 'admin'
            )
        """, (hashed,))
        conn.commit()
        return {"status": "admin created", "login_id": "admin", "password": "admin"}

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    emp = authenticate_employee(req.login_id, req.password)
    if not emp:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": emp["id"]})
    return TokenResponse(access_token=token, employee=emp)

@app.post("/api/auth/employee-login")
async def employee_login(data: dict):
    """Employee login using login_id and optional PIN."""
    login_id = data.get('login_id', '').strip()
    pin = data.get('pin', '').strip()
    
    if not login_id:
        raise HTTPException(status_code=400, detail="Login ID required")
    
    with get_db() as conn:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, employee_id, name, phone, email, 
                   login_pin, job_role, active, department
            FROM employee
            WHERE active = true AND LOWER(login_id) = LOWER(%s)
            LIMIT 1
        """, (login_id,))
        
        row = cur.fetchone()
        
        if not row:
            raise HTTPException(status_code=401, detail="Employee not found")
        
        emp_id, emp_employee_id, name, phone, email, login_pin, job_role, active, department = row
        
        if login_pin and login_pin != pin:
            raise HTTPException(status_code=401, detail="Invalid PIN")
        
        emp_data = {
            "id": str(emp_id),
            "employee_id": emp_employee_id,
            "name": name,
            "phone": phone,
            "email": email,
            "department": department,
            "job_role": job_role,
            "is_employee_session": True
        }
        
        token = create_access_token({"sub": str(emp_id), "is_employee": True})
        
        return {"access_token": token, "employee": emp_data}

@app.post("/api/auth/change-password")
async def change_password(data: dict, current_emp = Depends(get_current_employee)):
    """Allow any logged-in user to change their own password"""
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Old and new passwords required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    with get_db() as conn:
        cur = conn.cursor()
        
        # Verify old password
        cur.execute("SELECT password_hash FROM employee WHERE id = %s", (current_emp['id'],))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        from auth import verify_password, hash_password
        if not verify_password(old_password, row[0]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Update password
        new_hash = hash_password(new_password)
        cur.execute("UPDATE employee SET password_hash = %s WHERE id = %s", (new_hash, current_emp['id']))
        
        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp['id'], 'change_password', 'employee', json.dumps({"employee_id": current_emp['id']}))
        )
    
    return {"status": "success", "message": "Password changed successfully"}

@app.post("/api/auth/register")
async def register(req: EmployeeCreate, current_emp = Depends(get_current_employee)):
    # department is NOT NULL (migration 020) and enum-constrained; reject unknown values before insert
    if req.department not in ('Admin', 'IT', 'Sales', 'Instructors'):
        raise HTTPException(status_code=400, detail="department must be one of: Admin, IT, Sales, Instructors")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO employee (name, phone, email, department, permissions, password_hash)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (req.name, req.phone, req.email, req.department, json.dumps(req.permissions), hash_password(req.password))
        )
        emp_id = cur.fetchone()[0]
        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp["id"], "create", "employee", json.dumps({"employee_id": str(emp_id)}))
        )
    return {"id": str(emp_id)}

@app.get("/api/me")
async def me(current_emp = Depends(get_current_employee)):
    return current_emp

@app.post("/api/leads/ingest")
async def ingest_lead_endpoint(data: dict):
    result = ingest_lead(data)
    return result

@app.get("/api/leads")
async def get_leads(current_emp = Depends(get_current_employee)):
    # Access: Admin or Sales only
    if current_emp['department'] not in ['Admin', 'Sales']:
        raise HTTPException(status_code=403, detail="Lead access requires Admin or Sales department")
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT l.id, l.name, l.phone, l.email, l.address, l.course_interest,
                   l.utm_source, l.utm_medium, l.utm_campaign, l.status, l.assigned_to,
                   l.created_at, l.first_contacted_at, l.dedup_key, l.last_note,
                   COALESCE(l.parked, FALSE) as parked, COALESCE(l.closed, FALSE) as closed,
                   (SELECT COUNT(*) FROM contact_attempt WHERE lead_id = l.id AND disposition = 'Not reachable') as not_reachable_count,
                   EXTRACT(EPOCH FROM (NOW() - l.created_at))/60 as age_minutes,
                   l.closure_outcome, l.guardian_name, l.qualifications, l.is_eligible, l.nios_interested,
                   l.interest_track
            FROM lead l
            ORDER BY l.created_at DESC
        """)
        leads = []
        for r in cur.fetchall():
            leads.append({
                "id": str(r[0]), "name": r[1], "phone": r[2], "email": r[3], "address": r[4],
                "course_interest": r[5], "utm_source": r[6], "utm_medium": r[7], "utm_campaign": r[8],
                "status": r[9] or "new", "assigned_to": str(r[10]) if r[10] else None,
                "created_at": r[11].isoformat(), "first_contacted_at": r[12].isoformat() if r[12] else None,
                "dedup_key": r[13], "last_note": r[14], "parked": r[15], "closed": r[16],
                "not_reachable_count": r[17], "age_minutes": float(r[18]),
                "closure_outcome": r[19], "guardian_name": r[20], "qualifications": r[21] or [],
                "is_eligible": r[22], "nios_interested": r[23],
                "interest_track": r[24]
            })
    return leads

@app.post("/api/leads/{lead_id}/contact")
async def log_contact(lead_id: str, data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        
        # Get lead details
        cur.execute("""
            SELECT name, phone, email, course_interest, address 
            FROM lead WHERE id = %s
        """, (lead_id,))
        lead_row = cur.fetchone()
        
        if not lead_row:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        name, phone, email, course_interest, address = lead_row
        disposition = data.get('disposition')
        note = data.get('note')
        interest_track = data.get('interest_track')
        
        cur.execute(
            """INSERT INTO contact_attempt (lead_id, staff_id, channel, disposition, note, connected, attempted_at)
               VALUES (%s, %s, %s, %s, %s, %s, NOW()) RETURNING id""",
            (lead_id, current_emp["id"], data.get('channel', 'phone'), disposition, 
             note, disposition in ['Connected', 'Interested', 'Callback'])
        )
        attempt_id = cur.fetchone()[0]
        
        # Update status and note - status is single source of truth
        cur.execute("""
            UPDATE lead 
            SET first_contacted_at = COALESCE(first_contacted_at, NOW()), 
                status = %s, 
                last_note = %s 
            WHERE id = %s
        """, (disposition, note, lead_id))
        
        # Persist course track only for Interested leads (keeps course_interest untouched)
        if disposition == 'Interested' and interest_track:
            cur.execute("UPDATE lead SET interest_track = %s WHERE id = %s", (interest_track, lead_id))

        # Set flags based on disposition (don't overwrite status)
        if disposition == 'Not interested':
            cur.execute("UPDATE lead SET closed = TRUE WHERE id = %s", (lead_id,))
        
        if disposition == 'Not reachable':
            cur.execute(
                "SELECT COUNT(*) FROM contact_attempt WHERE lead_id = %s AND disposition = 'Not reachable'",
                (lead_id,)
            )
            not_reachable_count = cur.fetchone()[0]
            if not_reachable_count >= 3:
                cur.execute("UPDATE lead SET parked = TRUE WHERE id = %s", (lead_id,))
        
        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp["id"], "contact", "lead", json.dumps({"lead_id": lead_id, "disposition": disposition}))
        )
        
    return {"id": str(attempt_id)}

@app.post("/api/leads/{lead_id}/close")
async def close_lead(lead_id: str, data: dict, current_emp = Depends(get_current_employee)):
    if current_emp['department'] not in ['Admin', 'Sales']:
        raise HTTPException(status_code=403, detail="Lead access requires Admin or Sales department")

    outcome = data.get('closure_outcome')
    if outcome not in ('admission_completed', 'admission_aborted'):
        raise HTTPException(status_code=400, detail="closure_outcome must be admission_completed or admission_aborted")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM lead WHERE id = %s", (lead_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Lead not found")

        note = data.get('note')
        # status is the top-level state; closure_outcome is the sub-state
        cur.execute("""
            UPDATE lead
            SET status = 'closed', closed = TRUE, closure_outcome = %s,
                first_contacted_at = COALESCE(first_contacted_at, NOW()),
                last_note = COALESCE(%s, last_note)
            WHERE id = %s
        """, (outcome, note, lead_id))

        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp["id"], "close", "lead", json.dumps({"lead_id": lead_id, "closure_outcome": outcome}))
        )
    return {"status": "closed", "closure_outcome": outcome}

@app.post("/api/leads/query")
async def create_query(data: dict, current_emp = Depends(get_current_employee)):
    """Manual lead entry (Add Query). Reuses the normalized-phone dedup used by the Mongo bridge."""
    if current_emp['department'] not in ['Admin', 'Sales']:
        raise HTTPException(status_code=403, detail="Lead access requires Admin or Sales department")

    name = (data.get('name') or '').strip()
    raw_phone = (data.get('phone') or '').strip()
    course = data.get('course_interest')
    if not name or not raw_phone or not course:
        raise HTTPException(status_code=400, detail="Name, phone and course are required")

    phone_normalized = normalize_phone(raw_phone)
    qualifications = data.get('qualifications') or []

    with get_db() as conn:
        cur = conn.cursor()

        # Dedup on normalized phone (same key the Mongo bridge uses)
        cur.execute("SELECT id, name FROM lead WHERE dedup_key = %s", (phone_normalized,))
        existing = cur.fetchone()
        if existing:
            return {"status": "duplicate", "lead_id": str(existing[0]), "name": existing[1]}

        # Eligibility rule comes from config, not hardcoded
        cur.execute("SELECT value FROM config WHERE key = 'eligibility_required_qualification'")
        rule_row = cur.fetchone()
        required_qual = rule_row[0] if rule_row else "12th with Physics & Maths"
        is_eligible = required_qual in qualifications
        nios_interested = data.get('nios_interested') if not is_eligible else None

        cur.execute(
            """INSERT INTO lead (name, phone, email, address, course_interest,
                                 utm_source, utm_medium, utm_campaign, status, dedup_key,
                                 guardian_name, qualifications, is_eligible, nios_interested)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'new', %s, %s, %s, %s, %s) RETURNING id""",
            (name, phone_normalized, data.get('email'), data.get('address'), course,
             data.get('utm_source'), 'manual', 'add_query', phone_normalized,
             data.get('guardian_name'), json.dumps(qualifications), is_eligible, nios_interested)
        )
        lead_id = cur.fetchone()[0]

        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp["id"], "create_query", "lead", json.dumps({
                "lead_id": str(lead_id), "source": data.get('utm_source'),
                "is_eligible": is_eligible, "nios_interested": nios_interested
            }))
        )
    return {"status": "created", "lead_id": str(lead_id), "is_eligible": is_eligible}

@app.post("/api/leads/{lead_id}/followup")
async def create_followup(lead_id: str, data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO followup (lead_id, due_date, reason, created_by)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (lead_id, data.get('due_date'), data.get('reason'), current_emp["id"])
        )
        followup_id = cur.fetchone()[0]
    return {"id": str(followup_id)}

@app.get("/api/followups/pending")
async def get_pending_followups(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT f.id, f.lead_id, f.due_date, f.reason, l.name, l.phone, l.course_interest
            FROM followup f
            JOIN lead l ON f.lead_id = l.id
            WHERE f.done = false AND f.due_date <= NOW() + INTERVAL '24 hours'
            ORDER BY f.due_date
        """)
        followups = []
        for r in cur.fetchall():
            followups.append({
                "id": str(r[0]), "lead_id": str(r[1]), "due_date": r[2].isoformat(),
                "reason": r[3], "lead_name": r[4], "lead_phone": r[5], "course_interest": r[6]
            })
    return followups

@app.get("/api/reports/funnel")
async def get_funnel_report(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                utm_source, utm_medium, utm_campaign,
                COUNT(*) as total_leads,
                COUNT(CASE WHEN first_contacted_at IS NOT NULL THEN 1 END) as contacted,
                COUNT(CASE WHEN status = 'closed' AND id IN (
                    SELECT lead_id FROM contact_attempt WHERE disposition = 'Interested'
                ) THEN 1 END) as interested
            FROM lead
            GROUP BY utm_source, utm_medium, utm_campaign
            ORDER BY total_leads DESC
        """)
        funnel = []
        for r in cur.fetchall():
            funnel.append({
                "utm_source": r[0], "utm_medium": r[1], "utm_campaign": r[2],
                "total_leads": r[3], "contacted": r[4], "interested": r[5]
            })
    return funnel

@app.get("/api/courses")
async def get_courses(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT c.id, c.code, c.name, c.base_fee, c.installment_count,
                   COALESCE(SUM(cli.amount), 0) as line_items_total
            FROM course c
            LEFT JOIN course_line_item cli ON c.id = cli.course_id
            WHERE c.active = true
            GROUP BY c.id
            ORDER BY c.name
        """)
        courses = []
        for r in cur.fetchall():
            total_fee = r[3] + r[5]
            courses.append({
                "id": str(r[0]),
                "code": r[1],
                "name": r[2],
                "base_fee": r[3],
                "installment_count": r[4],
                "total_fee": total_fee
            })
    return courses

@app.patch("/api/courses/{course_id}/discount")
async def update_course_discount(course_id: str, data: dict, current_emp = Depends(get_current_employee)):
    discount_percent = data.get('discount_percent', 0)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE course SET discount_percent = %s WHERE id = %s",
            (discount_percent, course_id)
        )
    return {"status": "updated"}

@app.patch("/api/courses/{course_id}/installments")
async def update_course_installments(course_id: str, data: dict, current_emp = Depends(get_current_employee)):
    installment_count = data.get('installment_count', 1)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE course SET installment_count = %s WHERE id = %s",
            (installment_count, course_id)
        )
    return {"status": "updated"}

@app.post("/api/quotes/generate")
async def generate_quote(data: dict, current_emp = Depends(get_current_employee)):
    lead_id = data.get('lead_id')
    course_id = data.get('course_id')
    down_payment = data.get('down_payment', 0)
    
    with get_db() as conn:
        cur = conn.cursor()
        
        if down_payment > 0:
            cur.execute(
                "UPDATE course SET down_payment = %s WHERE id = %s",
                (down_payment, course_id)
            )
        
        cur.execute("SELECT name FROM lead WHERE id = %s", (lead_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Lead not found")
        lead_name = row[0]
        
        cur.execute("SELECT name FROM course WHERE id = %s", (course_id,))
        row = cur.fetchone()
        if not row:
            # Only courses with fees configured in the course table can be quoted (currently CPL).
            raise HTTPException(status_code=400, detail="No fee configured for this course. Add it in Course Config before generating a quote.")
        course_name = row[0]
        
        quote_id = str(uuid.uuid4())[:8].upper()
        
        # Generate PDF bytes (no file write)
        pdf_bytes = generate_quote_pdf(lead_name, course_id, quote_id)
        
        # Store PDF in database
        cur.execute(
            """INSERT INTO outbox_message (lead_id, type, body, pdf_bytes, status)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (lead_id, 'quote', f'Quote for {course_name}', pdf_bytes, 'pending')
        )
        outbox_id = cur.fetchone()[0]
        
        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp["id"], "generate_quote", "quote", json.dumps({
                "lead_id": lead_id, "course_id": course_id, "quote_id": quote_id, "outbox_id": str(outbox_id)
            }))
        )
        
    return {"id": str(outbox_id), "quote_id": quote_id}

@app.get("/api/quotes/{outbox_id}/pdf")
async def get_quote_pdf(outbox_id: str, current_emp = Depends(get_current_employee)):
    """Serve PDF from database"""
    from fastapi.responses import Response
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT pdf_bytes FROM outbox_message WHERE id = %s", (outbox_id,))
        row = cur.fetchone()
        
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="PDF not found")
        
        return Response(
            content=bytes(row[0]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=quote_{outbox_id}.pdf"}
        )

@app.get("/api/outbox")
async def get_outbox(current_emp = Depends(get_current_employee)):
    # Access: Admin or Sales only
    if current_emp['department'] not in ['Admin', 'Sales']:
        raise HTTPException(status_code=403, detail="Outbox access requires Admin or Sales department")
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT o.id, o.lead_id, o.type, o.body, o.status, o.created_at,
                   l.name, l.phone
            FROM outbox_message o
            JOIN lead l ON o.lead_id = l.id
            WHERE o.status IN ('draft', 'pending', 'approved')
            ORDER BY o.created_at DESC
        """)
        messages = []
        for r in cur.fetchall():
            messages.append({
                "id": str(r[0]), "lead_id": str(r[1]), "type": r[2], "body": r[3],
                "status": r[4], "created_at": r[5].isoformat(),
                "lead_name": r[6], "lead_phone": r[7],
                "pdf_url": f"/api/quotes/{r[0]}/pdf" if r[2] == 'quote' else None
            })
    return messages

@app.post("/api/outbox/{message_id}/approve")
async def approve_outbox_message(message_id: str, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE outbox_message SET status = 'approved', approved_by = %s, approved_at = NOW() WHERE id = %s",
            (current_emp["id"], message_id)
        )
    return {"status": "approved"}

@app.post("/api/outbox/{message_id}/sent")
async def mark_outbox_sent(message_id: str, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE outbox_message SET status = 'sent', approved_by = %s, approved_at = NOW() WHERE id = %s",
            (current_emp["id"], message_id)
        )
        cur.execute(
            """INSERT INTO audit_log (actor, action, entity, payload)
               VALUES (%s, %s, %s, %s)""",
            (current_emp["id"], "mark_sent", "outbox_message", json.dumps({"message_id": message_id}))
        )
    return {"status": "sent"}

@app.get("/api/sync")
async def sync_snapshot(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        
        cur.execute("SELECT id, name, phone, email, department, permissions, active, created_at FROM employee WHERE active = true")
        employees = [
            {
                "id": str(r[0]), "name": r[1], "phone": r[2], "email": r[3],
                "department": r[4], "permissions": r[5], "active": r[6], "created_at": r[7].isoformat()
            }
            for r in cur.fetchall()
        ]
        
        cur.execute("""
            SELECT id, name, phone, email, address, course_interest, utm_source, utm_medium, utm_campaign,
                   status, assigned_to, created_at, first_contacted_at, dedup_key, last_note
            FROM lead
            ORDER BY created_at DESC
            LIMIT 500
        """)
        leads = [
            {
                "id": str(r[0]), "name": r[1], "phone": r[2], "email": r[3], "address": r[4],
                "course_interest": r[5], "utm_source": r[6], "utm_medium": r[7], "utm_campaign": r[8],
                "status": r[9], "assigned_to": str(r[10]) if r[10] else None,
                "created_at": r[11].isoformat(), "first_contacted_at": r[12].isoformat() if r[12] else None,
                "dedup_key": r[13], "last_note": r[14]
            }
            for r in cur.fetchall()
        ]
        
        cur.execute("""
            SELECT id, lead_id, staff_id, channel, attempted_at, disposition, note, connected
            FROM contact_attempt
            ORDER BY attempted_at DESC
            LIMIT 1000
        """)
        contact_attempts = [
            {
                "id": str(r[0]), "lead_id": str(r[1]), "staff_id": str(r[2]), "channel": r[3],
                "attempted_at": r[4].isoformat(), "disposition": r[5], "note": r[6], "connected": r[7]
            }
            for r in cur.fetchall()
        ]
        
        cur.execute("""
            SELECT id, lead_id, due_date, reason, done, created_by, created_at, completed_at
            FROM followup
            WHERE NOT done OR completed_at > NOW() - INTERVAL '30 days'
            ORDER BY due_date
        """)
        followups = [
            {
                "id": str(r[0]), "lead_id": str(r[1]), "due_date": r[2].isoformat(), "reason": r[3],
                "done": r[4], "created_by": str(r[5]), "created_at": r[6].isoformat(),
                "completed_at": r[7].isoformat() if r[7] else None
            }
            for r in cur.fetchall()
        ]
        
        cur.execute("SELECT key, value FROM config")
        config = {r[0]: r[1] for r in cur.fetchall()}
        
    return {
        "employees": employees,
        "leads": leads,
        "contact_attempts": contact_attempts,
        "followups": followups,
        "config": config,
        "synced_at": datetime.utcnow().isoformat()
    }

@app.get("/api/tasks")
async def get_tasks(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        
        # Admin sees all tasks
        if current_emp['department'] == 'Admin':
            cur.execute("""
                SELECT t.id, t.title, t.description, t.assigned_to, t.created_by, t.status, 
                       t.due_date, t.created_at, t.finish_date, t.abort_reason,
                       e1.name as assignee_name, e2.name as creator_name
                FROM task t
                LEFT JOIN employee e1 ON t.assigned_to = e1.id
                JOIN employee e2 ON t.created_by = e2.id
                ORDER BY t.created_at DESC
            """)
        else:
            # Sales, IT, Instructor: only see own tasks
            cur.execute("""
                SELECT t.id, t.title, t.description, t.assigned_to, t.created_by, t.status, 
                       t.due_date, t.created_at, t.finish_date, t.abort_reason,
                       e1.name as assignee_name, e2.name as creator_name
                FROM task t
                LEFT JOIN employee e1 ON t.assigned_to = e1.id
                JOIN employee e2 ON t.created_by = e2.id
                WHERE t.assigned_to = %s
                ORDER BY t.created_at DESC
            """, (current_emp['id'],))
        
        tasks = []
        for r in cur.fetchall():
            tasks.append({
                "id": str(r[0]), "title": r[1], "description": r[2],
                "assigned_to": str(r[3]) if r[3] else None, "created_by": str(r[4]),
                "status": r[5], "due_date": r[6].isoformat() if r[6] else None,
                "created_at": r[7].isoformat(), "finish_date": r[8].isoformat() if r[8] else None,
                "abort_reason": r[9],
                "assignee_name": r[10], "creator_name": r[11]
            })
    return tasks

@app.post("/api/tasks")
async def create_task(data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        
        # Permission: Admin can create for anyone; others only for self
        assigned_to = data.get('assigned_to')
        if current_emp['department'] != 'Admin':
            if assigned_to and assigned_to != current_emp['id']:
                raise HTTPException(status_code=403, detail="Can only create tasks for yourself")
            assigned_to = current_emp['id']
        
        cur.execute(
            """INSERT INTO task (title, description, assigned_to, created_by, status, due_date)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (data.get('title'), data.get('description'), assigned_to, 
             current_emp['id'], data.get('status', 'pending'), data.get('due_date'))
        )
        task_id = cur.fetchone()[0]
    return {"id": str(task_id)}

@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        
        # Admin can update any task; others can only update their own
        if current_emp['department'] != 'Admin':
            cur.execute("SELECT assigned_to FROM task WHERE id = %s", (task_id,))
            row = cur.fetchone()
            if not row or str(row[0]) != current_emp['id']:
                raise HTTPException(status_code=403, detail="Can only update your own tasks")
        
        if data.get('status') == 'done':
            cur.execute(
                "UPDATE task SET status = %s, finish_date = NOW() WHERE id = %s",
                ('done', task_id)
            )
        elif data.get('status') == 'aborted':
            abort_reason = data.get('abort_reason')
            if not abort_reason:
                raise HTTPException(status_code=400, detail="abort_reason required when status is aborted")
            cur.execute(
                "UPDATE task SET status = %s, abort_reason = %s WHERE id = %s",
                ('aborted', abort_reason, task_id)
            )
        else:
            fields = []
            values = []
            if 'status' in data:
                fields.append("status = %s")
                values.append(data['status'])
            if 'title' in data:
                fields.append("title = %s")
                values.append(data['title'])
            if 'description' in data:
                fields.append("description = %s")
                values.append(data['description'])
            # Only Admin can reassign tasks
            if 'assigned_to' in data:
                if current_emp['department'] == 'Admin':
                    fields.append("assigned_to = %s")
                    values.append(data['assigned_to'])
            if 'due_date' in data:
                fields.append("due_date = %s")
                values.append(data['due_date'])
            
            if fields:
                values.append(task_id)
                cur.execute(f"UPDATE task SET {', '.join(fields)} WHERE id = %s", values)
    return {"status": "updated"}

@app.get("/api/tasks/{task_id}/comments")
async def get_task_comments(task_id: str, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT tc.id, tc.body, tc.created_at, e.name
            FROM task_comment tc
            JOIN employee e ON tc.author_id = e.id
            WHERE tc.task_id = %s
            ORDER BY tc.created_at
        """, (task_id,))
        comments = []
        for r in cur.fetchall():
            comments.append({
                "id": str(r[0]), "body": r[1], "created_at": r[2].isoformat(), "author_name": r[3]
            })
    return comments

@app.post("/api/tasks/{task_id}/comments")
async def add_task_comment(task_id: str, data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO task_comment (task_id, author_id, body) VALUES (%s, %s, %s) RETURNING id",
            (task_id, current_emp['id'], data.get('body'))
        )
        comment_id = cur.fetchone()[0]
    return {"id": str(comment_id)}

@app.get("/api/employees")
async def get_employees(current_emp = Depends(get_current_employee)):
    # Directory access: Admin only
    if current_emp['department'] != 'Admin':
        raise HTTPException(status_code=403, detail="Employee directory access requires Admin department")
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, employee_id, name, job_role, joining_date, status
            FROM employee
            WHERE active = true
            ORDER BY name
        """)
        employees = []
        for r in cur.fetchall():
            employees.append({
                "id": str(r[0]),
                "employee_id": r[1],
                "name": r[2],
                "job_role": r[3],
                "joining_date": r[4].isoformat() if r[4] else None,
                "status": r[5] or 'active'
            })
    return employees

@app.get("/api/employees/{employee_id}")
async def get_employee_detail(employee_id: str, current_emp = Depends(get_current_employee)):
    # Admin can view any employee; others can only view themselves
    if current_emp['department'] != 'Admin':
        if employee_id != current_emp['id']:
            raise HTTPException(status_code=403, detail="Can only view your own profile")
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, employee_id, name, phone, email, job_role, address, 
                   pay_scale_encrypted, joining_date, status, date_of_leaving,
                   paid_leave_quota, monthly_salary, department
            FROM employee
            WHERE id = %s
        """, (employee_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Decrypt pay_scale ONLY for Admin
        pay_scale = None
        if row[7]:
            if current_emp['department'] == 'Admin':
                pay_scale = decrypt_value(row[7])
            else:
                pay_scale = "••••••"
        
        # Get current month leave days
        from datetime import date
        today = date.today()
        first_day = today.replace(day=1)
        if today.month == 12:
            last_day = date(today.year + 1, 1, 1)
        else:
            last_day = date(today.year, today.month + 1, 1)
        
        cur.execute("""
            SELECT leave_date, leave_type
            FROM employee_leave_day
            WHERE employee_id = %s AND leave_date >= %s AND leave_date < %s
            ORDER BY leave_date
        """, (employee_id, first_day, last_day))
        
        leave_days = []
        for ld in cur.fetchall():
            leave_days.append({
                "date": ld[0].isoformat(),
                "type": ld[1]
            })
        
        # Count leave types for current month
        cur.execute("""
            SELECT leave_type, COUNT(*) as count
            FROM employee_leave_day
            WHERE employee_id = %s AND leave_date >= %s AND leave_date < %s
            GROUP BY leave_type
        """, (employee_id, first_day, last_day))
        
        leave_counts = {}
        for lc in cur.fetchall():
            leave_counts[lc[0]] = lc[1]
        
        # Get paid leave info for CURRENT MONTH (not year)
        cur.execute("""
            SELECT paid_leave_quota, monthly_salary, department
            FROM employee
            WHERE id = %s
        """, (employee_id,))
        pq_row = cur.fetchone()
        paid_leave_quota = pq_row[0] if pq_row and pq_row[0] else 0
        monthly_salary = float(pq_row[1]) if pq_row and pq_row[1] else None
        department = pq_row[2] if pq_row else None
        
        # Count paid leaves used THIS MONTH (not year)
        cur.execute("""
            SELECT COUNT(*) FROM employee_leave_day
            WHERE employee_id = %s 
              AND leave_type = 'paid_leave'
              AND leave_date >= %s 
              AND leave_date < %s
        """, (employee_id, first_day, last_day))
        paid_leave_used = cur.fetchone()[0]
        
        # Calculate salary deduction for current month
        import calendar
        days_in_month = calendar.monthrange(today.year, today.month)[1]
        per_day_salary = monthly_salary / days_in_month if monthly_salary else 0
        
        # Count leave days for deduction calculation
        total_leave_days = leave_counts.get('leave', 0)
        total_half_days = leave_counts.get('half_day', 0)
        total_deduction_days = total_leave_days + (total_half_days * 0.5)
        deduction_amount = total_deduction_days * per_day_salary
        net_salary = monthly_salary - deduction_amount if monthly_salary else None
        
        return {
            "id": str(row[0]),
            "employee_id": row[1],
            "name": row[2],
            "phone": row[3],
            "email": row[4],
            "job_role": row[5],
            "address": row[6],
            "pay_scale": pay_scale,
            "joining_date": row[8].isoformat() if row[8] else None,
            "status": row[9] or 'active',
            "date_of_leaving": row[10].isoformat() if row[10] else None,
            "paid_leave_quota": row[11] if row[11] else 0,
            "monthly_salary": float(row[12]) if row[12] else None,
            "department": row[13],
            "leave_days": leave_days,
            "leave_counts": leave_counts,
            "paid_leave_used": paid_leave_used,
            "paid_leave_remaining": (row[11] or 0) - paid_leave_used,
            "days_in_month": days_in_month if monthly_salary else None,
            "per_day_salary": round(per_day_salary, 2) if monthly_salary else None,
            "deduction_amount": round(deduction_amount, 2) if monthly_salary else None,
            "net_salary": round(net_salary, 2) if monthly_salary else None
        }

@app.post("/api/employees")
async def create_employee(data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        
        # Encrypt pay_scale if provided
        pay_scale_encrypted = None
        if data.get('pay_scale'):
            pay_scale_encrypted = encrypt_value(data['pay_scale'])

        # department is NOT NULL + enum-constrained (migration 020). Default to most restrictive; reject unknown.
        department = data.get('department') or 'IT'
        if department not in ('Admin', 'IT', 'Sales', 'Instructors'):
            raise HTTPException(status_code=400, detail="department must be one of: Admin, IT, Sales, Instructors")

        cur.execute(
            """INSERT INTO employee (
                employee_id, name, phone, email, job_role, address,
                pay_scale_encrypted, joining_date, status, date_of_leaving,
                department, password_hash, permissions
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id""",
            (
                data.get('employee_id'), data.get('name'), data.get('phone'),
                data.get('email'), data.get('job_role'), data.get('address'),
                pay_scale_encrypted, data.get('joining_date'),
                data.get('status', 'active'), data.get('date_of_leaving'),
                department,
                hash_password(data.get('password', 'welcome123')),
                json.dumps(data.get('permissions', {}))
            )
        )
        emp_id = cur.fetchone()[0]
    return {"id": str(emp_id)}

@app.patch("/api/employees/{employee_id}")
async def update_employee(employee_id: str, data: dict, current_emp = Depends(get_current_employee)):
    # Only admin can edit most fields; employees can edit their own limited fields
    if current_emp.get('is_employee_session'):
        if employee_id != current_emp['id']:
            raise HTTPException(status_code=403, detail="Can only edit your own profile")
        # Employees cannot edit most fields
        allowed_fields = []  # No direct profile edits for employees yet
        if any(key not in allowed_fields for key in data.keys()):
            raise HTTPException(status_code=403, detail="Cannot edit profile fields")
    
    # Only Admin can edit pay_scale and department
    if 'pay_scale' in data and current_emp['department'] != 'Admin':
        raise HTTPException(status_code=403, detail="Only Admin can edit pay scale")
    
    if 'department' in data and current_emp['department'] != 'Admin':
        raise HTTPException(status_code=403, detail="Only Admin can change department")
    
    with get_db() as conn:
        cur = conn.cursor()
        fields = []
        values = []
        
        field_map = {
            'employee_id': 'employee_id', 'name': 'name', 'phone': 'phone',
            'email': 'email', 'job_role': 'job_role', 'address': 'address',
            'joining_date': 'joining_date', 'status': 'status', 
            'date_of_leaving': 'date_of_leaving', 'login_pin': 'login_pin',
            'paid_leave_quota': 'paid_leave_quota', 'monthly_salary': 'monthly_salary',
            'department': 'department', 'login_id': 'login_id'
        }
        
        for key, col in field_map.items():
            if key in data:
                fields.append(f"{col} = %s")
                values.append(data[key])
        
        # Handle pay_scale encryption
        if 'pay_scale' in data:
            fields.append("pay_scale_encrypted = %s")
            values.append(encrypt_value(data['pay_scale']) if data['pay_scale'] else None)
        
        if fields:
            values.append(employee_id)
            cur.execute(f"UPDATE employee SET {', '.join(fields)} WHERE id = %s", values)
    
    return {"status": "updated"}

@app.post("/api/employees/{employee_id}/leave")
async def mark_leave_day(employee_id: str, data: dict, current_emp = Depends(get_current_employee)):
    # Admin can mark anyone's leave; employees can mark their own
    if current_emp['department'] != 'Admin':
        if employee_id != current_emp['id']:
            raise HTTPException(status_code=403, detail="Can only mark your own leave")
    
    leave_type = data.get('leave_type')
    leave_date = data.get('leave_date')
    
    with get_db() as conn:
        cur = conn.cursor()
        
        # Check paid leave quota if marking as paid leave (MONTHLY quota)
        if leave_type == 'paid_leave':
            from datetime import datetime
            leave_date_obj = datetime.fromisoformat(leave_date)
            
            # Get employee's paid leave quota (monthly)
            cur.execute("""
                SELECT paid_leave_quota FROM employee WHERE id = %s
            """, (employee_id,))
            row = cur.fetchone()
            quota = row[0] if row and row[0] else 0
            
            if quota == 0:
                raise HTTPException(status_code=400, detail="No paid leave quota assigned. Contact admin.")
            
            # Count paid leaves used THIS MONTH (not year)
            from datetime import date
            year = leave_date_obj.year
            month = leave_date_obj.month
            first_day = date(year, month, 1)
            if month == 12:
                last_day = date(year + 1, 1, 1)
            else:
                last_day = date(year, month + 1, 1)
            
            cur.execute("""
                SELECT COUNT(*) FROM employee_leave_day
                WHERE employee_id = %s 
                  AND leave_type = 'paid_leave'
                  AND leave_date >= %s 
                  AND leave_date < %s
                  AND leave_date != %s
            """, (employee_id, first_day, last_day, leave_date))
            used = cur.fetchone()[0]
            
            if used >= quota:
                raise HTTPException(
                    status_code=400, 
                    detail=f"No More Paid Leaves Available. Used {used}/{quota} for this month"
                )
        
        cur.execute("""
            INSERT INTO employee_leave_day (employee_id, leave_date, leave_type, marked_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (employee_id, leave_date) 
            DO UPDATE SET leave_type = EXCLUDED.leave_type, marked_by = EXCLUDED.marked_by
            RETURNING id
        """, (employee_id, leave_date, leave_type, current_emp['id']))
        leave_id = cur.fetchone()[0]
    return {"id": str(leave_id)}

@app.delete("/api/employees/{employee_id}/leave/{leave_date}")
async def unmark_leave_day(employee_id: str, leave_date: str, current_emp = Depends(get_current_employee)):
    # Admin can unmark anyone's leave; employees can unmark their own
    if current_emp['department'] != 'Admin':
        if employee_id != current_emp['id']:
            raise HTTPException(status_code=403, detail="Can only unmark your own leave")
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM employee_leave_day WHERE employee_id = %s AND leave_date = %s",
            (employee_id, leave_date)
        )
    return {"status": "deleted"}

@app.get("/api/employees/{employee_id}/salary-report/{year}/{month}")
async def get_monthly_salary_report(employee_id: str, year: int, month: int, current_emp = Depends(get_current_employee)):
    """Calculate monthly salary with leave deductions"""
    # Only Admin or employee themselves can view
    if current_emp['department'] != 'Admin':
        if employee_id != current_emp['id']:
            raise HTTPException(status_code=403, detail="Can only view your own salary report")
    
    from datetime import date
    import calendar
    
    with get_db() as conn:
        cur = conn.cursor()
        
        # Get employee monthly salary
        cur.execute("SELECT monthly_salary, name FROM employee WHERE id = %s", (employee_id,))
        row = cur.fetchone()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="Monthly salary not set for employee")
        
        base_salary = float(row[0])
        emp_name = row[1]
        
        # Calculate days in month
        days_in_month = calendar.monthrange(year, month)[1]
        per_day_salary = base_salary / days_in_month
        
        # Get leave days for the month
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1)
        else:
            last_day = date(year, month + 1, 1)
        
        cur.execute("""
            SELECT leave_type, COUNT(*) as count
            FROM employee_leave_day
            WHERE employee_id = %s AND leave_date >= %s AND leave_date < %s
            GROUP BY leave_type
        """, (employee_id, first_day, last_day))
        
        leave_days = 0
        half_days = 0
        paid_leave_days = 0
        
        for lt, cnt in cur.fetchall():
            if lt == 'leave':
                leave_days = cnt
            elif lt == 'half_day':
                half_days = cnt
            elif lt == 'paid_leave':
                paid_leave_days = cnt
        
        # Calculate deduction
        # Leave = full day deduction
        # Half day = 0.5 day deduction
        # Paid leave = 0 deduction
        total_deduction_days = leave_days + (half_days * 0.5)
        deduction_amount = total_deduction_days * per_day_salary
        net_salary = base_salary - deduction_amount
        
        # Save/update report
        cur.execute("""
            INSERT INTO monthly_salary_report (
                employee_id, year, month, days_in_month, base_salary,
                leave_days, half_days, paid_leave_days, deduction_amount, net_salary
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (employee_id, year, month)
            DO UPDATE SET
                days_in_month = EXCLUDED.days_in_month,
                base_salary = EXCLUDED.base_salary,
                leave_days = EXCLUDED.leave_days,
                half_days = EXCLUDED.half_days,
                paid_leave_days = EXCLUDED.paid_leave_days,
                deduction_amount = EXCLUDED.deduction_amount,
                net_salary = EXCLUDED.net_salary
            RETURNING id
        """, (employee_id, year, month, days_in_month, base_salary, 
              leave_days, half_days, paid_leave_days, deduction_amount, net_salary))
        
        return {
            "employee_id": employee_id,
            "employee_name": emp_name,
            "year": year,
            "month": month,
            "days_in_month": days_in_month,
            "base_salary": base_salary,
            "per_day_salary": round(per_day_salary, 2),
            "leave_days": leave_days,
            "half_days": half_days,
            "paid_leave_days": paid_leave_days,
            "total_deduction_days": round(total_deduction_days, 2),
            "deduction_amount": round(deduction_amount, 2),
            "net_salary": round(net_salary, 2)
        }

@app.get("/api/salary-reports/{year}/{month}")
async def get_all_salary_reports(year: int, month: int, current_emp = Depends(get_current_employee)):
    """Get all employees' salary reports for a given month (Admin only)"""
    if current_emp['department'] != 'Admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    with get_db() as conn:
        cur = conn.cursor()
        
        # Get all active employees with monthly salary
        cur.execute("""
            SELECT id, name, monthly_salary
            FROM employee
            WHERE active = true AND monthly_salary IS NOT NULL
            ORDER BY name
        """)
        
        reports = []
        for emp_id, emp_name, _ in cur.fetchall():
            try:
                # Generate report for each employee
                report_res = await get_monthly_salary_report(str(emp_id), year, month, current_emp)
                reports.append(report_res)
            except:
                pass  # Skip employees with errors
        
        return reports

@app.get("/api/leaves")
async def get_leaves(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT l.id, l.employee_id, l.start_date, l.end_date, l.reason, l.approved, l.created_at,
                   e.name as employee_name
            FROM leave_record l
            JOIN employee e ON l.employee_id = e.id
            WHERE l.start_date >= NOW() - INTERVAL '90 days'
            ORDER BY l.start_date DESC
        """)
        leaves = []
        for r in cur.fetchall():
            leaves.append({
                "id": str(r[0]), "employee_id": str(r[1]), "start_date": r[2].isoformat(),
                "end_date": r[3].isoformat(), "reason": r[4], "approved": r[5],
                "created_at": r[6].isoformat(), "employee_name": r[7]
            })
    return leaves

@app.post("/api/leaves")
async def create_leave(data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO leave_record (employee_id, start_date, end_date, reason, approved)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (data.get('employee_id', current_emp['id']), data.get('start_date'), 
             data.get('end_date'), data.get('reason'), False)
        )
        leave_id = cur.fetchone()[0]
    return {"id": str(leave_id)}

@app.patch("/api/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE leave_record SET approved = true, approved_by = %s WHERE id = %s",
            (current_emp['id'], leave_id)
        )
    return {"status": "approved"}

@app.get("/api/meetings")
async def get_meetings(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT m.id, m.title, m.description, m.scheduled_at, m.duration_minutes, m.created_at,
                   e.name as creator_name
            FROM meeting m
            JOIN employee e ON m.created_by = e.id
            WHERE m.scheduled_at >= NOW() - INTERVAL '7 days'
            ORDER BY m.scheduled_at
        """)
        meetings = []
        for r in cur.fetchall():
            meetings.append({
                "id": str(r[0]), "title": r[1], "description": r[2],
                "scheduled_at": r[3].isoformat(), "duration_minutes": r[4],
                "created_at": r[5].isoformat(), "creator_name": r[6]
            })
    return meetings

@app.post("/api/meetings")
async def create_meeting(data: dict, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO meeting (title, description, scheduled_at, duration_minutes, created_by)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (data.get('title'), data.get('description'), data.get('scheduled_at'),
             data.get('duration_minutes', 60), current_emp['id'])
        )
        meeting_id = cur.fetchone()[0]
        
        if data.get('attendees'):
            for attendee_id in data['attendees']:
                cur.execute(
                    "INSERT INTO meeting_attendee (meeting_id, employee_id) VALUES (%s, %s)",
                    (meeting_id, attendee_id)
                )
    return {"id": str(meeting_id)}

@app.get("/api/policy-docs")
async def get_policy_docs(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, title, content, created_at FROM policy_doc ORDER BY created_at DESC")
        docs = []
        for r in cur.fetchall():
            docs.append({
                "id": str(r[0]), "title": r[1], "content": r[2][:200], "created_at": r[3].isoformat()
            })
    return docs

@app.post("/api/policy-docs")
async def create_policy_doc(data: dict, current_emp = Depends(get_current_employee)):
    title = data.get('title')
    content = data.get('content')
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO policy_doc (title, content, created_by)
               VALUES (%s, %s, %s) RETURNING id""",
            (title, content, current_emp['id'])
        )
        doc_id = cur.fetchone()[0]
    
    return {"id": str(doc_id)}

@app.post("/api/policy-docs/upload")
async def upload_policy_doc(file: UploadFile = File(...), current_emp = Depends(get_current_employee)):
    content = (await file.read()).decode('utf-8')
    title = file.filename
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO policy_doc (title, content, created_by)
               VALUES (%s, %s, %s) RETURNING id""",
            (title, content, current_emp['id'])
        )
        doc_id = cur.fetchone()[0]
    
    return {"id": str(doc_id), "title": title}

@app.get("/api/policy-docs/search")
async def search_policy_docs(q: str, current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, title, content, created_at 
            FROM policy_doc 
            WHERE title ILIKE %s OR content ILIKE %s
            ORDER BY created_at DESC
        """, (f'%{q}%', f'%{q}%'))
        docs = []
        for r in cur.fetchall():
            docs.append({
                "id": str(r[0]), "title": r[1], "content": r[2][:300], "created_at": r[3].isoformat()
            })
    return docs

@app.get("/api/dispositions/stats")
async def get_disposition_stats(current_emp = Depends(get_current_employee)):
    """Get counts for each disposition table"""
    with get_db() as conn:
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM interested")
        interested_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM not_interested")
        not_interested_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM not_reachable")
        not_reachable_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM callback")
        callback_count = cur.fetchone()[0]
        
        return {
            "interested": interested_count,
            "not_interested": not_interested_count,
            "not_reachable": not_reachable_count,
            "callback": callback_count
        }

@app.get("/api/dispositions/interested")
async def get_interested_leads(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, lead_id, name, phone, email, course_interest, address, note, 
                   marked_by, marked_at
            FROM interested
            ORDER BY marked_at DESC
        """)
        return [
            {
                "id": str(r[0]), "lead_id": str(r[1]), "name": r[2], "phone": r[3],
                "email": r[4], "course_interest": r[5], "address": r[6], "note": r[7],
                "marked_by": str(r[8]) if r[8] else None, 
                "marked_at": r[9].isoformat() if r[9] else None
            }
            for r in cur.fetchall()
        ]

@app.get("/api/dispositions/not-interested")
async def get_not_interested_leads(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, lead_id, name, phone, email, course_interest, address, note, 
                   marked_by, marked_at
            FROM not_interested
            ORDER BY marked_at DESC
        """)
        return [
            {
                "id": str(r[0]), "lead_id": str(r[1]), "name": r[2], "phone": r[3],
                "email": r[4], "course_interest": r[5], "address": r[6], "note": r[7],
                "marked_by": str(r[8]) if r[8] else None, 
                "marked_at": r[9].isoformat() if r[9] else None
            }
            for r in cur.fetchall()
        ]

@app.get("/api/dispositions/not-reachable")
async def get_not_reachable_leads(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, lead_id, name, phone, email, course_interest, address, note, 
                   marked_by, marked_at
            FROM not_reachable
            ORDER BY marked_at DESC
        """)
        return [
            {
                "id": str(r[0]), "lead_id": str(r[1]), "name": r[2], "phone": r[3],
                "email": r[4], "course_interest": r[5], "address": r[6], "note": r[7],
                "marked_by": str(r[8]) if r[8] else None, 
                "marked_at": r[9].isoformat() if r[9] else None
            }
            for r in cur.fetchall()
        ]

@app.get("/api/dispositions/callback")
async def get_callback_leads(current_emp = Depends(get_current_employee)):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, lead_id, name, phone, email, course_interest, address, note, 
                   callback_date, callback_reason, marked_by, marked_at
            FROM callback
            ORDER BY marked_at DESC
        """)
        return [
            {
                "id": str(r[0]), "lead_id": str(r[1]), "name": r[2], "phone": r[3],
                "email": r[4], "course_interest": r[5], "address": r[6], "note": r[7],
                "callback_date": r[8].isoformat() if r[8] else None,
                "callback_reason": r[9],
                "marked_by": str(r[10]) if r[10] else None, 
                "marked_at": r[11].isoformat() if r[11] else None
            }
            for r in cur.fetchall()
        ]

# ============================ STUDENTS MODULE ============================

STUDENT_DOC_TYPES = [
    'photo_id_proof', 'passport_photo', 'signature',
    'marksheet_10', 'certificate_10', 'marksheet_12', 'certificate_12',
    'board_verification_10', 'board_verification_12',
    'passport', 'i20_admission_letter', 'medical',
]
_ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'HEIF', 'HEIC'}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_heif_registered = False


def _require_students_access(current_emp):
    # Fail-closed department gate, consistent with leads: only Admin/Sales.
    if current_emp['department'] not in ('Admin', 'Sales'):
        raise HTTPException(status_code=403, detail="Students access requires Admin or Sales department")


def _process_image(raw: bytes):
    """Validate real image type from CONTENT (not extension), enforce size, convert HEIC/HEIF->JPEG.
    Returns (out_bytes, mime_type, ext). Rejects anything that is not JPEG/PNG/HEIF/HEIC."""
    global _heif_registered
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 10MB limit")
    from PIL import Image
    if not _heif_registered:
        import pillow_heif
        pillow_heif.register_heif_opener()
        _heif_registered = True
    try:
        img = Image.open(io.BytesIO(raw))
        fmt = (img.format or '').upper()
    except Exception:
        raise HTTPException(status_code=400, detail="Unreadable or invalid image file")
    if fmt not in _ALLOWED_IMAGE_FORMATS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: JPEG, PNG, HEIF, HEIC")
    if fmt in ('HEIF', 'HEIC'):
        out = io.BytesIO()
        img.convert('RGB').save(out, format='JPEG', quality=90)
        return out.getvalue(), 'image/jpeg', 'jpg'
    if fmt == 'PNG':
        return raw, 'image/png', 'png'
    return raw, 'image/jpeg', 'jpg'


def _audit(cur, actor, action, entity, payload):
    cur.execute(
        "INSERT INTO audit_log (actor, action, entity, payload) VALUES (%s, %s, %s, %s)",
        (actor, action, entity, json.dumps(payload))
    )


@app.get("/api/students")
async def list_students(search: str = "", current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    with get_db() as conn:
        cur = conn.cursor()
        like = f"%{search.strip()}%"
        cur.execute("""
            SELECT s.id, s.first_name, s.middle_name, s.last_name, s.mobile, s.course,
                   s.admission_date, s.computer_number,
                   (SELECT COUNT(DISTINCT doc_type) FROM student_document WHERE student_id = s.id) AS doc_count
            FROM student s
            WHERE (%s = '' OR
                   s.first_name ILIKE %s OR s.last_name ILIKE %s OR s.middle_name ILIKE %s OR
                   s.mobile ILIKE %s OR s.computer_number ILIKE %s OR s.course ILIKE %s)
            ORDER BY s.created_at DESC
        """, (search.strip(), like, like, like, like, like, like))
        total = len(STUDENT_DOC_TYPES)
        return [
            {
                "id": str(r[0]),
                "name": " ".join(x for x in [r[1], r[2], r[3]] if x),
                "mobile": r[4], "course": r[5],
                "admission_date": r[6].isoformat() if r[6] else None,
                "computer_number": r[7],
                "documents_complete": r[8], "documents_total": total,
            }
            for r in cur.fetchall()
        ]


@app.get("/api/students/prefill-leads")
async def student_prefill_leads(current_emp = Depends(get_current_employee)):
    """Leads with completed admissions, for prefilling Add Student."""
    _require_students_access(current_emp)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, guardian_name, phone, address, course_interest
            FROM lead
            WHERE closure_outcome = 'admission_completed'
            ORDER BY created_at DESC
        """)
        return [
            {"id": str(r[0]), "name": r[1], "guardian_name": r[2], "phone": r[3],
             "address": r[4], "course_interest": r[5]}
            for r in cur.fetchall()
        ]


@app.get("/api/students/{student_id}")
async def get_student(student_id: str, current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, first_name, middle_name, last_name, guardian_name, mobile,
                   emergency_contact, address, course, admission_date, computer_number, lead_id, created_at
            FROM student WHERE id = %s
        """, (student_id,))
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Student not found")
        student = {
            "id": str(r[0]), "first_name": r[1], "middle_name": r[2], "last_name": r[3],
            "guardian_name": r[4], "mobile": r[5], "emergency_contact": r[6], "address": r[7],
            "course": r[8], "admission_date": r[9].isoformat() if r[9] else None,
            "computer_number": r[10], "lead_id": str(r[11]) if r[11] else None,
            "created_at": r[12].isoformat() if r[12] else None,
        }
        cur.execute("""
            SELECT id, doc_type, original_filename, mime_type, size_bytes, uploaded_at
            FROM student_document WHERE student_id = %s ORDER BY uploaded_at DESC
        """, (student_id,))
        docs = {}
        for d in cur.fetchall():
            docs[d[1]] = {
                "id": str(d[0]), "doc_type": d[1], "original_filename": d[2],
                "mime_type": d[3], "size_bytes": d[4],
                "uploaded_at": d[5].isoformat() if d[5] else None,
            }
        student["doc_types"] = STUDENT_DOC_TYPES
        student["documents"] = docs  # keyed by doc_type; missing types absent
        return student


@app.post("/api/students")
async def create_student(data: dict, current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    first = (data.get('first_name') or '').strip()
    last = (data.get('last_name') or '').strip()
    raw_mobile = (data.get('mobile') or '').strip()
    if not first or not last or not raw_mobile:
        raise HTTPException(status_code=400, detail="first_name, last_name and mobile are required")
    mobile_norm = normalize_phone(raw_mobile)
    emergency = normalize_phone(data['emergency_contact']) if data.get('emergency_contact') else None
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, first_name, last_name FROM student WHERE mobile_normalized = %s", (mobile_norm,))
        dup = cur.fetchone()
        if dup:
            return {"status": "duplicate", "student_id": str(dup[0]),
                    "name": f"{dup[1]} {dup[2]}".strip()}
        cur.execute("""
            INSERT INTO student (first_name, middle_name, last_name, guardian_name, mobile,
                                 mobile_normalized, emergency_contact, address, course,
                                 admission_date, computer_number, lead_id, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, CURRENT_DATE), %s, %s, %s)
            RETURNING id
        """, (first, data.get('middle_name'), last, data.get('guardian_name'), mobile_norm,
              mobile_norm, emergency, data.get('address'), data.get('course'),
              data.get('admission_date'), data.get('computer_number'), data.get('lead_id'),
              current_emp['id']))
        student_id = cur.fetchone()[0]
        _audit(cur, current_emp['id'], 'create', 'student', {"student_id": str(student_id)})
        return {"status": "created", "student_id": str(student_id)}


@app.patch("/api/students/{student_id}")
async def update_student(student_id: str, data: dict, current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    allowed = {'first_name', 'middle_name', 'last_name', 'guardian_name', 'address',
               'course', 'admission_date', 'computer_number', 'emergency_contact'}
    fields, values = [], []
    for k in allowed:
        if k in data:
            val = data[k]
            if k == 'emergency_contact' and val:
                val = normalize_phone(val)
            fields.append(f"{k} = %s")
            values.append(val)
    if not fields:
        raise HTTPException(status_code=400, detail="No editable fields provided")
    fields.append("updated_at = NOW()")
    values.append(student_id)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE student SET {', '.join(fields)} WHERE id = %s RETURNING id", values)
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")
        _audit(cur, current_emp['id'], 'edit', 'student',
               {"student_id": student_id, "fields": [f.split(' =')[0] for f in fields if '=' in f]})
    return {"status": "updated"}


@app.delete("/api/students/{student_id}")
async def delete_student(student_id: str, current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT first_name, middle_name, last_name, mobile FROM student WHERE id = %s", (student_id,))
        s = cur.fetchone()
        if not s:
            raise HTTPException(status_code=404, detail="Student not found")
        student_name = " ".join(x for x in [s[0], s[1], s[2]] if x)
        mobile = s[3]

        cur.execute("SELECT COUNT(*), COALESCE(ARRAY_AGG(r2_key), '{}') FROM student_document WHERE student_id = %s", (student_id,))
        doc_count, db_keys = cur.fetchone()

        # 1) Delete ALL R2 objects FIRST. Union of DB keys + anything under the prefix (catch strays).
        prefix = f"students/{student_id}/"
        try:
            keys = set(db_keys) | set(r2_storage.list_keys(prefix))
            for k in keys:
                r2_storage.delete_object(k)
            # 2) Verify nothing remains before we touch the DB — no orphaned objects.
            remaining = r2_storage.list_keys(prefix)
        except Exception as e:
            # Abort: DB rows untouched, so nothing is orphaned; objects still referenced.
            raise HTTPException(status_code=502, detail=f"R2 delete failed, aborted; no rows removed: {e}")
        if remaining:
            raise HTTPException(status_code=502, detail=f"R2 objects still present under {prefix}; aborted")

        # 3) Now the DB rows: documents, then the student.
        cur.execute("DELETE FROM student_document WHERE student_id = %s", (student_id,))
        cur.execute("DELETE FROM student WHERE id = %s", (student_id,))
        # 4) The row disappears; the deletion record must not.
        _audit(cur, current_emp['id'], 'delete', 'student',
               {"student_id": student_id, "name": student_name, "mobile": mobile,
                "documents_removed": doc_count})
    return {"status": "deleted", "documents_removed": doc_count}


@app.post("/api/students/{student_id}/documents")
async def upload_student_document(
    student_id: str,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_emp = Depends(get_current_employee),
):
    _require_students_access(current_emp)
    if doc_type not in STUDENT_DOC_TYPES:
        raise HTTPException(status_code=400, detail="Invalid doc_type")
    raw = await file.read()
    out_bytes, mime, ext = _process_image(raw)  # validates content + converts HEIC->JPEG
    key = r2_storage.build_key(student_id, doc_type, ext)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM student WHERE id = %s", (student_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")
        # Replace: remove any existing file of this doc_type (delete old R2 object first)
        cur.execute("SELECT id, r2_key FROM student_document WHERE student_id = %s AND doc_type = %s",
                    (student_id, doc_type))
        old = cur.fetchone()
        r2_storage.upload_bytes(key, out_bytes, mime)
        if old:
            try:
                r2_storage.delete_object(old[1])
            except Exception:
                pass
            cur.execute("DELETE FROM student_document WHERE id = %s", (old[0],))
        cur.execute("""
            INSERT INTO student_document (student_id, doc_type, r2_key, original_filename,
                                          mime_type, size_bytes, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (student_id, doc_type, key, file.filename, mime, len(out_bytes), current_emp['id']))
        doc_id = cur.fetchone()[0]
        _audit(cur, current_emp['id'], 'upload_document', 'student_document',
               {"student_id": student_id, "doc_type": doc_type, "replaced": bool(old)})
    return {"status": "uploaded", "id": str(doc_id), "doc_type": doc_type}


@app.get("/api/students/{student_id}/documents/{doc_id}/url")
async def get_student_document_url(student_id: str, doc_id: str, current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT r2_key, doc_type FROM student_document WHERE id = %s AND student_id = %s",
                    (doc_id, student_id))
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Document not found")
        url = r2_storage.presigned_get(r[0], expires=300)  # <= 5 min
        _audit(cur, current_emp['id'], 'view_document', 'student_document',
               {"student_id": student_id, "doc_id": doc_id, "doc_type": r[1]})
    return {"url": url, "expires_in": 300}


@app.delete("/api/students/{student_id}/documents/{doc_id}")
async def delete_student_document(student_id: str, doc_id: str, current_emp = Depends(get_current_employee)):
    _require_students_access(current_emp)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT r2_key, doc_type FROM student_document WHERE id = %s AND student_id = %s",
                    (doc_id, student_id))
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Document not found")
        try:
            r2_storage.delete_object(r[0])
        except Exception:
            pass
        cur.execute("DELETE FROM student_document WHERE id = %s", (doc_id,))
        _audit(cur, current_emp['id'], 'delete_document', 'student_document',
               {"student_id": student_id, "doc_id": doc_id, "doc_type": r[1]})
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# CCTV attendance (synced from the camera system running on the Mac Mini)
# ---------------------------------------------------------------------------

@app.post("/api/attendance/ingest")
async def attendance_ingest(data: dict, authorization: str = Header(default="")):
    """Receives entry/exit updates from the CCTV attendance system.

    Secured by a shared secret: the caller must send
    'Authorization: Bearer <ATTENDANCE_INGEST_TOKEN>'.
    """
    token = os.getenv("ATTENDANCE_INGEST_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503,
                            detail="ATTENDANCE_INGEST_TOKEN not configured on the CRM server")
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Invalid attendance token")

    required = ("person_id", "name", "date")
    if any(not data.get(k) for k in required):
        raise HTTPException(status_code=422, detail=f"Fields required: {required}")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO cctv_attendance
                (source_person_id, person_name, person_role, crm_id, date,
                 entry_time, exit_time, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (source_person_id, date) DO UPDATE SET
                person_name = EXCLUDED.person_name,
                person_role = EXCLUDED.person_role,
                crm_id      = EXCLUDED.crm_id,
                entry_time  = EXCLUDED.entry_time,
                exit_time   = EXCLUDED.exit_time,
                updated_at  = NOW()
        """, (str(data["person_id"]), data["name"], data.get("role"),
              data.get("crm_id"), data["date"],
              data.get("entry_time"), data.get("exit_time")))
    return {"status": "ok"}


@app.get("/api/attendance")
async def attendance_list(date: str = None, current_emp = Depends(get_current_employee)):
    """Daily attendance from the CCTV system. Admin department only."""
    if current_emp.get("department") != "Admin":
        raise HTTPException(status_code=403,
                            detail="Only the Admin department can view CCTV attendance")
    target = date or datetime.now().strftime("%Y-%m-%d")
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT source_person_id, person_name, person_role, crm_id,
                   date, entry_time, exit_time, updated_at
            FROM cctv_attendance
            WHERE date = %s
            ORDER BY entry_time NULLS LAST
        """, (target,))
        rows = [{
            "person_id": r[0], "name": r[1], "role": r[2], "crm_id": r[3],
            "date": r[4].isoformat() if r[4] else None,
            "entry_time": r[5], "exit_time": r[6],
            "updated_at": r[7].isoformat() if r[7] else None,
        } for r in cur.fetchall()]
    return {"date": target, "rows": rows,
            "present": len(rows),
            "inside": sum(1 for r in rows if not r["exit_time"])}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
