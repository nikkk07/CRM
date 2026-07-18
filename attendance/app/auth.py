"""Admin-only access, authenticated against the We One Aviation CRM.

Login flow: credentials are forwarded to the CRM's /api/auth/login. Only
employees whose CRM department is "Admin" get a session — Sales, IT,
Instructors and everyone else are refused. Passwords are never stored here.

Sessions are signed cookies (HMAC-SHA256) with a secret auto-generated on
first run and kept in data/.session_secret.
"""
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time

import requests

from . import config

log = logging.getLogger("auth")

COOKIE_NAME = "weone_session"
SESSION_HOURS = 12
_SECRET_FILE = config.DATA_DIR / ".session_secret"


def _secret() -> bytes:
    if _SECRET_FILE.exists():
        return _SECRET_FILE.read_bytes()
    s = secrets.token_bytes(32)
    _SECRET_FILE.write_bytes(s)
    return s


def make_session(employee: dict) -> str:
    payload = {
        "name": employee.get("name", "Admin"),
        "dept": employee.get("department", ""),
        "exp": int(time.time()) + SESSION_HOURS * 3600,
    }
    raw = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = hmac.new(_secret(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


def read_session(token: str):
    """Return the session payload, or None if missing/invalid/expired."""
    if not token or "." not in token:
        return None
    try:
        raw, sig = token.rsplit(".", 1)
        expected = hmac.new(_secret(), raw.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(raw.encode()))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def crm_login(login_id: str, password: str):
    """Ask the CRM to verify credentials. Returns (employee, error_message)."""
    try:
        resp = requests.post(
            f"{config.CRM_API_URL}/api/auth/login",
            json={"login_id": login_id, "password": password},
            timeout=75,  # Render free tier may need ~50s to wake from sleep
        )
    except requests.RequestException as e:
        log.warning("CRM login request failed: %s", e)
        return None, ("Could not reach the CRM server. Check the internet "
                      "connection, or try again in a minute (the CRM server "
                      "may be waking up).")
    if resp.status_code == 401:
        return None, "Wrong login ID or password."
    if resp.status_code != 200:
        return None, f"CRM server error (HTTP {resp.status_code}). Try again."
    try:
        employee = resp.json().get("employee") or {}
    except ValueError:
        return None, "Unexpected reply from the CRM server."
    return employee, None
