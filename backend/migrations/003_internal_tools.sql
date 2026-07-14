CREATE TABLE meeting (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    created_by UUID NOT NULL REFERENCES employee(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meeting_scheduled_at ON meeting(scheduled_at);

CREATE TABLE meeting_attendee (
    meeting_id UUID NOT NULL REFERENCES meeting(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employee(id),
    PRIMARY KEY (meeting_id, employee_id)
);
