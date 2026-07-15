-- Remove LLM/AI integration: drop embedding column and vector extension
ALTER TABLE policy_doc DROP COLUMN IF EXISTS embedding;
DROP EXTENSION IF EXISTS vector;
