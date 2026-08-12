-- Migration 034: date of birth for employees and students.
--
-- NOTE: employee.date_of_birth existed briefly in migration 005 and was DROPPED
-- in 006 (the directory rebuild). This re-adds it deliberately; IF NOT EXISTS
-- keeps the file idempotent on databases that were never rolled back.
--
-- Nullable on purpose: almost every existing employee/student record predates
-- this column and will have no DOB. Nothing may assume it is set.

ALTER TABLE employee ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE student  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
