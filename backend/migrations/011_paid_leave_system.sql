-- Add paid leave allocation and monthly salary tracking
ALTER TABLE employee ADD COLUMN IF NOT EXISTS paid_leave_quota INTEGER DEFAULT 0;
ALTER TABLE employee ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12,2);

-- Add salary deduction tracking per month
CREATE TABLE IF NOT EXISTS monthly_salary_report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    days_in_month INTEGER NOT NULL,
    base_salary DECIMAL(12,2) NOT NULL,
    leave_days INTEGER DEFAULT 0,
    half_days INTEGER DEFAULT 0,
    paid_leave_days INTEGER DEFAULT 0,
    deduction_amount DECIMAL(12,2) DEFAULT 0,
    net_salary DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_salary_emp_date ON monthly_salary_report(employee_id, year, month);
