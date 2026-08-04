-- Migration 031: half-day / full-day status for CCTV/biometric attendance.
-- day_status is computed from entry_time/exit_time whenever an exit is recorded
-- (see _compute_day_status in main.py). status_override lets Admin correct a
-- day by hand; reports must prefer status_override over day_status.
-- Idempotent: old rows are intentionally left NULL (no guessed backfill).

ALTER TABLE cctv_attendance ADD COLUMN IF NOT EXISTS day_status TEXT;
ALTER TABLE cctv_attendance ADD COLUMN IF NOT EXISTS hours_worked NUMERIC(5,2);
ALTER TABLE cctv_attendance ADD COLUMN IF NOT EXISTS status_override TEXT;
ALTER TABLE cctv_attendance ADD COLUMN IF NOT EXISTS override_by UUID;
ALTER TABLE cctv_attendance ADD COLUMN IF NOT EXISTS override_at TIMESTAMPTZ;
