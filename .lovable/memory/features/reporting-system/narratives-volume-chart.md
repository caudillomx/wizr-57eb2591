---
name: Narratives Volume Chart (3 surfaces)
description: Gráfica de barras verticales por narrativa, coloreada por sentimiento, presente en reporte web, PDF y visual slides
type: feature
---
## Gráfica de volumen por narrativa

Cada narrativa identificada por la IA se grafica en barras verticales mostrando volumen absoluto + porcentaje. Color de la barra según sentimiento dominante de la narrativa: verde (positivo), rojo (negativo), ámbar #F59E0B (mixto), gris (neutral).

Identificador estable: `N01`, `N02`, ... `N05` (también visible en cards y leyenda).

### Implementaciones

1. **Web** (`src/components/reports/SmartReportGenerator.tsx`): Recharts `BarChart` vertical con `Cell` por sentimiento, `LabelList` mostrando "valor · pct%", tooltip personalizado con nombre completo. Leyenda inferior con N# + título de narrativa.

2. **PDF** (`src/components/reports/SmartReportPDFPreview.tsx`): SVG inline (viewBox 720x220) en la sección "Principales Narrativas", con grid 4 líneas, etiquetas N1-N5, leyenda de colores, valor + % sobre cada barra. Cards debajo con badge `N#`.

3. **Visual Slides** (`src/lib/reports/slidesReportBuilder.ts` → `svgVerticalBarsNarratives` + `slideNarratives`): SVG 1700x320 dentro de panel `paperAlt`, con leyenda de sentimientos arriba a la derecha. Cards 2-3 columnas debajo, más compactas (16px título, 12.5px desc, 240 chars).

### Denominador del porcentaje

Suma de `mentions` de las narrativas (no `metrics.totalMentions`), para que las barras siempre sumen 100% entre sí y el lector entienda la proporción dentro del análisis narrativo.
