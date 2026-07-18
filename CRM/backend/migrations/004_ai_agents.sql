-- Embeddings column for RAG
ALTER TABLE policy_doc ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Config for AI providers (JSONB format)
INSERT INTO config (key, value) VALUES 
    ('ollama_model', '"llama3.2:3b-instruct-q4_K_M"'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO config (key, value) VALUES 
    ('embedding_model', '"nomic-embed-text"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_policy_doc_embedding ON policy_doc USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
