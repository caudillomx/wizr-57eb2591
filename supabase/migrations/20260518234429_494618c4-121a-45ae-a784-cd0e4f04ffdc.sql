UPDATE public.entities
SET palabras_clave = ARRAY[
  'Instituto La Paz Puebla',
  'Instituto La Paz',
  'conejita',
  'Justicia para conejita',
  'disección Instituto La Paz',
  'tortura animal Puebla preparatoria',
  'crueldad animal Instituto La Paz',
  'maltrato animal preparatoria Puebla'
],
platform_keywords = jsonb_build_object(
  'twitter', jsonb_build_array('#JusticiaParaConejita', '#InstitutoLaPaz', 'Instituto La Paz'),
  'instagram', jsonb_build_array('#justiciaparaconejita', '#institutolapaz'),
  'facebook', jsonb_build_array('Instituto La Paz Puebla', 'Justicia para conejita'),
  'tiktok', jsonb_build_array('#justiciaparaconejita', 'Instituto La Paz')
),
updated_at = now()
WHERE id = 'aaf62166-f79c-414c-9a0e-2efd4cf42bd6';