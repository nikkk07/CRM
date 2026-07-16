CREATE TABLE IF NOT EXISTS student (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL,
    guardian_name TEXT,
    mobile TEXT NOT NULL,
    mobile_normalized TEXT NOT NULL UNIQUE,   -- E.164 +91; dedup key (reuses normalize_phone)
    emergency_contact TEXT,                    -- normalized E.164 on write
    address TEXT,
    course TEXT,
    admission_date DATE DEFAULT CURRENT_DATE,
    computer_number TEXT,                      -- DGCA identifier, NOT a file; searchable
    lead_id UUID REFERENCES lead(id),          -- nullable; prefill source
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES employee(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_mobile_normalized ON student(mobile_normalized);
CREATE INDEX IF NOT EXISTS idx_student_computer_number ON student(computer_number);
CREATE INDEX IF NOT EXISTS idx_student_name ON student(last_name, first_name);
