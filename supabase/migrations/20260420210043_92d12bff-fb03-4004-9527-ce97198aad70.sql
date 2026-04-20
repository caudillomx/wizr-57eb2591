-- 1. Add normalized display_name column (generated, lowercase + trimmed)
ALTER TABLE public.fk_profiles
  ADD COLUMN IF NOT EXISTS display_name_normalized text
  GENERATED ALWAYS AS (lower(btrim(coalesce(display_name, profile_id)))) STORED;

-- 2. Consolidate existing duplicates by (client_id, network, normalized name)
-- For each duplicate group, pick canonical = oldest profile, reassign children, delete others
DO $$
DECLARE
  dup RECORD;
  canonical_id uuid;
BEGIN
  FOR dup IN
    SELECT client_id, network, lower(btrim(coalesce(display_name, profile_id))) AS norm_name,
           array_agg(id ORDER BY created_at ASC) AS ids
    FROM public.fk_profiles
    WHERE client_id IS NOT NULL
    GROUP BY client_id, network, lower(btrim(coalesce(display_name, profile_id)))
    HAVING count(*) > 1
  LOOP
    canonical_id := dup.ids[1];
    -- Reassign KPIs, posts, top posts to canonical
    UPDATE public.fk_profile_kpis SET fk_profile_id = canonical_id
      WHERE fk_profile_id = ANY(dup.ids[2:]);
    UPDATE public.fk_posts SET fk_profile_id = canonical_id
      WHERE fk_profile_id = ANY(dup.ids[2:]);
    UPDATE public.fk_daily_top_posts SET fk_profile_id = canonical_id
      WHERE fk_profile_id = ANY(dup.ids[2:]);
    -- Delete duplicate profiles
    DELETE FROM public.fk_profiles WHERE id = ANY(dup.ids[2:]);
  END LOOP;
END $$;

-- 3. Clean up any orphaned KPI/post duplicates created by the merge
DELETE FROM public.fk_profile_kpis a
USING public.fk_profile_kpis b
WHERE a.ctid < b.ctid
  AND a.fk_profile_id = b.fk_profile_id
  AND a.period_start = b.period_start
  AND a.period_end = b.period_end;

DELETE FROM public.fk_posts a
USING public.fk_posts b
WHERE a.ctid < b.ctid
  AND a.fk_profile_id = b.fk_profile_id
  AND a.external_id = b.external_id;

-- 4. Add unique constraint on the triplet (client_id, network, display_name_normalized)
-- Only applies when client_id is NOT NULL (legacy ranking-based profiles unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS fk_profiles_client_network_name_unique
  ON public.fk_profiles (client_id, network, display_name_normalized)
  WHERE client_id IS NOT NULL;