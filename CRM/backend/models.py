from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class Employee(BaseModel):
    id: UUID
    name: str
    phone: str
    email: Optional[str]
    department: str
    permissions: dict
    active: bool
    created_at: datetime

class Lead(BaseModel):
    id: UUID
    name: str
    phone: str
    email: Optional[str]
    address: Optional[str]
    course_interest: Optional[str]
    utm_source: Optional[str]
    utm_medium: Optional[str]
    utm_campaign: Optional[str]
    status: str
    assigned_to: Optional[UUID]
    created_at: datetime
    first_contacted_at: Optional[datetime]
    dedup_key: str

class ContactAttempt(BaseModel):
    id: UUID
    lead_id: UUID
    staff_id: UUID
    channel: str
    attempted_at: datetime
    disposition: Optional[str]
    note: Optional[str]
    connected: bool

class Followup(BaseModel):
    id: UUID
    lead_id: UUID
    due_date: datetime
    reason: Optional[str]
    done: bool
    created_by: UUID
    created_at: datetime
    completed_at: Optional[datetime]

class OutboxMessage(BaseModel):
    id: UUID
    lead_id: UUID
    type: str
    body: Optional[str]
    pdf_path: Optional[str]
    status: str
    approved_by: Optional[UUID]
    created_at: datetime
    approved_at: Optional[datetime]

class AuditLog(BaseModel):
    id: UUID
    actor: Optional[UUID]
    action: str
    entity: str
    ts: datetime
    payload: Optional[dict]
