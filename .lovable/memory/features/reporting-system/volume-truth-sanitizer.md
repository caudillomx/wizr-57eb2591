---
name: Volume Truth Sanitizer
description: Bloquea cifras de menciones alucinadas (por día/plataforma/fuente) en Smart Reports usando ground-truth sobre el universo completo
type: feature
---
## Problema
IA escribía "100 menciones el 17 de mayo" / "78 menciones Facebook" cuando el pico real era 40 y el universo total era ~120. Mezclaba cifras de muestra/universo y se inventaba sub-totales.

## Mitigación en `generate-smart-report/index.ts`
1. **Ground truth block**: antes del prompt se calculan conteos REALES sobre TODAS las menciones (no muestra): por plataforma, por día, por fuente, por autor. Se inyecta `=== VOLUMEN VERIFICADO ===` con total absoluto, pico diario real y top plataformas/fuentes.
2. **`sanitizeMentionCounts` v2**:
   - Si `N > totals.total` → capear al total real (cifra > universo = alucinación).
   - Se pasa `allowedExtra` con todos los conteos auditados (plataforma/día/fuente/autor). Si la cifra coincide, pasa.
   - Catch-all: cualquier `N menciones` con N≥5 que no coincida con ningún conteo verificado/auditado → se neutraliza a "varias menciones" (antes solo neutralizaba si había nombre propio del Enfoque en contexto).
3. Aplicado a summary, hallazgos, recomendaciones, conclusiones, narrativas, todos los insights y templates.
