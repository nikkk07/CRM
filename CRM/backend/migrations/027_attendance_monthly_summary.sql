-- Migration 027: Monthly attendance rollups, preserved after raw rows are purged.
--
-- The 3-month rolling retention job aggregates cctv_attendance into one row per
-- person per month BEFORE deleting the raw daily rows, so historical presence
-- counts remain viewable indefinitely. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS attendance_monthly_summary (
    id SERIAL PRIMARY KEY,
    month            DATE NOT NULL,        -- first day of the month
    source_person_id TEXT NOT NULL,
    person_name      TEXT NOT NULL,
    person_role      TEXT,
    crm_id           TEXT,
    days_present     INTEGER NOT NULL,
    first_date       DATE,
    last_date        DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (month, source_person_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_monthly_summary_month
    ON attendance_monthly_summary(month);
