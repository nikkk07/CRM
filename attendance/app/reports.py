"""Daily attendance summary written by Groq (free tier). Text reports only —
face recognition never leaves the Mac."""
import logging
import time
from datetime import datetime
from threading import Thread

import requests

from . import config, db, purge

log = logging.getLogger("reports")


def build_context(date: str) -> str:
    rows = db.day_rows(date)
    people = db.list_people(active_only=True)
    present_ids = {r["person_id"] for r in rows}
    lines = [f"Attendance for {date} at We One Aviation institute:"]
    for r in rows:
        lines.append(f"- {r['name']} ({r['role']}): entry {r['entry_time']}, "
                     f"exit {r['exit_time'] or 'still present / not marked'}")
    absent = [p["name"] + f" ({p['role']})" for p in people if p["id"] not in present_ids]
    lines.append("Absent: " + (", ".join(absent) if absent else "nobody"))
    return "\n".join(lines)


def generate(date: str) -> str | None:
    if not config.GROQ_API_KEY:
        return None
    prompt = (
        "You write short daily attendance reports for an aviation training institute. "
        "Given the raw data, write a crisp report (under 200 words): headline numbers "
        "(present/absent split by students vs staff), notable late arrivals (after 10:00), "
        "early exits (before 16:00), and the absentee list. Plain text, no markdown tables.\n\n"
        + build_context(date)
    )
    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
            json={
                "model": config.GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=60,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        db.save_report(date, text)
        log.info("Daily report generated for %s", date)
        return text
    except Exception as e:
        log.warning("Groq report failed: %s", e)
        return None


class Scheduler(Thread):
    """Fires once per day at REPORT_HOUR: writes the AI report (if Groq is
    configured) and runs the visitor biometric retention purge."""

    def __init__(self, recognizer=None):
        super().__init__(daemon=True, name="report-scheduler")
        self.recognizer = recognizer
        self._purged_on = None  # date the purge last ran, so it fires once a day

    def run(self):
        while True:
            now = datetime.now()
            date = now.strftime("%Y-%m-%d")
            if now.hour == config.REPORT_HOUR:
                if config.GROQ_API_KEY and now.weekday() != 6 and db.get_report(date) is None:
                    generate(date)
                if self._purged_on != date:
                    self._purged_on = date
                    try:
                        purge.purge_expired_visitors(self.recognizer)
                    except Exception:
                        log.exception("visitor purge failed")
            time.sleep(300)


def start(recognizer=None):
    # The scheduler always runs (it drives the daily visitor purge); the AI
    # report step inside it is simply skipped when Groq isn't configured.
    if not config.GROQ_API_KEY:
        log.info("GROQ_API_KEY not set - daily AI reports disabled (visitor purge still runs)")
    Scheduler(recognizer).start()
