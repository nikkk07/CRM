"""SQLite storage. One connection per operation; WAL mode for thread safety."""
import sqlite3
from contextlib import contextmanager
from datetime import datetime

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS people(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  crm_id TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS faces(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  embedding BLOB NOT NULL,
  source TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS attendance(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  entry_time TEXT,
  exit_time TEXT,
  entry_snapshot TEXT,
  exit_snapshot TEXT,
  synced INTEGER DEFAULT 0,
  UNIQUE(person_id, date)
);
CREATE TABLE IF NOT EXISTS last_seen(
  person_id INTEGER PRIMARY KEY,
  ts TEXT,
  camera TEXT,
  snapshot TEXT
);
CREATE TABLE IF NOT EXISTS holidays(date TEXT PRIMARY KEY, name TEXT);
CREATE TABLE IF NOT EXISTS reports(date TEXT PRIMARY KEY, text TEXT, created_at TEXT);
"""


@contextmanager
def conn():
    c = sqlite3.connect(config.DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA foreign_keys=ON")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init():
    with conn() as c:
        c.executescript(SCHEMA)


def now_str():
    return datetime.now().strftime("%H:%M:%S")


def today_str():
    return datetime.now().strftime("%Y-%m-%d")


# ---------- people ----------

def add_person(name, role, crm_id=""):
    with conn() as c:
        cur = c.execute(
            "INSERT INTO people(name, role, crm_id, created_at) VALUES(?,?,?,?)",
            (name.strip(), role, crm_id.strip(), datetime.now().isoformat(timespec="seconds")),
        )
        return cur.lastrowid


def get_person(pid):
    with conn() as c:
        return c.execute("SELECT * FROM people WHERE id=?", (pid,)).fetchone()


def list_people(active_only=False):
    q = "SELECT p.*, (SELECT COUNT(*) FROM faces f WHERE f.person_id=p.id) AS n_faces FROM people p"
    if active_only:
        q += " WHERE p.active=1"
    q += " ORDER BY p.role, p.name"
    with conn() as c:
        return c.execute(q).fetchall()


def update_person(pid, **fields):
    keys = ", ".join(f"{k}=?" for k in fields)
    with conn() as c:
        c.execute(f"UPDATE people SET {keys} WHERE id=?", (*fields.values(), pid))


def delete_person(pid):
    with conn() as c:
        c.execute("DELETE FROM people WHERE id=?", (pid,))
        c.execute("DELETE FROM last_seen WHERE person_id=?", (pid,))


def add_face(person_id, embedding_bytes, source):
    with conn() as c:
        c.execute(
            "INSERT INTO faces(person_id, embedding, source, created_at) VALUES(?,?,?,?)",
            (person_id, embedding_bytes, source, datetime.now().isoformat(timespec="seconds")),
        )


def all_faces():
    with conn() as c:
        return c.execute(
            "SELECT f.person_id, f.embedding FROM faces f "
            "JOIN people p ON p.id=f.person_id WHERE p.active=1"
        ).fetchall()


# ---------- attendance ----------

def get_attendance(pid, date):
    with conn() as c:
        return c.execute(
            "SELECT * FROM attendance WHERE person_id=? AND date=?", (pid, date)
        ).fetchone()


def mark_entry(pid, date, time_s, snapshot):
    with conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO attendance(person_id, date, entry_time, entry_snapshot) "
            "VALUES(?,?,?,?)",
            (pid, date, time_s, snapshot),
        )


def reopen(attendance_id):
    with conn() as c:
        c.execute(
            "UPDATE attendance SET exit_time=NULL, exit_snapshot=NULL, synced=0 WHERE id=?",
            (attendance_id,),
        )


def mark_exit(attendance_id, time_s, snapshot):
    with conn() as c:
        c.execute(
            "UPDATE attendance SET exit_time=?, exit_snapshot=?, synced=0 WHERE id=?",
            (time_s, snapshot, attendance_id),
        )


def open_rows():
    """All attendance rows not yet marked exited (any date)."""
    with conn() as c:
        return c.execute(
            "SELECT a.*, p.name, p.role, p.crm_id, ls.ts AS last_ts, ls.snapshot AS last_snap "
            "FROM attendance a JOIN people p ON p.id=a.person_id "
            "LEFT JOIN last_seen ls ON ls.person_id=a.person_id "
            "WHERE a.exit_time IS NULL"
        ).fetchall()


def day_rows(date):
    with conn() as c:
        return c.execute(
            "SELECT a.*, p.name, p.role, p.crm_id, ls.ts AS last_ts "
            "FROM attendance a JOIN people p ON p.id=a.person_id "
            "LEFT JOIN last_seen ls ON ls.person_id=a.person_id "
            "WHERE a.date=? ORDER BY a.entry_time", (date,)
        ).fetchall()


def history_rows(date_from, date_to, person_id=None):
    q = ("SELECT a.*, p.name, p.role, p.crm_id FROM attendance a "
         "JOIN people p ON p.id=a.person_id WHERE a.date BETWEEN ? AND ?")
    args = [date_from, date_to]
    if person_id:
        q += " AND a.person_id=?"
        args.append(person_id)
    q += " ORDER BY a.date DESC, a.entry_time"
    with conn() as c:
        return c.execute(q, args).fetchall()


def unsynced_rows():
    with conn() as c:
        return c.execute(
            "SELECT a.*, p.name, p.role, p.crm_id FROM attendance a "
            "JOIN people p ON p.id=a.person_id WHERE a.synced=0 AND a.entry_time IS NOT NULL"
        ).fetchall()


def mark_synced(attendance_id):
    with conn() as c:
        c.execute("UPDATE attendance SET synced=1 WHERE id=?", (attendance_id,))


# ---------- last seen ----------

def set_last_seen(pid, ts, camera, snapshot=None):
    with conn() as c:
        if snapshot:
            c.execute(
                "INSERT INTO last_seen(person_id, ts, camera, snapshot) VALUES(?,?,?,?) "
                "ON CONFLICT(person_id) DO UPDATE SET ts=?, camera=?, snapshot=?",
                (pid, ts, camera, snapshot, ts, camera, snapshot),
            )
        else:
            c.execute(
                "INSERT INTO last_seen(person_id, ts, camera) VALUES(?,?,?) "
                "ON CONFLICT(person_id) DO UPDATE SET ts=?, camera=?",
                (pid, ts, camera, ts, camera),
            )


# ---------- holidays / reports ----------

def list_holidays():
    with conn() as c:
        return c.execute("SELECT * FROM holidays ORDER BY date").fetchall()


def is_holiday(date):
    with conn() as c:
        return c.execute("SELECT 1 FROM holidays WHERE date=?", (date,)).fetchone() is not None


def add_holiday(date, name):
    with conn() as c:
        c.execute("INSERT OR REPLACE INTO holidays(date, name) VALUES(?,?)", (date, name))


def delete_holiday(date):
    with conn() as c:
        c.execute("DELETE FROM holidays WHERE date=?", (date,))


def save_report(date, text):
    with conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO reports(date, text, created_at) VALUES(?,?,?)",
            (date, text, datetime.now().isoformat(timespec="seconds")),
        )


def get_report(date):
    with conn() as c:
        return c.execute("SELECT * FROM reports WHERE date=?", (date,)).fetchone()
