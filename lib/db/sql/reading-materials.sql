-- Reading Materials schema (PostgreSQL)
-- Requires: pgcrypto for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Generic updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- documents: one document has many text_blocks
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Keep updated_at fresh on UPDATE
DROP TRIGGER IF EXISTS trg_documents_set_updated_at ON documents;
CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- text_blocks: ordered blocks per document
CREATE TABLE IF NOT EXISTS text_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  position_index INT NOT NULL,
  UNIQUE (document_id, position_index)
);

-- sections: hierarchical sections per document, spanning ranges of text_blocks
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  parent_section_id UUID NULL REFERENCES sections(id) ON DELETE SET NULL,
  heading VARCHAR(255),
  start_block_index INT NOT NULL,
  end_block_index INT NOT NULL,
  level INT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_text_blocks_document_id ON text_blocks (document_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at);
CREATE INDEX IF NOT EXISTS idx_sections_document_id ON sections (document_id);
CREATE INDEX IF NOT EXISTS idx_sections_parent_section_id ON sections (parent_section_id);
CREATE INDEX IF NOT EXISTS idx_sections_start_block_index ON sections (start_block_index);
CREATE INDEX IF NOT EXISTS idx_sections_end_block_index ON sections (end_block_index);

