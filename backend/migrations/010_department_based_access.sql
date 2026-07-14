-- Add department field to employee
CREATE TYPE department_enum AS ENUM ('Admin', 'IT', 'Sales', 'Instructors');

ALTER TABLE employee ADD COLUMN IF NOT EXISTS department department_enum;

-- Set default departments based on existing data
UPDATE employee SET department = 'Admin' WHERE role IN ('admin', 'owner');
UPDATE employee SET department = 'IT' WHERE LOWER(job_role) LIKE '%developer%' OR LOWER(job_role) LIKE '%it%';
UPDATE employee SET department = 'Sales' WHERE LOWER(job_role) LIKE '%sales%';
UPDATE employee SET department = 'Instructors' WHERE department IS NULL;

-- can_access_leads no longer needed (superseded by department)
-- Keep column for backward compatibility but don't use it
