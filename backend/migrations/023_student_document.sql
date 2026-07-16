DO $$ BEGIN
    CREATE TYPE student_doc_type AS ENUM (
        'photo_id_proof','passport_photo','signature',
        'marksheet_10','certificate_10','marksheet_12','certificate_12',
        'board_verification_10','board_verification_12',
        'passport','i20_admission_letter','medical'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- One row per uploaded file. Bytes live in Cloudflare R2, never in Postgres.
CREATE TABLE IF NOT EXISTS student_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    doc_type student_doc_type NOT NULL,
    r2_key TEXT NOT NULL,                       -- students/{student_id}/{doc_type}/{uuid}.{ext}
    original_filename TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES employee(id)
);

CREATE INDEX IF NOT EXISTS idx_student_document_student ON student_document(student_id);
