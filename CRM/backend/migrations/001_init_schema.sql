CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

CREATE TYPE disposition_enum AS ENUM (
    'Connected',
    'Not reachable',
    'Wrong number',
    'Interested',
    'Not interested',
    'Callback'
);

CREATE TYPE role_enum AS ENUM ('admin', 'counsellor', 'owner');

CREATE TYPE outbox_status_enum AS ENUM ('pending', 'approved', 'sent', 'rejected');

CREATE TABLE employee (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    role role_enum NOT NULL DEFAULT 'admin',
    permissions JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE lead (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    course_interest TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    status TEXT DEFAULT 'new',
    assigned_to UUID REFERENCES employee(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    first_contacted_at TIMESTAMPTZ,
    dedup_key TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_lead_assigned_to ON lead(assigned_to);
CREATE INDEX idx_lead_status ON lead(status);
CREATE INDEX idx_lead_created_at ON lead(created_at DESC);

CREATE TABLE contact_attempt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES employee(id),
    channel TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    disposition disposition_enum,
    note TEXT,
    connected BOOLEAN DEFAULT false
);

CREATE INDEX idx_contact_attempt_lead_id ON contact_attempt(lead_id);
CREATE INDEX idx_contact_attempt_attempted_at ON contact_attempt(attempted_at DESC);

CREATE TABLE followup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
    due_date TIMESTAMPTZ NOT NULL,
    reason TEXT,
    done BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES employee(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_followup_due_date ON followup(due_date) WHERE NOT done;
CREATE INDEX idx_followup_lead_id ON followup(lead_id);

CREATE TABLE outbox_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    body TEXT,
    pdf_path TEXT,
    status outbox_status_enum DEFAULT 'pending',
    approved_by UUID REFERENCES employee(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status ON outbox_message(status);
CREATE INDEX idx_outbox_created_at ON outbox_message(created_at DESC);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor UUID REFERENCES employee(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    ts TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB
);

CREATE INDEX idx_audit_log_ts ON audit_log(ts DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity, ts DESC);

CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO config (key, value) VALUES
    ('sla_first_response_minutes', '15'::jsonb),
    ('max_not_reachable_attempts', '3'::jsonb);

CREATE TABLE task (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID REFERENCES employee(id),
    created_by UUID NOT NULL REFERENCES employee(id),
    status TEXT DEFAULT 'pending',
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_task_assigned_to ON task(assigned_to);
CREATE INDEX idx_task_status ON task(status);

CREATE TABLE task_comment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES employee(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_comment_task_id ON task_comment(task_id);

CREATE TABLE leave_record (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    approved BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES employee(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leave_record_employee_id ON leave_record(employee_id);
CREATE INDEX idx_leave_record_dates ON leave_record(start_date, end_date);

CREATE TABLE policy_doc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(384),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_policy_doc_embedding ON policy_doc USING ivfflat (embedding vector_cosine_ops);
