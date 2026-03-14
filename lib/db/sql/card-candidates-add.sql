-- Card candidates table for pending validation cards
-- Depends on: users, documents, keywords tables

CREATE TABLE IF NOT EXISTS card_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  keyword_id UUID NULL REFERENCES keywords(id) ON DELETE SET NULL,
  front_content TEXT NOT NULL,
  back_content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_validation',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_candidates_user_id ON card_candidates (user_id);
CREATE INDEX IF NOT EXISTS idx_card_candidates_document_id ON card_candidates (document_id);
CREATE INDEX IF NOT EXISTS idx_card_candidates_status ON card_candidates (status);
