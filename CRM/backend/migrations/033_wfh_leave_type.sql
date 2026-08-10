-- Allow 'wfh' (Work From Home) as a markable day type.
--
-- NOTE: the day-type CHECK lives on employee_leave_day (migration 006), which is
-- the table the calendar / POST /api/employees/{id}/leave actually writes to.
-- The legacy leave_record table (migration 001) has no leave_type column at all,
-- so there is nothing to migrate there.
--
-- Verified constraint name in Supabase (pg_constraint):
--   employee_leave_day_leave_type_check
--     CHECK (leave_type IN ('leave','half_day','paid_leave'))
--
-- WFH means the person WORKED: it is stored here only so the day is not treated
-- as an absence. It is never counted as leave and never consumes paid leave quota.

ALTER TABLE employee_leave_day
    DROP CONSTRAINT IF EXISTS employee_leave_day_leave_type_check;

ALTER TABLE employee_leave_day
    ADD CONSTRAINT employee_leave_day_leave_type_check
    CHECK (leave_type IN ('leave', 'half_day', 'paid_leave', 'wfh'));
