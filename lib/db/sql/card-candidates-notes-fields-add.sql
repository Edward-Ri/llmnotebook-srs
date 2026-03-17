-- Extend card_candidates with notebook/reference provenance
-- Depends on:
--   - card_candidates table from card-candidates-add.sql
--   - note_blocks table from note-blocks-add.sql
--   - references table from references-add.sql

ALTER TABLE card_candidates
  ADD COLUMN IF NOT EXISTS source_note_block_id UUID NULL REFERENCES note_blocks(id) ON DELETE SET NULL;

ALTER TABLE card_candidates
  ADD COLUMN IF NOT EXISTS source_reference_id UUID NULL REFERENCES references(id) ON DELETE SET NULL;

ALTER TABLE card_candidates
  ADD COLUMN IF NOT EXISTS generation_mode VARCHAR(32) NOT NULL DEFAULT 'keyword';

CREATE INDEX IF NOT EXISTS idx_card_candidates_source_note_block_id
  ON card_candidates (source_note_block_id);

CREATE INDEX IF NOT EXISTS idx_card_candidates_source_reference_id
  ON card_candidates (source_reference_id);
