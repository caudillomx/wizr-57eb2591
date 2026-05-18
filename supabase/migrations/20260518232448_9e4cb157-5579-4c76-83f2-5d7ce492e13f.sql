UPDATE public.mentions
SET raw_metadata = COALESCE(raw_metadata, '{}'::jsonb) || jsonb_build_object('date_confidence', 'unknown', 'date_source', 'backfill_null')
WHERE published_at IS NULL
  AND (raw_metadata IS NULL OR NOT (raw_metadata ? 'date_confidence'));