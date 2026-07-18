"""Attendance rules.

- First sighting on a working day (Mon-Sat, not a holiday) = ENTRY, with snapshot.
- A person off ALL cameras for more than EXIT_AFTER_MINUTES = EXIT;
  exit time is the moment they were LAST seen, not when the timer fires.
- If they reappear the same day after being marked exited, the record reopens
  so the final exit time is always the last sighting of the day.
"""
import logging
import time
from datetime import datetime, timedelta
from threading import Thread

import cv2

from . import config, db, r2, crm

log = logging.getLogger("attendance")

_last_db_write: dict[int, float] = {}   # person_id -> monotonic time of last last_seen write
_last_snap_write: dict[int, float] = {} # person_id -> monotonic time of last "latest snapshot" save


def is_working_day(d) -> bool:
    if d.weekday() == 6:  # Sunday
        return False
    return not db.is_holiday(d.strftime("%Y-%m-%d"))


def _save_crop(frame, bbox, path):
    from .recognition import crop_face
    crop = crop_face(frame, bbox)
    if crop is None:
        return False
    cv2.imwrite(str(path), crop)
    return True


def record_sighting(pid, score, camera_name, frame, bbox):
    """Called by camera workers every time an enrolled person is recognized."""
    now = datetime.now()
    ts = now.isoformat(timespec="seconds")
    date = now.strftime("%Y-%m-%d")
    mono = time.monotonic()

    day_dir = config.SNAP_DIR / date
    day_dir.mkdir(exist_ok=True)

    # refresh the person's "latest look" snapshot at most once a minute;
    # it becomes the exit snapshot when they leave
    snap_path = None
    if mono - _last_snap_write.get(pid, 0) > 60:
        _last_snap_write[pid] = mono
        p = day_dir / f"{pid}_last.jpg"
        if _save_crop(frame, bbox, p):
            snap_path = str(p.relative_to(config.DATA_DIR))

    # throttle last_seen DB writes to one per 15s per person
    if snap_path or mono - _last_db_write.get(pid, 0) > 15:
        _last_db_write[pid] = mono
        db.set_last_seen(pid, ts, camera_name, snap_path)

    if not is_working_day(now):
        return

    row = db.get_attendance(pid, date)
    if row is None:
        entry_name = f"{pid}_entry_{now.strftime('%H%M%S')}.jpg"
        entry_path = day_dir / entry_name
        rel = str(entry_path.relative_to(config.DATA_DIR)) if _save_crop(frame, bbox, entry_path) else None
        db.mark_entry(pid, date, now.strftime("%H:%M:%S"), rel)
        log.info("ENTRY %s (person %s) at %s via %s [score %.2f]",
                 db.get_person(pid)["name"], pid, ts, camera_name, score)
        if rel:
            r2.enqueue(rel)
        crm.try_sync_now()
    elif row["exit_time"] is not None:
        # came back after being marked exited -> reopen; exit will be re-marked later
        db.reopen(row["id"])
        log.info("REOPEN attendance for person %s (returned at %s)", pid, ts)


class ExitChecker(Thread):
    """Every minute, close any open attendance whose person has been off
    all cameras for longer than the configured absence window."""

    def __init__(self):
        super().__init__(daemon=True, name="exit-checker")

    def run(self):
        while True:
            try:
                self.check_once()
            except Exception:
                log.exception("exit check failed")
            time.sleep(60)

    def check_once(self):
        now = datetime.now()
        cutoff = now - timedelta(minutes=config.EXIT_AFTER_MINUTES)
        changed = False
        for row in db.open_rows():
            last_ts = row["last_ts"] or f"{row['date']}T{row['entry_time']}"
            try:
                last_dt = datetime.fromisoformat(last_ts)
            except ValueError:
                continue
            stale_day = row["date"] < now.strftime("%Y-%m-%d")
            if last_dt < cutoff or (stale_day and last_dt.date().isoformat() == row["date"]):
                exit_time = last_dt.strftime("%H:%M:%S")
                db.mark_exit(row["id"], exit_time, row["last_snap"])
                changed = True
                log.info("EXIT %s (person %s) at %s (absent > %d min)",
                         row["name"], row["person_id"], exit_time, config.EXIT_AFTER_MINUTES)
                if row["last_snap"]:
                    r2.enqueue(row["last_snap"])
        if changed:
            crm.try_sync_now()
