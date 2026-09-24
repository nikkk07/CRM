"""
Charter leads from Book My Charter (bookmycharter.in).

The website's server (never the browser) POSTs each validated charter request
to /api/leads/charter with 'Authorization: Bearer <CHARTER_INGEST_TOKEN>'.
The token is its own shared secret, separate from ATTENDANCE_INGEST_TOKEN and
PARTNER_API_TOKEN, so leaking one never grants another.

Every field is re-validated here: the CRM does not trust the website's
validation, and only whitelisted keys are stored.

One lead per trip, not per phone number: a customer asking for Delhi→Dehradun
today and Mumbai→Goa next month is two enquiries. The dedup key is the phone
plus route plus date, so a double submit of the same trip is caught while a
new trip becomes a new lead. Charter keys are prefixed 'charter:' so they can
never collide with an aviation lead's phone-only key.
"""
import json
import re
from datetime import date

from database import get_db
from lead_ingestion import normalize_phone

MAX_TEXT = 200
MAX_NOTES = 2000

# Optional fields accepted from the website, with their max length.
OPTIONAL_TEXT = {
    "departureTime": 5,
    "tripType": 20,
    "returnDate": 10,
    "aircraftPreference": 40,
    "purpose": 40,
    "additionalRequirements": MAX_NOTES,
    "sourcePath": 200,
}

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class CharterValidationError(ValueError):
    def __init__(self, errors: dict):
        super().__init__("invalid charter request")
        self.errors = errors


def _text(value, limit):
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    return value[:limit] if value else None


def _valid_date(value):
    if not value or not _DATE_RE.match(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate_charter(data: dict, *, require_date: bool = True) -> dict:
    """Return the cleaned charter fields or raise CharterValidationError."""
    if not isinstance(data, dict):
        raise CharterValidationError({"body": "Expected a JSON object"})
    errors = {}

    name = _text(data.get("name"), 120)
    if not name:
        errors["name"] = "Required"

    raw_phone = _text(data.get("phone"), 30) or ""
    digits = re.sub(r"\D", "", raw_phone)
    if not 7 <= len(digits) <= 15:
        errors["phone"] = "Enter a valid phone number"

    origin = _text(data.get("from"), MAX_TEXT)
    destination = _text(data.get("to"), MAX_TEXT)
    if not origin:
        errors["from"] = "Required"
    if not destination:
        errors["to"] = "Required"

    departure = _text(data.get("departureDate"), 10)
    if departure and not _valid_date(departure):
        errors["departureDate"] = "Use YYYY-MM-DD"
    elif require_date and not departure:
        errors["departureDate"] = "Required"

    passengers = data.get("passengers")
    try:
        passengers = int(passengers) if passengers not in (None, "") else None
    except (TypeError, ValueError):
        passengers = -1
    if passengers is not None and not 1 <= passengers <= 500:
        errors["passengers"] = "Between 1 and 500"
    if require_date and passengers is None:
        errors["passengers"] = "Required"

    email = _text(data.get("email"), 200)
    if email and "@" not in email:
        errors["email"] = "Enter a valid email"

    details = {"from": origin, "to": destination, "departureDate": departure, "passengers": passengers}
    for key, limit in OPTIONAL_TEXT.items():
        value = _text(data.get(key), limit)
        if value:
            details[key] = value
    if details.get("departureTime") and not _TIME_RE.match(details["departureTime"]):
        errors["departureTime"] = "Use HH:MM"
    if details.get("returnDate") and not _valid_date(details["returnDate"]):
        errors["returnDate"] = "Use YYYY-MM-DD"
    if isinstance(data.get("flexibleDates"), bool):
        details["flexibleDates"] = data["flexibleDates"]

    if errors:
        raise CharterValidationError(errors)

    return {
        "name": name,
        "phone": normalize_phone(raw_phone),
        "email": email,
        "details": {k: v for k, v in details.items() if v is not None},
    }


def charter_dedup_key(phone: str, details: dict) -> str:
    trip = "|".join(
        (details.get(k) or "").strip().lower() for k in ("from", "to", "departureDate")
    )
    return f"charter:{phone}:{trip}"


def charter_reference(lead_id) -> str:
    """Short reference shown to the customer and searchable in the CRM."""
    return "BMC-" + str(lead_id).replace("-", "")[:8].upper()


def insert_charter_lead(cur, cleaned: dict, *, source: str, medium: str, campaign, actor=None) -> dict:
    """Insert one charter lead on an open cursor. Returns status + ids."""
    key = charter_dedup_key(cleaned["phone"], cleaned["details"])
    cur.execute("SELECT id, name FROM lead WHERE dedup_key = %s", (key,))
    existing = cur.fetchone()
    if existing:
        return {
            "status": "duplicate",
            "lead_id": str(existing[0]),
            "name": existing[1],
            "reference": charter_reference(existing[0]),
        }

    cur.execute(
        """INSERT INTO lead (name, phone, email, course_interest, utm_source, utm_medium,
                             utm_campaign, status, dedup_key, segment, charter_details)
           VALUES (%s, %s, %s, 'Charter', %s, %s, %s, 'new', %s, 'charter', %s)
           RETURNING id""",
        (cleaned["name"], cleaned["phone"], cleaned["email"], source, medium, campaign,
         key, json.dumps(cleaned["details"])),
    )
    lead_id = cur.fetchone()[0]
    cur.execute(
        "INSERT INTO audit_log (actor, action, entity, payload) VALUES (%s, %s, %s, %s)",
        (actor, "create", "lead", json.dumps({
            "lead_id": str(lead_id), "segment": "charter", "source": source,
        })),
    )
    return {"status": "created", "lead_id": str(lead_id), "reference": charter_reference(lead_id)}


def ingest_charter_lead(data: dict) -> dict:
    cleaned = validate_charter(data, require_date=True)
    with get_db() as conn:
        cur = conn.cursor()
        return insert_charter_lead(
            cur, cleaned,
            source="Book My Charter website",
            medium="website",
            campaign=cleaned["details"].get("sourcePath"),
        )
