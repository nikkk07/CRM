-- Add abort_reason and finish_date columns to task table
ALTER TABLE task ADD COLUMN IF NOT EXISTS abort_reason TEXT;
ALTER TABLE task ADD COLUMN IF NOT EXISTS finish_date TIMESTAMPTZ;

-- Update status constraint to include 'aborted'
-- Note: existing status field is text, so no enum constraint to modify
