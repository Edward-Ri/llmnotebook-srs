-- Flashcards table for study cards
-- Depends on:
--   - decks table from decks-tree-add.sql
--   - keywords / text_blocks tables from reading-materials.sql & keywords-add.sql
--   - pgcrypto extension (for gen_random_uuid())

CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE RESTRICT,
  source_keyword_id UUID NULL REFERENCES keywords(id) ON DELETE SET NULL,
  source_text_block_id UUID NULL REFERENCES text_blocks(id) ON DELETE SET NULL,
  front_content TEXT NOT NULL,
  back_content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_source_keyword_id ON flashcards (source_keyword_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_source_text_block_id ON flashcards (source_text_block_id);

