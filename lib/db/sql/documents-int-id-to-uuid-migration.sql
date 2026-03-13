-- Migration: documents.id (int) -> UUID, and dependent FKs (keywords/text_blocks)
-- Goal: preserve existing data by creating a stable old_id -> new_uuid mapping.
--
-- This script is written to be defensive:
-- - If documents.id is already UUID, it will do nothing.
-- - It preserves keywords.id values (so cards.keyword_id remains valid).
--
-- Requires pgcrypto for gen_random_uuid()

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  documents_id_type text;
  documents_pk_name text;
  keywords_fk_name text;
  text_blocks_fk_name text;
BEGIN
  SELECT data_type
  INTO documents_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'id';

  -- If documents.id is already UUID, nothing to migrate here.
  IF documents_id_type = 'uuid' THEN
    RAISE NOTICE 'documents.id is already uuid; skipping int->uuid migration.';
    RETURN;
  END IF;

  IF documents_id_type IS NULL THEN
    RAISE EXCEPTION 'Table public.documents(id) not found; cannot migrate.';
  END IF;

  -- 1) Add UUID shadow PK column on documents and populate.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'id_uuid'
  ) THEN
    EXECUTE 'ALTER TABLE public.documents ADD COLUMN id_uuid uuid';
  END IF;

  EXECUTE 'UPDATE public.documents SET id_uuid = COALESCE(id_uuid, gen_random_uuid())';

  -- 2) Build mapping table (persistent; keep it for debugging/verification).
  --    If it already exists, refresh its contents to match current documents.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents_id_map'
  ) THEN
    EXECUTE 'CREATE TABLE public.documents_id_map (old_id int PRIMARY KEY, new_id uuid NOT NULL UNIQUE)';
  ELSE
    EXECUTE 'TRUNCATE TABLE public.documents_id_map';
  END IF;

  EXECUTE 'INSERT INTO public.documents_id_map(old_id, new_id) SELECT id::int, id_uuid FROM public.documents';

  -- 3) Migrate keywords.document_id (int -> uuid) while keeping keywords.id stable.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'keywords'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'keywords' AND column_name = 'document_id'
        AND data_type IN ('integer', 'bigint', 'smallint')
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'keywords' AND column_name = 'document_id_uuid'
      ) THEN
        EXECUTE 'ALTER TABLE public.keywords ADD COLUMN document_id_uuid uuid';
      END IF;

      EXECUTE $sql$
        UPDATE public.keywords k
        SET document_id_uuid = m.new_id
        FROM public.documents_id_map m
        WHERE k.document_id::int = m.old_id
      $sql$;

      -- Drop old FK (if any) before dropping/changing the column.
      SELECT conname
      INTO keywords_fk_name
      FROM pg_constraint
      WHERE conrelid = 'public.keywords'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE '%(document_id)%'
      LIMIT 1;

      IF keywords_fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.keywords DROP CONSTRAINT %I', keywords_fk_name);
      END IF;

      -- Enforce not null after backfill (will fail if any rows couldn’t be mapped).
      EXECUTE 'ALTER TABLE public.keywords ALTER COLUMN document_id_uuid SET NOT NULL';

      EXECUTE 'ALTER TABLE public.keywords DROP COLUMN document_id';
      EXECUTE 'ALTER TABLE public.keywords RENAME COLUMN document_id_uuid TO document_id';
      EXECUTE 'ALTER TABLE public.keywords ADD CONSTRAINT keywords_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id_uuid) ON DELETE CASCADE';
    END IF;
  END IF;

  -- 4) Migrate text_blocks.document_id if it exists and is still int.
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'text_blocks'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'text_blocks' AND column_name = 'document_id'
        AND data_type IN ('integer', 'bigint', 'smallint')
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'text_blocks' AND column_name = 'document_id_uuid'
      ) THEN
        EXECUTE 'ALTER TABLE public.text_blocks ADD COLUMN document_id_uuid uuid';
      END IF;

      EXECUTE $sql$
        UPDATE public.text_blocks tb
        SET document_id_uuid = m.new_id
        FROM public.documents_id_map m
        WHERE tb.document_id::int = m.old_id
      $sql$;

      SELECT conname
      INTO text_blocks_fk_name
      FROM pg_constraint
      WHERE conrelid = 'public.text_blocks'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) ILIKE '%(document_id)%'
      LIMIT 1;

      IF text_blocks_fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.text_blocks DROP CONSTRAINT %I', text_blocks_fk_name);
      END IF;

      EXECUTE 'ALTER TABLE public.text_blocks ALTER COLUMN document_id_uuid SET NOT NULL';
      EXECUTE 'ALTER TABLE public.text_blocks DROP COLUMN document_id';
      EXECUTE 'ALTER TABLE public.text_blocks RENAME COLUMN document_id_uuid TO document_id';
      EXECUTE 'ALTER TABLE public.text_blocks ADD CONSTRAINT text_blocks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id_uuid) ON DELETE CASCADE';
    END IF;
  END IF;

  -- 5) Swap documents primary key from (old int id) to (id_uuid).
  SELECT conname
  INTO documents_pk_name
  FROM pg_constraint
  WHERE conrelid = 'public.documents'::regclass AND contype = 'p'
  LIMIT 1;

  IF documents_pk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', documents_pk_name);
  END IF;

  EXECUTE 'ALTER TABLE public.documents DROP COLUMN id';
  EXECUTE 'ALTER TABLE public.documents RENAME COLUMN id_uuid TO id';
  EXECUTE 'ALTER TABLE public.documents ADD PRIMARY KEY (id)';

  -- Fix up any FK constraints we added earlier to reference documents(id) (post-rename).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='keywords'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='keywords' AND column_name='document_id' AND data_type='uuid'
    ) THEN
      -- Replace keywords FK target from documents(id_uuid) to documents(id), if present.
      SELECT conname
      INTO keywords_fk_name
      FROM pg_constraint
      WHERE conrelid = 'public.keywords'::regclass AND contype='f'
        AND pg_get_constraintdef(oid) ILIKE '%REFERENCES public.documents(id)%'
      LIMIT 1;

      -- No-op: already references documents(id) after rename.
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='text_blocks'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='text_blocks' AND column_name='document_id' AND data_type='uuid'
    ) THEN
      -- No-op: constraint targets follow the rename.
    END IF;
  END IF;

  RAISE NOTICE 'documents.id migrated to uuid; dependent FKs migrated using public.documents_id_map.';
END
$$;

COMMIT;

