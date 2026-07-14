CREATE TABLE course (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    base_fee INTEGER NOT NULL,
    installment_count INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_line_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0
);

CREATE INDEX idx_course_line_item_course_id ON course_line_item(course_id);

INSERT INTO course (code, name, base_fee, installment_count) VALUES
    ('CPL', 'Commercial Pilot License (CPL)', 999999, 4);

INSERT INTO course_line_item (course_id, description, amount, display_order)
SELECT id, 'DGCA Exam Fees', 99999, 1 FROM course WHERE code = 'CPL';

INSERT INTO course_line_item (course_id, description, amount, display_order)
SELECT id, 'Study Material', 99999, 2 FROM course WHERE code = 'CPL';
