-- Feature 1: closed leads sub-state (status='closed' is the top-level state; outcome is sub-state)
DO $$ BEGIN
    CREATE TYPE closure_outcome_enum AS ENUM ('admission_completed', 'admission_aborted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE lead ADD COLUMN IF NOT EXISTS closure_outcome closure_outcome_enum;

-- Feature 2: manual query entry fields
ALTER TABLE lead ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS qualifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS is_eligible BOOLEAN;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS nios_interested BOOLEAN;

-- Eligibility rule lives in config, not hardcoded in app code (DGCA: needs 12th w/ Physics & Maths)
INSERT INTO config (key, value) VALUES
    ('eligibility_required_qualification', '"12th with Physics & Maths"'::jsonb)
ON CONFLICT (key) DO NOTHING;
