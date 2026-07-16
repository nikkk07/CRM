-- Migration 019: Add login_id field for authentication
-- Replace phone-based login with login_id

-- Add login_id column (nullable initially)
ALTER TABLE employee ADD COLUMN login_id VARCHAR(50);

-- Backfill: use employee_id if present, else phone
UPDATE employee 
SET login_id = COALESCE(employee_id, phone)
WHERE login_id IS NULL;

-- Create case-insensitive unique index
CREATE UNIQUE INDEX idx_employee_login_id_lower ON employee (LOWER(login_id));

-- Now make it NOT NULL
ALTER TABLE employee ALTER COLUMN login_id SET NOT NULL;
