-- Student last name is optional: many walk-in admissions give a single name only.
-- Migration 022 created the column NOT NULL; DROP NOT NULL is idempotent in
-- Postgres (a no-op once the constraint is already gone), so this is safe to re-run.
ALTER TABLE student ALTER COLUMN last_name DROP NOT NULL;
