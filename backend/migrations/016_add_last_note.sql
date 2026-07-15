-- Add last_note column to lead table to show most recent note

ALTER TABLE lead ADD COLUMN IF NOT EXISTS last_note TEXT;
