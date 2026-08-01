-- Migration 028: Student self-service login
-- Students sign in with their 10-digit mobile + a bcrypt-hashed PIN.
-- Mobile alone never grants access; a NULL login_pin_hash means login is impossible.
ALTER TABLE student ADD COLUMN IF NOT EXISTS login_pin_hash TEXT;
ALTER TABLE student ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE student ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
