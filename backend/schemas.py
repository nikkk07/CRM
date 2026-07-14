from typing import Optional
from uuid import UUID
from pydantic import BaseModel

class EmployeeCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str = "admin"
    permissions: dict = {}
    password: str

class LoginRequest(BaseModel):
    phone: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    employee: dict
