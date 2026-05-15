---
name: Mention Count Sanitizer
description: Anti-alucinación de cifras "N menciones" en reportes; capea narrative.mentions al CONTEO VERIFICADO
type: feature
---
## Sanitizador de cifras "N menciones"

Aplicado en `generate-smart-report/index.ts`:

1. **`sanitizeMentionCounts(text, verifiedCounts, totals, knownProperNames)`** se encadena después de `sanitizeSentimentPercents` en `sp()` para summary, keyFindings, recommendations, conclusions, impactAssessment, sentimentAnalysis, todos los `*Insight`, `entityComparison` y `templates`.
   - Si en ±220 chars del patrón `\d+ menciones?` aparece un término de CONTEOS VERIFICADOS y la cifra se desvía >max(5, 30%) del conteo verificado → reemplaza por `<count> menciones` exacto.
   - Si la cifra no equivale a totales globales (`total/positive/negative/neutral`) ni hay término verificado en contexto pero sí aparece un nombre propio del Enfoque (no verificado) → neutraliza a "varias menciones".
   - Si la cifra es legítima (sub-total de sentimiento o total) o el contexto no nombra ningún elemento del Enfoque, se preserva.

2. **Cap numérico de `narrative.mentions`**: en `safeNarratives.map`, si la narrativa nombra un término de CONTEOS VERIFICADOS, `mentions` se capea al conteo verificado correspondiente (se elige el término más largo que aparece en `narrative + description`). Cap absoluto adicional al `metrics.totalMentions`.

**Por qué**: el modelo escribía "Fundación Patitas Enlodadas con 39 menciones" cuando el conteo real era 25, y "52 menciones" para narrativas con 7 evidencias reales. El sanitizador es la última línea de defensa después de los CONTEOS VERIFICADOS y la regla anti-cifras-no-auditables del prompt.
