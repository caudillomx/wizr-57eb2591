---
name: Unified Smart Report
description: Single unified report type with full generation and Resumen/Completo PDF export options
type: feature
---
## Reporte Inteligente Unificado

### Architecture
- **Single generation**: Always generates the FULL report (4-6pp worth of content)
- **PDF differentiation at export**: Two download buttons (Resumen / Completo)
  - Resumen: trims to top 3 findings, 2 recommendations, 3 narratives, 5 influencers → 1-2pp PDF
  - Completo: exports everything → 4-6pp PDF
- **Web view**: Always shows full content (all narratives, findings, influencers)

### Fixed sections (always present):
1. Brief Ejecutivo (summary)
2. KPIs / Métricas clave (menciones, impresiones, alcance, autores, sentimiento)
3. Análisis de Influenciadores (tabla + análisis)
4. Análisis Narrativo (4-8 narrativas, always)
5. Hallazgos Clave (5-8)
6. Recomendaciones (4-6)

### Conditional sections:
- **Comparación entre entidades**: Only when 2+ entities are **semantically distinct** (Jaccard trigram similarity <0.6)

### Removed:
- Type selector (brief/crisis/thematic/comparative)
- Extension selector (micro/short/medium)
- Format selector moved from generation to PDF download

### Key design decisions:
- Sentiment interpretation uses `strategicContext` + `strategicFocus`
- Entity dedup uses character trigram Jaccard similarity
- `SmartReportConfig.reportFormat` always "full" for generation
- `SmartReportPDFGenerator.pdfFormat` = "summary" | "full" for export
