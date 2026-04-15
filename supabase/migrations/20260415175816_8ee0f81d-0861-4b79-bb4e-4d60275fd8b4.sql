
-- Archive false-positive mentions in Zaga project that don't contain any relevant keyword
UPDATE mentions
SET is_archived = true
WHERE project_id = 'f40526c1-b2a3-40ec-8500-d2daee41e649'
  AND LOWER(COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || url) NOT LIKE '%zaga%'
  AND LOWER(COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || url) NOT LIKE '%tawil%';
