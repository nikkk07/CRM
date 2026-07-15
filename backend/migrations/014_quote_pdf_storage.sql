-- Store PDF bytes in database instead of ephemeral filesystem
ALTER TABLE outbox_message ADD COLUMN IF NOT EXISTS pdf_bytes BYTEA;

COMMENT ON COLUMN outbox_message.pdf_bytes IS 'PDF file bytes stored in database (Render ephemeral filesystem workaround)';
