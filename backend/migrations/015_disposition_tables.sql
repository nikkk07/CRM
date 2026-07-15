-- Create 4 separate disposition tables

CREATE TABLE IF NOT EXISTS interested (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    course_interest TEXT,
    address TEXT,
    note TEXT,
    marked_by UUID REFERENCES employee(id),
    marked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS not_interested (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    course_interest TEXT,
    address TEXT,
    note TEXT,
    marked_by UUID REFERENCES employee(id),
    marked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS not_reachable (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    course_interest TEXT,
    address TEXT,
    note TEXT,
    marked_by UUID REFERENCES employee(id),
    marked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS callback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    course_interest TEXT,
    address TEXT,
    note TEXT,
    callback_date TIMESTAMPTZ,
    callback_reason TEXT,
    marked_by UUID REFERENCES employee(id),
    marked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interested_lead ON interested(lead_id);
CREATE INDEX idx_not_interested_lead ON not_interested(lead_id);
CREATE INDEX idx_not_reachable_lead ON not_reachable(lead_id);
CREATE INDEX idx_callback_lead ON callback(lead_id);
