import os
import logging
import requests

logger = logging.getLogger(__name__)

def self_ping():
    url = os.environ.get("RENDER_EXTERNAL_URL")
    if not url:
        return
    try:
        r = requests.get(f"{url}/health", timeout=10)
        logger.info("Self-ping OK -> %s", r.status_code)
    except Exception as exc:
        logger.warning("Self-ping failed (will retry): %s", exc)
