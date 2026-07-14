import os
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import get_db

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 720

security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_employee_by_phone(phone: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, phone, email, role, permissions, active, password_hash FROM employee WHERE phone = %s AND active = true",
            (phone,)
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": str(row[0]),
            "name": row[1],
            "phone": row[2],
            "email": row[3],
            "role": row[4],
            "permissions": row[5],
            "active": row[6],
            "password_hash": row[7]
        }

def authenticate_employee(phone: str, password: str):
    emp = get_employee_by_phone(phone)
    if not emp or not verify_password(password, emp["password_hash"]):
        return None
    del emp["password_hash"]
    return emp

async def get_current_employee(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        emp_id: str = payload.get("sub")
        if emp_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, phone, email, role, permissions, active FROM employee WHERE id = %s AND active = true",
            (emp_id,)
        )
        row = cur.fetchone()
        if not row:
            raise credentials_exception
        return {
            "id": str(row[0]),
            "name": row[1],
            "phone": row[2],
            "email": row[3],
            "role": row[4],
            "permissions": row[5],
            "active": row[6]
        }
