-- Helper: normaliza texto (lowercase + strip accents básicos español)
CREATE OR REPLACE FUNCTION public.normalize_text(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT translate(lower(coalesce(_t, '')),
                   'áéíóúñàèìòùâêîôûäëïöüÁÉÍÓÚÑ',
                   'aeiounaeiouaeiouaeiouAEIOUN')
$$;

-- Trigger: descarta menciones sin tokens fuertes del proyecto
CREATE OR REPLACE FUNCTION public.enforce_mention_relevance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  haystack text;
  raw_tokens text[];
  significant_tokens text[];
  significant_phrases text[];
  tok text;
  has_match boolean := false;
  STOPWORDS text[] := ARRAY[
    'de','la','el','los','las','un','una','unos','unas','y','o','u','a','en','del',
    'al','por','para','con','sin','sobre','entre','que','es','se','lo','su','sus',
    'the','of','and','or','in','on','for','to','with','by','at','is','are','be','an'
  ];
BEGIN
  -- Construye el haystack normalizado (título + descripción + url + matched_keywords + dominio)
  haystack := normalize_text(
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.url, '') || ' ' ||
    coalesce(NEW.source_domain, '') || ' ' ||
    coalesce(array_to_string(NEW.matched_keywords, ' '), '')
  );

  -- Recolecta todos los tokens/frases del proyecto desde sus entidades activas
  WITH ent AS (
    SELECT palabras_clave, aliases, platform_keywords, nombre
    FROM entities
    WHERE project_id = NEW.project_id AND activo = true
  ),
  flat AS (
    SELECT normalize_text(unnest(palabras_clave)) AS phrase FROM ent
    UNION ALL
    SELECT normalize_text(unnest(aliases)) FROM ent
    UNION ALL
    SELECT normalize_text(nombre) FROM ent
    UNION ALL
    SELECT normalize_text(jsonb_array_elements_text(value))
      FROM ent, jsonb_each(platform_keywords)
      WHERE jsonb_typeof(value) = 'array'
  )
  SELECT array_agg(DISTINCT phrase) INTO significant_phrases
  FROM flat
  WHERE phrase IS NOT NULL AND length(phrase) >= 3;

  -- Si el proyecto no tiene entidades configuradas, no filtramos nada
  IF significant_phrases IS NULL OR array_length(significant_phrases, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Match por frase completa (ej. "instituto la paz")
  FOREACH tok IN ARRAY significant_phrases LOOP
    IF length(tok) >= 4 AND position(tok IN haystack) > 0 THEN
      has_match := true;
      EXIT;
    END IF;
  END LOOP;

  -- 2) Match por token individual significativo (≥3 chars y no stopword)
  IF NOT has_match THEN
    SELECT array_agg(DISTINCT t) INTO significant_tokens
    FROM (
      SELECT unnest(string_to_array(phrase, ' ')) AS t
      FROM unnest(significant_phrases) AS phrase
    ) sub
    WHERE length(t) >= 3 AND NOT (t = ANY(STOPWORDS));

    IF significant_tokens IS NOT NULL THEN
      FOREACH tok IN ARRAY significant_tokens LOOP
        IF position(tok IN haystack) > 0 THEN
          has_match := true;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Sin coincidencia → descarta silenciosamente (no rompe upserts)
  IF NOT has_match THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mention_relevance_trigger ON public.mentions;
CREATE TRIGGER enforce_mention_relevance_trigger
  BEFORE INSERT ON public.mentions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_mention_relevance();