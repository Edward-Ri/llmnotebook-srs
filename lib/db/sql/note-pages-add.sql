-- Notebook pages per workspace
-- Depends on:
--   - documents table from reading-materials.sql
--   - users table from users-add.sql
--   - set_updated_at() helper from reading-materials.sql
--   - pgcrypto extension (for gen_random_uuid())

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS note_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS note_pages_document_id_user_id_idx
  ON note_pages (document_id, user_id);

DROP TRIGGER IF EXISTS trg_note_pages_set_updated_at ON note_pages;
CREATE TRIGGER trg_note_pages_set_updated_at
BEFORE UPDATE ON note_pages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
