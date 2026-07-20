"""Central configuration: reads .env and cameras.yaml."""
import os
from pathlib import Path

import yaml
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SNAP_DIR = DATA_DIR / "snapshots"
UNKNOWN_DIR = DATA_DIR / "unknowns"
PEOPLE_DIR = DATA_DIR / "people"
LOG_DIR = DATA_DIR / "logs"
DB_PATH = DATA_DIR / "attendance.db"

for d in (DATA_DIR, SNAP_DIR, UNKNOWN_DIR, PEOPLE_DIR, LOG_DIR):
    d.mkdir(parents=True, exist_ok=True)

load_dotenv(BASE_DIR / ".env")


def env(key: str, default=None):
    v = os.environ.get(key)
    return v if v not in (None, "") else default


# --- Attendance rules ---
EXIT_AFTER_MINUTES = int(env("EXIT_AFTER_MINUTES", 60))
MATCH_THRESHOLD = float(env("MATCH_THRESHOLD", 0.45))       # cosine similarity to accept a match
UNKNOWN_THRESHOLD = float(env("UNKNOWN_THRESHOLD", 0.35))   # below this = clearly a stranger
PROCESS_EVERY_SEC = float(env("PROCESS_EVERY_SEC", 1.0))    # analyze 1 frame per camera per N seconds
MIN_FACE_HEIGHT = int(env("MIN_FACE_HEIGHT", 60))           # px; ignore faces too small to trust

# --- Visitor tracking (unknown faces auto-enrolled as anonymous visitors) ---
# When enabled, an unrecognized face gets full per-visitor entry/exit tracking
# under role='visitor'. Their biometrics (embeddings + face images) auto-delete
# after VISITOR_RETENTION_DAYS; the anonymized "Visitor N" log is retained.
VISITOR_TRACKING = env("VISITOR_TRACKING", "true").lower() in ("1", "true", "yes", "on")
VISITOR_MIN_FACE_PX = int(env("VISITOR_MIN_FACE_PX", 90))       # min face height to auto-enroll
VISITOR_MIN_DET_SCORE = float(env("VISITOR_MIN_DET_SCORE", 0.66))  # min detector confidence
VISITOR_NEW_THRESHOLD = float(env("VISITOR_NEW_THRESHOLD", 0.32))  # create only when best score is below this
VISITOR_RETENTION_DAYS = int(env("VISITOR_RETENTION_DAYS", 7))  # days to keep visitor biometrics

# --- Web ---
PORT = int(env("PORT", 8100))  # 8000 is used by the CRM backend

# --- CRM (We One Aviation CRM: login + attendance sync) ---
CRM_API_URL = env("CRM_API_URL", "https://crm-weoneaviation.onrender.com").rstrip("/")

# --- DVR / cameras (CP Plus uses the Dahua RTSP format) ---
DVR_HOST = env("DVR_HOST")
DVR_PORT = env("DVR_PORT", "554")
DVR_USER = env("DVR_USER", "admin")
DVR_PASS = env("DVR_PASS")
RTSP_URL_TEMPLATE = env(
    "RTSP_URL_TEMPLATE",
    "rtsp://{user}:{password}@{host}:{port}/cam/realmonitor?channel={channel}&subtype={subtype}",
)
RTSP_SUBTYPE = env("RTSP_SUBTYPE", "0")  # 0 = main stream (full quality)

# --- Groq (free tier) for daily text reports only ---
GROQ_API_KEY = env("GROQ_API_KEY")
GROQ_MODEL = env("GROQ_MODEL", "llama-3.3-70b-versatile")
REPORT_HOUR = int(env("REPORT_HOUR", 20))  # 8 PM daily summary

# --- Cloudflare R2 (free tier) snapshot backup ---
R2_ACCOUNT_ID = env("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY")
R2_BUCKET = env("R2_BUCKET")

# --- CRM sync ---
CRM_WEBHOOK_URL = env("CRM_WEBHOOK_URL")
CRM_WEBHOOK_TOKEN = env("CRM_WEBHOOK_TOKEN")


def load_cameras():
    """Read cameras.yaml. Each entry: {name, channel} or {name, url}."""
    path = BASE_DIR / "cameras.yaml"
    if not path.exists():
        return []
    with open(path) as f:
        raw = yaml.safe_load(f) or {}
    cams = []
    for item in raw.get("cameras", []):
        name = str(item.get("name") or f"Camera {item.get('channel', '?')}")
        url = item.get("url")
        if not url:
            if not (DVR_HOST and DVR_PASS):
                continue  # credentials not configured yet
            url = RTSP_URL_TEMPLATE.format(
                user=DVR_USER, password=DVR_PASS, host=DVR_HOST,
                port=DVR_PORT, channel=item.get("channel", 1), subtype=RTSP_SUBTYPE,
            )
        cams.append({"name": name, "url": url})
    return cams
