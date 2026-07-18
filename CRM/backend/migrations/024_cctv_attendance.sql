-- Migration 024: CCTV attendance synced from the camera system on the Mac Mini
-- One row per person per day; entry/exit updated in place as the day unfolds.

CREATE TABLE IF NOT EXISTS cctv_attendance (
    id SERIAL PRIMARY KEY,
    source_person_id TEXT NOT NULL,       -- person id in the camera system
    person_name TEXT NOT NULL,
    person_role TEXT,                     -- 'student' | 'staff'
    crm_id TEXT,                          -- optional link to CRM student/employee
    date DATE NOT NULL,
    entry_time TEXT,                      -- HH:MM:SS (institute local time)
    exit_time TEXT,                       -- HH:MM:SS, null while still inside
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (source_person_id, date)
);

CREATE INDEX IF NOT EXISTS idx_cctv_attendance_date ON cctv_attendance(date);
