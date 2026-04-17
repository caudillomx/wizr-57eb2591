---
name: Keywords Cloud (3 surfaces)
description: Nube de términos destacados con chips escalados por frecuencia y coloreados por sentimiento, presente en reporte web, PDF y visual slides
type: feature
---
## Nube de términos destacados

La IA del reporte (`generate-smart-report`) devuelve un campo `keywords[{term, count, sentiment}]` con 18-25 conceptos clave del periodo. Filtrado server-side de stopwords ES/EN, exclusión de artículos/preposiciones/pronombres/auxiliares, deduplicación normalizada (NFD + lowercase) y orden por frecuencia descendente. Acompañado de `keywordsInsight` (2-3 oraciones).

### Visualización: Chips escalados

- Tamaño tipográfico proporcional a frecuencia (`12-26px` web, `10-19px` PDF, `22-58px` slide).
- Color por sentimiento: verde (positivo), rojo (negativo), ámbar (mixto), gris (neutral).
- Forma: pill/badge redondeado con borde, contador en superíndice pequeño.

### Implementaciones

1. **Web** (`SmartReportGenerator.tsx`): Card con chips flex-wrap centrados, leyenda inferior, `keywordsInsight` como bloque italicizado bordered-left.
2. **PDF** (`SmartReportPDFPreview.tsx`): Sección "Términos Destacados" antes de Recomendaciones. Chips inline-flex con colores ECFDF5/FEF2F2/FFF7ED/F1F5F9.
3. **Visual Slides** (`slidesReportBuilder.ts` → `slideKeywordsCloud`): Slide 05 dedicado, panel `paperAlt`, leyenda + insight side-by-side abajo.

### Fuente única de verdad

La IA es la única fuente de keywords. Cliente no recalcula localmente — garantiza consistencia entre los 3 reportes y respeta el contexto estratégico del proyecto.
