from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class EmployeeCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    # Most restrictive default (own-profile-only). A new employee must never be created with NULL department.
    department: str = "IT"
    permissions: dict = {}
    password: str

class LoginRequest(BaseModel):
    login_id: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee: dict
