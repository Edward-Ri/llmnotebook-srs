-- Add SM-2 scheduling fields to flashcards
-- Requires: flashcards table from flashcards-add.sql

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS repetition INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interval INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ease_factor REAL NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS next_review_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_flashcards_next_review_date ON flashcards (next_review_date);
