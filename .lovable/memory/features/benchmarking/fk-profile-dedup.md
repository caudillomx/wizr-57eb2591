---
name: FK Profile Deduplication
description: Perfiles FK por cliente se deduplican por tripleta (client_id, network, display_name normalizado lowercase+trim) — permite múltiples marcas en misma red, prohíbe duplicados de misma marca con distinto profile_id format
type: feature
---
La tabla `fk_profiles` tiene un índice único parcial `fk_profiles_client_network_name_unique` sobre `(client_id, network, display_name_normalized)` cuando `client_id IS NOT NULL`.

`display_name_normalized` es una columna generada (`lower(btrim(coalesce(display_name, profile_id)))`).

**Por qué tripleta y no (client_id, network):**
Un cliente puede tener varias marcas en la misma red (ej: Banorte y Actinver, ambos con Facebook propio en Benchmark). Restringir por (client_id, network) rompería ese caso.

**Por qué incluir display_name normalizado:**
Los Excel de FK exportan `profile_id` en formatos inconsistentes (numeric ID `533264953527820`, handle `@banorte`, nombre técnico). Sin normalizar por display_name se generaban duplicados.

**Importador (`FKExcelImporter.tsx`):**
Tanto la rama KPIs como Posts resuelven perfiles existentes por `(network, normalizeKey(display_name || profile_id))` antes de insertar. Las migraciones consolidaron duplicados existentes reasignando KPIs/posts/top posts al perfil canónico (más antiguo) por grupo.

**UI (`RankingTable.tsx`):**
Muestra `display_name` como nombre principal y la red como badge. El `profile_id` técnico queda solo en `title` (tooltip).
