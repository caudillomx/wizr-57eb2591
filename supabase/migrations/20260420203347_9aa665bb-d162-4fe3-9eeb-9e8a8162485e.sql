-- Backfill any null external_id with a synthetic stable value to satisfy the new constraint
UPDATE public.fk_posts
SET external_id = COALESCE(link, 'synthetic::' || id::text)
WHERE external_id IS NULL;

-- Remove duplicates that would block the unique constraint (keep most recent)
DELETE FROM public.fk_posts a
USING public.fk_posts b
WHERE a.fk_profile_id = b.fk_profile_id
  AND a.external_id = b.external_id
  AND a.imported_at < b.imported_at;

-- Drop the partial unique index (ON CONFLICT cannot match partial indexes via PostgREST)
DROP INDEX IF EXISTS public.idx_fk_posts_profile_external;

-- Add a full unique constraint usable by ON CONFLICT
ALTER TABLE public.fk_posts
  ADD CONSTRAINT fk_posts_profile_external_unique
  UNIQUE (fk_profile_id, external_id);