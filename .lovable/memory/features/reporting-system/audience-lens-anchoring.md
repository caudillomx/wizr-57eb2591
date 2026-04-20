---
name: Audience Lens Anchoring (no literal mention)
description: La audiencia/cargo se usa para priorizar e interpretar el reporte, NUNCA se nombra literalmente. Hallazgos anclan al Enfoque por contenido textual del caso/actor, no por la etiqueta "Enfoque Estratégico".
type: feature
---
## Lente de audiencia: uso interno, no literal

Aplicado en `generate-smart-report` (prompt + sanitizer + fallbacks):

1. **Audiencia es lente, no texto**: PROHIBIDO escribir "para [Audiencia]", "relevante para Director Ejecutivo", "que conviene leer con prioridad para [cargo]", "lo que le importa a [cargo]". El reporte se redacta DIRECTAMENTE para esa audiencia (tono ejecutivo en tercera persona), no la nombra.
2. **Anclaje real al Enfoque**: cuando un hallazgo conecta con el Enfoque, debe nombrar literalmente el caso/actor/riesgo del bloque ENFOQUE ESPECÍFICO. Escribir solo el rótulo "Enfoque Estratégico" se considera anclaje vacío.
3. **Mínimos de anclaje**: ≥5 de 6-8 hallazgos y ≥4 de 5-7 recomendaciones deben citar nominalmente un elemento textual del Enfoque (caso/actor/riesgo/oportunidad listada). `summary` e `impactAssessment` abren con qué significa el periodo para el caso del Enfoque, sin nombrar audiencia.
4. **Sanitizer ampliado** (`sanitizeFindingText`): elimina colas in-sentence "...que conviene leer con prioridad para X", "...relevante para X", "...le importa a X", "...para el Director/Gerente/CEO/equipo X/área X" antes de cortar oraciones meta.
5. **Fallback alineado**: el bullet de distribución de sentimiento ya no menciona "Director Ejecutivo" ni audiencia; cierra con consecuencia ejecutiva ("define el encuadre dominante de la ventana monitoreada").
6. **Editor manual extendido**: `Evaluación de Impacto` y `Análisis de Sentimiento` son editables inline en `ReportAnalyticsCharts` cuando `editing` está activo en `SmartReportGenerator`. Los cambios se propagan a PDF, link público y vista visual via `activeReport`.
