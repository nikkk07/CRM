import os
from cryptography.fernet import Fernet
import base64

def get_cipher():
    key = os.getenv('ENCRYPTION_KEY', '').encode()
    if len(key) != 32:
        raise ValueError("ENCRYPTION_KEY must be exactly 32 bytes")
    key_b64 = base64.urlsafe_b64encode(key)
    return Fernet(key_b64)

def encrypt_value(plain_text):
    if not plain_text:
        return None
    cipher = get_cipher()
    return cipher.encrypt(plain_text.encode()).decode()

def decrypt_value(encrypted_text):
    if not encrypted_text:
        return None
    cipher = get_cipher()
    return cipher.decrypt(encrypted_text.encode()).decode()
