-- Notebook blocks for free text and quoted excerpts
-- Depends on:
--   - note_pages table from note-pages-add.sql
--   - users table from users-add.sql
--   - documents table from reading-materials.sql
--   - references table from references-add.sql
--   - text_blocks table from reading-materials.sql or text-blocks-migrate-to-reference.sql
--   - set_updated_at() helper from reading-materials.sql
--   - pgcrypto extension (for gen_random_uuid())

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS note_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES note_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  source_text_block_id UUID NULL REFERENCES text_blocks(id) ON DELETE SET NULL,
  source_reference_id UUID NULL REFERENCES references(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  block_type VARCHAR(32) NOT NULL DEFAULT 'text',
  position_index INT NOT NULL,
  selection_offset INT NULL,
  selection_length INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS note_blocks_page_id_position_index_idx
  ON note_blocks (page_id, position_index);

CREATE INDEX IF NOT EXISTS note_blocks_document_id_user_id_idx
  ON note_blocks (document_id, user_id);

DROP TRIGGER IF EXISTS trg_note_blocks_set_updated_at ON note_blocks;
CREATE TRIGGER trg_note_blocks_set_updated_at
BEFORE UPDATE ON note_blocks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
