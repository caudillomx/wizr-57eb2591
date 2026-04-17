---
name: Visual Slides Report
description: Reporte tipo presentación 16:9 (10-12 slides) con visor web interactivo y descarga PDF landscape
type: feature
---
## Reporte Visual (Slides 16:9)

Tercera modalidad de exportación junto a Resumen/Completo. Mismo `SmartReportContent` (sin regenerar IA).

### Arquitectura
- **Builder único**: `src/lib/reports/slidesReportBuilder.ts` genera array de slides HTML 1920×1080 + `fullHtml` para PDF.
- **Visor web**: `src/components/reports/VisualSlidesViewer.tsx` (Dialog fullscreen). Reescala con `transform: scale()` para fit. Atajos: ←/→/Space, F (fullscreen), Esc.
- **PDF landscape**: edge function `generate-pdf-pdfshift` extendida con `landscape` y `format` opcionales. Se invoca con `format: "1920x1080px"` y `landscape: true` → 1 slide = 1 página.

### Estilo sandwich
- Slide 1 (portada) y slide final (cierre): fondo oscuro `#0f172a → #1e1b4b` con logo blanco y KPIs gigantes.
- Slides intermedios: fondo claro, accent indigo `#4f46e5`, KPIs de 64px, gráficas SVG inline.

### Slides (orden, condicional según datos)
1. Portada (KPIs gigantes)
2. Brief ejecutivo + 4 KPI cards
3. Pulso de sentimiento (donut SVG + interpretación contextual)
4. Volumen en el tiempo (área SVG con marca de pico)
5. Top narrativas (cards 2/3 cols)
6. Influenciadores top 6
7. Medios digitales top 6
8. Distribución por plataforma (barras horizontales SVG)
9. Hallazgos clave (top 4)
10. Recomendaciones (top 4)
11. Cierre (conclusión)

### Decisiones técnicas
- **SVG inline en vez de Recharts**: funciona idéntico en navegador y en PDFShift sin headless React.
- **Sin React en el builder**: solo template strings, fácil de testear y portable.
- **Footer con paginación dinámica**: se renumera con `realTotal` después de filtrar slides condicionales.
- **`@page` size custom**: `1920px 1080px` en `<style>` para que PDFShift respete proporción 16:9.
