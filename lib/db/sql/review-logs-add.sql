-- Review logs table for SM-2 grading history
-- Requires: flashcards table from flashcards-add.sql

CREATE TABLE IF NOT EXISTS review_logs (
  id SERIAL PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_logs_card_id ON review_logs (card_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_created_at ON review_logs (created_at);
