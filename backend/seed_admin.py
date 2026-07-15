#!/usr/bin/env python3
from dotenv import load_dotenv
from database import get_db
from auth import hash_password

load_dotenv()

ADMIN_PHONE = "admin"
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
            password_hash
        ) VALUES (
            'Admin', %s, 'admin@weoneaviation.in',
            'owner', 'Admin', 'full_access', %s
        )
    """, (ADMIN_PHONE, hashed))
    conn.commit()
    
    print("✅ Admin created successfully")
    print(f"Phone: {ADMIN_PHONE}")
    print(f"Password: {ADMIN_PASSWORD}")
