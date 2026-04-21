---
name: FK KPI Period Fallback
description: useFKProfileKPIs marca isFallback=true cuando el snapshot devuelto está fuera del rango filtrado; la UI (RankingTable) muestra badge ámbar con el período real, rojo si >90 días
type: feature
---
**Problema:** Los Excels de Fanpage Karma se exportan en rangos semanales o mensuales. Si el usuario filtra por un día puntual fuera del rango exacto del snapshot, el overlap (`period_start <= end AND period_end >= start`) falla y la tabla aparece vacía aunque hay datos cargados. Si simplemente devolvemos el snapshot más reciente, el filtro deja de tener efecto visible y todos los KPIs/insights se ven iguales sin importar qué rango pidas.

**Solución (`src/hooks/useFanpageKarma.ts` → `useFKProfileKPIs`):**
1. Query principal con overlap por `(period_start, period_end)`.
2. Identifica perfiles no cubiertos por el filtro.
3. Para esos hace una segunda query `ORDER BY period_end DESC, fetched_at DESC` y toma el snapshot más reciente.
4. Marca cada KPI de fallback con `isFallback: true` (campo opcional en `FKProfileKPI`).
5. Devuelve la unión: KPIs reales del rango + fallback marcado.

**UI (`src/components/rankings/RankingTable.tsx` → `FallbackBadge`):**
- Cada fila cuyo KPI tiene `isFallback === true` muestra un badge junto al nombre con el período real del snapshot (ej. "13–19 abr").
- Color ámbar suave por defecto, rojo (`destructive/10`) si el snapshot tiene más de 90 días (`differenceInDays(now, period_end) > 90`).
- Tooltip explica que el dato está fuera del rango filtrado y muestra antigüedad cuando es stale.
- Si la fila tiene KPI dentro del rango (no es fallback), no se muestra badge — coexisten filas exactas y fallback en la misma tabla.

**Propagación de fechas (`ClientDetail.tsx`):**
- `appliedPreset` / `appliedCustomRange` solo cambian al pulsar "Aplicar" en `RankingDateFilter` (no se re-fetchea al mover el selector).
- `periodStart` / `periodEnd` derivados se pasan a `useFKProfileKPIs` y `useFKTopPosts`. `useFKAllKPIs` se queda sin filtrar a propósito (alimenta tendencias y evolución que necesitan histórico completo).
- Los componentes hijos (`RankingInsightsPanel`, `RankingTable`, `RankingChart`, `TopContentTab`, `NarrativesAnalysisPanel`, `PerformanceReportGenerator`) reciben `kpis` / `dateRange` como props — no tienen estado de fecha local.

**Default de período en Performance:** `ClientDetail.tsx` usa `"7d"` por defecto porque la cadencia natural de FK es semanal — alinea el preset con la realidad de los datos.

**Diferencia con Benchmarking (Rankings):** En `RankingDetail` la sincronización es diaria via `scheduled-ranking-sync` y el default `"1d"` sigue siendo correcto. El badge de fallback aplica también allí porque comparten el mismo hook.
