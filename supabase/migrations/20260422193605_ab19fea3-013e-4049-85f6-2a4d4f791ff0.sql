-- Add canonical_name column to fk_profiles for profile anchoring
ALTER TABLE public.fk_profiles
ADD COLUMN IF NOT EXISTS canonical_name text;

-- Generated normalized version for fast lookups (lowercase, trimmed, accents removed handled in app layer)
ALTER TABLE public.fk_profiles
ADD COLUMN IF NOT EXISTS canonical_name_normalized text
GENERATED ALWAYS AS (lower(btrim(coalesce(canonical_name, '')))) STORED;

-- Index for fast lookup by (client_id, network, canonical_name_normalized)
CREATE INDEX IF NOT EXISTS fk_profiles_client_network_canonical_idx
ON public.fk_profiles (client_id, network, canonical_name_normalized)
WHERE client_id IS NOT NULL AND canonical_name_normalized <> '';

-- Backfill canonical_name with display_name (or profile_id) for existing profiles
UPDATE public.fk_profiles
SET canonical_name = COALESCE(NULLIF(btrim(display_name), ''), profile_id)
WHERE canonical_name IS NULL;