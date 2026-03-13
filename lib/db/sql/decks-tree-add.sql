-- Decks table for hierarchical review card folders
-- Self-referential tree structure
-- Requires: pgcrypto for gen_random_uuid()

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  parent_id UUID NULL REFERENCES decks(id) ON DELETE SET NULL
);

-- Index to speed up parent-child lookups
CREATE INDEX IF NOT EXISTS idx_decks_parent_id ON decks (parent_id);

