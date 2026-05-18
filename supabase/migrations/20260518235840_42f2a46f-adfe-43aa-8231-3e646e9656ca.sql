
UPDATE public.mentions
SET published_at = '2026-05-15T22:01:21+00:00',
    raw_metadata = COALESCE(raw_metadata, '{}'::jsonb) || jsonb_build_object('date_source','firecrawl_manual_backfill','date_confidence','high')
WHERE project_id = '54a247be-2ea8-4503-a55e-ca4b0ad769e3'
  AND url = 'https://www.diariocambio.com.mx/2026/municipios/puebla-municipios/acusan-a-maestro-y-alumnos-del-instituto-la-paz-de-sacrificar-y-desmembrar-animales-en-clase/'
  AND published_at IS NULL;
