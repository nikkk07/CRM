-- Simplify employee table for clean directory
ALTER TABLE employee DROP COLUMN IF EXISTS designation;
ALTER TABLE employee DROP COLUMN IF EXISTS department;
ALTER TABLE employee DROP COLUMN IF EXISTS reporting_to;
ALTER TABLE employee DROP COLUMN IF EXISTS emergency_contact_name;
ALTER TABLE employee DROP COLUMN IF EXISTS emergency_contact_phone;
ALTER TABLE employee DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE employee DROP COLUMN IF EXISTS home_address;
ALTER TABLE employee DROP COLUMN IF EXISTS leave_balance;
ALTER TABLE employee DROP COLUMN IF EXISTS photo_url;
ALTER TABLE employee DROP COLUMN IF EXISTS resignation_date;

ALTER TABLE employee ADD COLUMN IF NOT EXISTS job_role VARCHAR(100);
ALTER TABLE employee ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS pay_scale_encrypted TEXT;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS date_of_leaving DATE;

-- Rename status active/inactive convention
UPDATE employee SET status = 'active' WHERE status IS NULL OR status = '';

-- Employee leave tracking table
CREATE TABLE IF NOT EXISTS employee_leave_day (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    leave_type VARCHAR(20) NOT NULL CHECK (leave_type IN ('leave', 'half_day', 'paid_leave')),
    marked_by UUID NOT NULL REFERENCES employee(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, leave_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_leave_day_emp ON employee_leave_day(employee_id, leave_date);
CREATE INDEX IF NOT EXISTS idx_employee_leave_day_date ON employee_leave_day(leave_date);

-- Update existing employee
UPDATE employee SET 
    job_role = 'Owner/Director',
    address = 'N/A'
WHERE phone = '+919999999999';
