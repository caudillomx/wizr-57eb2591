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

### Estilo editorial Wizr (v2)
- **Sandwich**: Portada/cierre con `#0B0A1F` + glow violeta + sparkles naranja. Logo Wizr blanco (filter:invert).
- **Slides contenido**: fondo `#FAFAFC`, header con logo Wizr color + section label, accent violeta `#3D1FD8` y naranja `#FF6B2C`.
- **Tipografía**: Inter, h2 52-56px con tracking -0.025em, KPIs 64-72px con tracking -0.02em, eyebrows uppercase 12px tracking 0.3em.
- **Numeración**: secciones tipo `01 ·`, `02 ·`, footers con padStart(2,'0').
- **Logo Wizr**: importado como base64 en `src/lib/reports/wizrLogoColor.ts` (~120KB) desde `src/assets/wizr-logo-full.png`.

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
