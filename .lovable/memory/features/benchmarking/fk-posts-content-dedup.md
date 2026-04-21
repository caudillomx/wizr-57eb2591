---
name: FK Posts Content Dedup
description: fk_posts se deduplica por external_id Y por content fingerprint (fk_profile_id + published_at + message[0:200] + link) — FK exporta el mismo post con external_id distintos entre exports y rompe el upsert por (fk_profile_id, external_id)
type: feature
---
**Problema observado:** El upsert original usaba solo `(fk_profile_id, external_id)` como clave de conflicto. Pero los Excel de Fanpage Karma asignan IDs internos diferentes al mismo post entre exports (vimos external_id `120` y `156` con mismo `published_at` + `message` idéntico). Resultado: 88 duplicados en BD del cliente Actinver.

**Solución (FKExcelImporter.tsx → handleImport rama posts):**
1. Antes de armar el payload, se cargan los `(fk_profile_id, published_at, message[0:200], link)` ya existentes en `fk_posts` para los perfiles afectados.
2. Para cada post nuevo, se computa su content fingerprint y se descarta si ya existe en BD o en el batch en curso.
3. Sigue siendo un upsert por `(fk_profile_id, external_id)` para idempotencia natural cuando el ID sí coincide.

**Limpieza histórica (2026-04-21):**
```sql
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY fk_profile_id, published_at, COALESCE(LEFT(message, 200), ''), COALESCE(link, '')
    ORDER BY imported_at ASC, id ASC
  ) AS rn FROM public.fk_posts
)
DELETE FROM public.fk_posts WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```
Conservamos el más antiguo importado.

**Por qué `LEFT(message, 200)`:** Mensajes largos (posts de LinkedIn con miles de caracteres) hacen el fingerprint pesado; los primeros 200 chars son suficientes para detectar duplicados reales.
