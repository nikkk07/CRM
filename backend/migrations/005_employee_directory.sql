-- Employee directory expansion
ALTER TABLE employee ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE employee ADD COLUMN IF NOT EXISTS reporting_to UUID REFERENCES employee(id);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS resignation_date DATE;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS home_address TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_department ON employee(department);
CREATE INDEX IF NOT EXISTS idx_employee_status ON employee(status);
CREATE INDEX IF NOT EXISTS idx_employee_reporting_to ON employee(reporting_to);

-- Update existing employee
UPDATE employee SET 
    employee_id = 'EMP001',
    designation = 'Owner',
    department = 'Management',
    joining_date = CURRENT_DATE,
    status = 'active',
    leave_balance = 30
WHERE phone = '+919999999999';
