-- Add login_pin (nullable, for future use) and can_access_leads
ALTER TABLE employee ADD COLUMN IF NOT EXISTS login_pin VARCHAR(4);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS can_access_leads BOOLEAN DEFAULT FALSE;

-- Set can_access_leads = TRUE where job_role contains 'sales manager' (case-insensitive)
UPDATE employee 
SET can_access_leads = TRUE 
WHERE LOWER(job_role) LIKE '%sales manager%';

-- Index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_employee_employee_id ON employee(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_phone_login ON employee(phone);
CREATE INDEX IF NOT EXISTS idx_employee_email_login ON employee(LOWER(email));
