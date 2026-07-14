-- Add permission_level as single source of truth for access control
-- Department becomes display-only org label

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_level_enum') THEN
        CREATE TYPE permission_level_enum AS ENUM ('full_access', 'sales', 'regular');
    END IF;
END $$;

ALTER TABLE employee ADD COLUMN IF NOT EXISTS permission_level permission_level_enum DEFAULT 'regular';

-- Set existing employees based on department (one-time migration)
UPDATE employee SET permission_level = 'sales' WHERE department = 'Sales' AND permission_level = 'regular';
UPDATE employee SET permission_level = 'full_access' WHERE role IN ('admin', 'owner') AND permission_level = 'regular';

COMMENT ON COLUMN employee.permission_level IS 'Single source of truth for access control';
COMMENT ON COLUMN employee.department IS 'Display-only organizational label - does NOT control access';
