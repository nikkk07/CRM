"""CRM integration.

Universal approach so it works with ANY CRM:
1. If CRM_WEBHOOK_URL is set, every attendance change is POSTed there as JSON
   (with optional bearer token). Rows are retried until the CRM accepts them.
2. The dashboard always offers an Excel/CSV export for manual import.

A CRM-specific connector (login + API calls) can be added in this file once
the CRM's name/API is known.
"""
import logging
import time
from threading import Event, Thread

import requests

from . import config, db

log = logging.getLogger("crm")
_wake = Event()


def enabled() -> bool:
    return bool(config.CRM_WEBHOOK_URL)


def try_sync_now():
    """Called whenever attendance changes; nudges the background flusher."""
    if enabled():
        _wake.set()


def _payload(row) -> dict:
    return {
        "event": "attendance.updated",
        "person_id": row["person_id"],
        "crm_id": row["crm_id"] or None,
        "name": row["name"],
        "role": row["role"],
        "date": row["date"],
        "entry_time": row["entry_time"],
        "exit_time": row["exit_time"],
    }


def _push(row) -> bool:
    headers = {"Content-Type": "application/json"}
    if config.CRM_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {config.CRM_WEBHOOK_TOKEN}"
    try:
        resp = requests.post(config.CRM_WEBHOOK_URL, json=_payload(row),
                             headers=headers, timeout=15)
        return 200 <= resp.status_code < 300
    except requests.RequestException as e:
        log.warning("CRM webhook failed: %s", e)
        return False


class Flusher(Thread):
    """Pushes unsynced attendance rows; retries every 10 minutes."""

    def __init__(self):
        super().__init__(daemon=True, name="crm-flusher")

    def run(self):
        log.info("CRM webhook sync enabled -> %s", config.CRM_WEBHOOK_URL)
        while True:
            _wake.wait(timeout=600)
            _wake.clear()
            for row in db.unsynced_rows():
                if _push(row):
                    db.mark_synced(row["id"])
                else:
                    break  # CRM unreachable; retry on next cycle
            time.sleep(2)


def start():
    if enabled():
        Flusher().start()
    else:
        log.info("CRM webhook not configured - use dashboard Excel export")
