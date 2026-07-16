-- Migration 020: Collapse access control into department
-- Single source of truth: department field

-- Backfill department for existing rows
UPDATE employee SET department = 'Admin' WHERE name = 'Admin' AND role = 'owner';
UPDATE employee SET department = 'Sales' WHERE permission_level = 'sales' AND department IS NULL;
UPDATE employee SET department = 'IT' WHERE permission_level = 'regular' AND department IS NULL;

-- Make department NOT NULL
ALTER TABLE employee ALTER COLUMN department SET NOT NULL;

-- Drop old access control columns
ALTER TABLE employee DROP COLUMN IF EXISTS permission_level;
ALTER TABLE employee DROP COLUMN IF EXISTS can_access_leads;
ALTER TABLE employee DROP COLUMN IF EXISTS role;

-- Drop role enum if it exists
DROP TYPE IF EXISTS employee_role;
