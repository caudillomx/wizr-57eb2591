---
name: Unified Smart Report
description: Single unified report type replacing brief/crisis/thematic/comparative, with summary vs full format
type: feature
---
## Reporte Inteligente Unificado

Replaced 4 report types (brief, crisis, thematic, comparative) with a single unified report that adapts to content.

### Fixed sections (always present):
1. Brief Ejecutivo (summary)
2. KPIs / Métricas clave (menciones, impresiones, alcance, autores, sentimiento)
3. Análisis de Influenciadores (tabla + análisis)
4. Análisis Narrativo (siempre, no condicional)
5. Hallazgos Clave
6. Recomendaciones

### Conditional sections:
- **Comparación entre entidades**: Only when 2+ entities are **semantically distinct** (Jaccard trigram similarity <0.6). "Rafael Saga Taguil" / "saga taguil" are treated as same entity → no comparison generated.

### Two formats (no manual extension selector):
- **Resumen** (`summary`): 1-2 pages, concise, for quick sharing
- **Reporte Completo** (`full`): 4-6 pages, exhaustive analysis

### Key design decisions:
- Extension selector removed (was micro/short/medium)
- Type selector removed (was brief/crisis/thematic/comparative)
- Sentiment interpretation uses `strategicContext` + `strategicFocus` — negative sentiment toward external actors may be positive for the client
- Entity dedup uses character trigram Jaccard similarity to avoid vacuous comparisons
- `ReportFormat` type = "summary" | "full"
