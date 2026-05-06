-- 1) Function: enforce 365-day floor on mention insertion
CREATE OR REPLACE FUNCTION public.enforce_mention_age_floor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Allow NULL published_at (we'll fall back to created_at downstream)
  -- Drop any row whose published_at is older than 365 days
  IF NEW.published_at IS NOT NULL AND NEW.published_at < (now() - INTERVAL '365 days') THEN
    RETURN NULL; -- silently skip; upserts won't fail
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Trigger: BEFORE INSERT on mentions
DROP TRIGGER IF EXISTS enforce_mention_age_floor_trigger ON public.mentions;
CREATE TRIGGER enforce_mention_age_floor_trigger
BEFORE INSERT ON public.mentions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_mention_age_floor();

-- 3) Retroactive cleanup: delete mentions older than 365 days
DELETE FROM public.mentions
WHERE published_at IS NOT NULL
  AND published_at < (now() - INTERVAL '365 days');