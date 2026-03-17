-- Migrate text_blocks ownership from documents to references
-- Depends on:
--   - references table from references-add.sql
--   - text_blocks table from reading-materials.sql
--   - documents.user_id from users-add.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'text_blocks'
      AND column_name = 'reference_id'
  ) THEN
    RAISE NOTICE 'text_blocks.reference_id already exists; skipping migration.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.documents
    WHERE user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate text_blocks: documents.user_id contains NULL values.';
  END IF;

  INSERT INTO public.references (document_id, user_id, title)
  SELECT d.id, d.user_id, d.title
  FROM public.documents d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.references r
    WHERE r.document_id = d.id
  );

  ALTER TABLE public.text_blocks
    ADD COLUMN reference_id UUID;

  UPDATE public.text_blocks tb
  SET reference_id = r.id
  FROM public.references r
  WHERE r.document_id = tb.document_id;

  ALTER TABLE public.text_blocks
    ALTER COLUMN reference_id SET NOT NULL;

  ALTER TABLE public.text_blocks
    DROP COLUMN document_id;

  CREATE INDEX IF NOT EXISTS text_blocks_reference_id_idx
    ON public.text_blocks (reference_id);

  CREATE UNIQUE INDEX IF NOT EXISTS text_blocks_reference_id_position_index_uq
    ON public.text_blocks (reference_id, position_index);
END
$$;

COMMIT;
