-- Extend flashcards with notebook/reference provenance
-- Depends on:
--   - flashcards table from flashcards-add.sql
--   - note_blocks table from note-blocks-add.sql
--   - references table from references-add.sql

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS source_note_block_id UUID NULL REFERENCES note_blocks(id) ON DELETE SET NULL;

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS source_reference_id UUID NULL REFERENCES "references"(id) ON DELETE SET NULL;

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS generation_mode VARCHAR(32) NOT NULL DEFAULT 'keyword';

CREATE INDEX IF NOT EXISTS idx_flashcards_source_note_block_id
  ON flashcards (source_note_block_id);

CREATE INDEX IF NOT EXISTS idx_flashcards_source_reference_id
  ON flashcards (source_reference_id);
