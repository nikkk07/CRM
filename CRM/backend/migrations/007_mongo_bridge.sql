-- Store watermark for MongoDB import
CREATE TABLE IF NOT EXISTS mongo_import_watermark (
    id SERIAL PRIMARY KEY,
    collection_name VARCHAR(100) NOT NULL UNIQUE,
    last_imported_at TIMESTAMPTZ,
    last_imported_id VARCHAR(100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO mongo_import_watermark (collection_name, last_imported_at)
VALUES ('website_leads', NOW() - INTERVAL '30 days')
ON CONFLICT (collection_name) DO NOTHING;

-- Add index on lead.created_at for faster dedup lookups
CREATE INDEX IF NOT EXISTS idx_lead_created_at ON lead(created_at DESC);
