-- Add parked and closed as boolean flags, not status replacements
ALTER TABLE lead ADD COLUMN IF NOT EXISTS parked BOOLEAN DEFAULT FALSE;
ALTER TABLE lead ADD COLUMN IF NOT EXISTS closed BOOLEAN DEFAULT FALSE;

-- Migrate existing parked/closed status to flags
UPDATE lead SET parked = TRUE WHERE status = 'parked';
UPDATE lead SET closed = TRUE WHERE status = 'closed';
