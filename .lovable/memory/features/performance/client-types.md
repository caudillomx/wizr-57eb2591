---
name: Client Types (branded vs benchmark)
description: clients.client_type ('branded'|'benchmark') determina UX en Performance — benchmark oculta toggle Marca/Competencia, ignora is_competitor y nombra el reporte 'Análisis Comparativo'
type: feature
---
**Modelo (`public.clients.client_type`):**
- `'branded'` (default) — cliente con marca propia + competencia. UI muestra toggle Marca/Benchmark.
- `'benchmark'` — grupo de cuentas a comparar entre sí (ej. Guanajuato Instituciones, Funcionarios). Sin marca propia.

**Comportamiento en `ClientDetail.tsx` cuando `client_type === 'benchmark'`:**
1. NO se muestra el `ToggleGroup` Marca/Benchmark.
2. `view` queda fijo en `"benchmark"` y todos los perfiles entran al análisis ignorando `is_competitor`.
3. Header muestra un único badge "N perfiles" en lugar de "X marca / Y competencia".
4. `RankingAIChat.rankingName` usa sufijo "(Comparativo)" en vez de "(Marca)" o "(Benchmark)".
5. `TopContentTab.brandName` se pasa como `undefined` para que la IA no privilegie a ninguna cuenta.

**Reporte (`PerformanceReportGenerator` + `usePerformanceReport`):**
- Se introduce `PerformanceReportMode = "brand" | "benchmark" | "comparative"`.
- Cuando `client_type === 'benchmark'`, se envía `reportMode: "comparative"` al hook.
- El backend (`generate-performance-report-async`) sigue recibiendo `reportMode: "benchmark"` (alias) + un campo `clientMode: "comparative"` opcional, para no romper el prompt actual.
- El título cliente se fuerza a `"Análisis Comparativo — {clientName}"` independientemente del título devuelto por la IA.
- `SharedReportKind` agregó `"performance_comparative"` para distinguir links públicos.

**UX de creación (`ClientList.tsx`):**
- El diálogo "Nuevo cliente" pide elegir entre "Cliente con marca propia" y "Grupo de benchmark" via `RadioGroup`.
- Las cards de cliente muestran un mini-badge ("Marca propia" vs "Benchmark") debajo de la descripción.

**Importador FK:** No cambia. El switch `is_competitor` sigue presente, pero su valor se ignora visualmente cuando el cliente es benchmark — útil si después se decide convertirlo en branded.

**Migración SQL (2026-04-21):**
```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'branded'
  CHECK (client_type IN ('branded','benchmark'));
```
