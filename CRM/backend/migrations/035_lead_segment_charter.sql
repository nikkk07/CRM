-- Split leads into two segments: 'aviation' (pilot training, every existing
-- lead) and 'charter' (Book My Charter enquiries). Additive and backward
-- compatible: existing rows default to 'aviation', and code that does not know
-- about these columns keeps working unchanged.
--
-- Reversible:
--   ALTER TABLE lead DROP COLUMN charter_details;
--   ALTER TABLE lead DROP COLUMN segment;
--   (enum values cannot be dropped; unused values are harmless)

ALTER TABLE lead ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'aviation';

DO $$ BEGIN
    ALTER TABLE lead ADD CONSTRAINT lead_segment_check CHECK (segment IN ('aviation', 'charter'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The trip as the customer submitted it (from, to, dates, passengers, ...).
ALTER TABLE lead ADD COLUMN IF NOT EXISTS charter_details JSONB;

CREATE INDEX IF NOT EXISTS idx_lead_segment ON lead (segment);

-- Charter closures are bookings, not admissions.
ALTER TYPE closure_outcome_enum ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE closure_outcome_enum ADD VALUE IF NOT EXISTS 'booking_lost';
