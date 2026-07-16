#!/usr/bin/env python3
from dotenv import load_dotenv
from database import get_db
from auth import hash_password

load_dotenv()

ADMIN_LOGIN_ID = "admin"
ADMIN_PASSWORD = "admin"

with get_db() as conn:
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM employee WHERE role = 'owner'")
    if cur.fetchone()[0] > 0:
        print("❌ Admin already exists")
        exit(1)
    
    hashed = hash_password(ADMIN_PASSWORD)
    cur.execute("""
        INSERT INTO employee (
            name, phone, email, role, department, permission_level,
            password_hash, login_id
        ) VALUES (
            'Admin', '+919999999999', 'admin@weoneaviation.in',
            'owner', 'Admin', 'full_access', %s, %s
        )
    """, (hashed, ADMIN_LOGIN_ID))
    conn.commit()
    
    print("✅ Admin created successfully")
    print(f"Login ID: {ADMIN_LOGIN_ID}")
    print(f"Password: {ADMIN_PASSWORD}")

