---
name: Mention Relevance Trigger v2
description: Trigger BEFORE INSERT en mentions exige frase exacta o ≥2 tokens significativos distintos
type: feature
---
## Trigger `enforce_mention_relevance` v2

`BEFORE INSERT` en `public.mentions`. Lógica:

1. Construye `haystack` normalizado (sin acentos, lowercase) con title + description + url + source_domain + matched_keywords.
2. Recolecta frases significativas (≥3 chars) desde `entities.palabras_clave`, `aliases`, `nombre` y `platform_keywords` (jsonb arrays) del proyecto activo.
3. **Match por frase**: si alguna frase con ≥4 chars aparece literal en el haystack → acepta.
4. **Fallback ≥2 tokens distintos**: tokeniza las frases (≥3 chars, sin stopwords ES/EN) y exige ≥2 tokens DISTINTOS presentes en el haystack. Si no, descarta silenciosamente (`RETURN NULL`).
5. Si el proyecto no tiene entidades → no filtra.

**Antes** bastaba con un solo token (p.ej. "puebla" o "animal") → mucho ruido. **Ahora** se requieren al menos dos señales distintas, lo que reduce drásticamente falsos positivos en proyectos con keywords genéricas.

Migración: `20260515_*_enforce_mention_relevance_v2.sql`.
