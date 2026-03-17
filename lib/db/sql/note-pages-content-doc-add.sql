-- Add JSON document storage for rich-text notebook editor
-- Depends on:
--   - note_pages table from note-pages-add.sql

ALTER TABLE note_pages
  ADD COLUMN IF NOT EXISTS content_doc JSONB DEFAULT NULL;
