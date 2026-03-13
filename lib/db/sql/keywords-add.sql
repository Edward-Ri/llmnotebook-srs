-- Keywords table for sections & text_blocks
-- Depends on:
--   - documents / text_blocks / sections tables from reading-materials.sql
--   - pgcrypto extension (for gen_random_uuid())

CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  text_block_id UUID NULL REFERENCES text_blocks(id) ON DELETE SET NULL,
  word VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  UNIQUE (section_id, word)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keywords_section_id ON keywords (section_id);
CREATE INDEX IF NOT EXISTS idx_keywords_text_block_id ON keywords (text_block_id);
CREATE INDEX IF NOT EXISTS idx_keywords_word ON keywords (word);

