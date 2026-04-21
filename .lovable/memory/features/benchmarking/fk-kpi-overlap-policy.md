---
name: FK KPI Overlap Policy
description: Importador FK pre-valida solapamientos de rangos en fk_profile_kpis — identidad exacta (period_start+period_end) = upsert natural; rangos que intersectan pero difieren = aviso global con opciones Reemplazar / Conservar ambos / Cancelar
type: feature
---
La clave de conflicto del upsert es `(fk_profile_id, period_start, period_end)`. Esto significa que dos rangos distintos que terminan el mismo día (ej: "última semana" 7d vs "últimas 7 semanas" 50d) coexisten como snapshots diferentes y ensucian las series visualizadas.

**Política (FKExcelImporter.tsx → `handleImport` + `runImport(replaceOverlaps)`):**

1. Antes de escribir, el importador lee todos los Excels de tipo KPIs y construye la lista `(network, displayName, periodStart, periodEnd)` candidatos.
2. Consulta `fk_profile_kpis` existentes del cliente y detecta **solapamientos**: `ek.period_start <= incoming.period_end && ek.period_end >= incoming.period_start` **y** rango no idéntico.
3. Si hay solapamientos → muestra `AlertDialog` global con resumen (máx 20 ítems) y tres opciones:
   - **Reemplazar** (recomendado): `runImport(true)` borra los snapshots solapados no idénticos antes del upsert.
   - **Conservar ambos**: `runImport(false)` procede con upsert clásico (coexisten varios snapshots terminando el mismo día).
   - **Cancelar**: cierra el diálogo sin importar.
4. Si no hay solapamientos → importa directo sin preguntar.

**Criterio de dedup histórica (migración 2026-04-21):**
Cuando limpiamos duplicados preexistentes, conservamos el snapshot de **rango más corto** (más granular). Si hay empate en granularidad, el más reciente por `fetched_at`. Se aplicó a todos los perfiles (clientes + rankings).

**Por qué no bloquear:**
El usuario a veces quiere mantener ambos rangos (ej. para comparar la evolución semanal contra la mensual en el reporte). El bloqueo forzado es fricción innecesaria cuando el importador ya los puede coexistir.
