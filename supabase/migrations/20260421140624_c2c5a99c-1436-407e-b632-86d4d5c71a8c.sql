UPDATE public.fk_profiles
SET is_competitor = false, is_own_profile = true
WHERE client_id = '33007e66-8607-4313-8c06-46f761417ab6'
  AND display_name_normalized ILIKE '%actinver%';