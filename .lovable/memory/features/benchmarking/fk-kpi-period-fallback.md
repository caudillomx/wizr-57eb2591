---
name: FK KPI Period Fallback
description: useFKProfileKPIs devuelve fallback al snapshot más reciente cuando el filtro de fecha no cubre algunos perfiles — evita tabla de ranking vacía cuando Excels importados son semanales/mensuales y filtro pide un día puntual
type: feature
---
**Problema:** Los Excels de Fanpage Karma se exportan en rangos semanales o mensuales. Si el usuario importa un snapshot `2026-04-13 → 2026-04-19` y el filtro de Performance está en "Ayer" (2026-04-20), el overlap (`period_start <= 04-20 AND period_end >= 04-20`) falla porque el snapshot terminó el 19. La tabla aparece vacía aunque hay datos cargados.

**Solución (`src/hooks/useFanpageKarma.ts` → `useFKProfileKPIs`):**
1. Ejecuta el query con overlap normal por `(period_start, period_end)`.
2. Identifica perfiles que NO quedaron cubiertos por el filtro.
3. Para esos perfiles hace una segunda query con `ORDER BY period_end DESC, fetched_at DESC` y toma el snapshot más reciente disponible.
4. Devuelve la unión: KPIs filtrados + fallback de últimos snapshots.

**Default de período en Performance:** Cambiamos `ClientDetail.tsx` de `"1d"` a `"7d"` porque la cadencia natural de FK es semanal — alinea el preset con la realidad de los datos.

**Diferencia con Benchmarking (Rankings):** Allá la sincronización es diaria via `scheduled-ranking-sync` y el default `"1d"` sigue siendo correcto. Esto solo aplica a clientes de Performance que dependen de Excel manuales.
