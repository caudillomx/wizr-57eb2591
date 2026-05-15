
-- Archivar menciones residuales del proyecto Instituto La Paz que no hablan del caso
UPDATE public.mentions
SET is_archived = true,
    updated_at = now()
WHERE project_id = '54a247be-2ea8-4503-a55e-ca4b0ad769e3'
  AND is_archived = false
  AND NOT (
    lower(coalesce(title,'') || ' ' || coalesce(description,''))
      ~ '(conej|instituto la paz|patitas enlodadas)'
  );
