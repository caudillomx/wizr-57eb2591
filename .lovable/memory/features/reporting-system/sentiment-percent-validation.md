---
name: Sentiment Percent Validation
description: Validación y corrección automática de porcentajes de sentimiento alucinados por la IA en reportes
type: feature
---
## Validación de % de sentimiento en Smart Reports

**Problema observado**: el modelo escribía "51.7% de sentimiento positivo" cuando el real era 34.9% (412/1180). Mezclaba "% de la muestra" con "% del universo" inventando valores.

**Mitigaciones en `generate-smart-report/index.ts`**:
1. **Prompt anchoring**: tras el bloque MÉTRICAS se inyecta una regla "⚠️ CIFRAS DE SENTIMIENTO BLOQUEADAS" listando los % exactos (pos/neg/neu) y prohibiendo inventar otros o distinguir muestra vs universo (siempre son iguales en este reporte).
2. **Post-process `sanitizeSentimentPercents()`**: detecta patrones `\d+%\s+(...)?(positiv|negativ|neutral)` y el inverso. Si difieren >2pp del valor real (calculado sobre `metrics.totalMentions`), reemplaza por el verificado.
3. Aplicado a: `summary`, `keyFindings`, `recommendations`, `conclusions`, `impactAssessment`, `sentimentAnalysis`, todos los `*Insight`, `entityComparison` y `templates.executive/technical`.
