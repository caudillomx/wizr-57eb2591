-- Add classification_status to fk_profiles for brand/competitor classification
-- 'unclassified' (default for new), 'brand' (mi marca), 'competitor' (competencia)
ALTER TABLE public.fk_profiles
ADD COLUMN IF NOT EXISTS classification_status text NOT NULL DEFAULT 'unclassified';

-- Backfill from existing is_competitor flag for already-imported profiles
UPDATE public.fk_profiles
SET classification_status = CASE
  WHEN is_competitor = true THEN 'competitor'
  WHEN is_own_profile = true THEN 'brand'
  ELSE 'unclassified'
END
WHERE classification_status = 'unclassified';

-- Constraint to enforce valid values
ALTER TABLE public.fk_profiles
DROP CONSTRAINT IF EXISTS fk_profiles_classification_status_check;
ALTER TABLE public.fk_profiles
ADD CONSTRAINT fk_profiles_classification_status_check
CHECK (classification_status IN ('unclassified', 'brand', 'competitor'));

-- Index for fast filtering by client + classification
CREATE INDEX IF NOT EXISTS fk_profiles_client_classification_idx
ON public.fk_profiles (client_id, classification_status)
WHERE client_id IS NOT NULL;

-- Add snapshot_date to fk_profile_kpis for daily cadence support
-- Tracks the actual import date independently from period_start/period_end
ALTER TABLE public.fk_profile_kpis
ADD COLUMN IF NOT EXISTS snapshot_date date NOT NULL DEFAULT CURRENT_DATE;

-- Backfill snapshot_date from fetched_at for existing records
UPDATE public.fk_profile_kpis
SET snapshot_date = fetched_at::date
WHERE snapshot_date = CURRENT_DATE AND fetched_at::date <> CURRENT_DATE;

-- Index for chronological ordering of snapshots per profile
CREATE INDEX IF NOT EXISTS fk_profile_kpis_profile_snapshot_idx
ON public.fk_profile_kpis (fk_profile_id, snapshot_date DESC);