-- References table for imported materials within a workspace
-- Depends on:
--   - documents table from reading-materials.sql
--   - users table from users-add.sql
--   - set_updated_at() helper from reading-materials.sql
--   - pgcrypto extension (for gen_random_uuid())

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS references_document_id_user_id_idx
  ON references (document_id, user_id);

DROP TRIGGER IF EXISTS trg_references_set_updated_at ON references;
CREATE TRIGGER trg_references_set_updated_at
BEFORE UPDATE ON references
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
