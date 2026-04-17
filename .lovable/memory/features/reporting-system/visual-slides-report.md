---
name: Visual Slides Report
description: Reporte tipo presentación 16:9 (10-12 slides) con visor web, descarga PDF landscape, insights interpretativos por slide y recomendaciones estratégicas
type: feature
---
## Reporte Visual (Slides 16:9)

Tercera modalidad de exportación junto a Resumen/Completo. Mismo `SmartReportContent` (sin regenerar IA).

### Arquitectura
- **Builder único**: `src/lib/reports/slidesReportBuilder.ts` genera array de slides HTML 1920×1080 + `fullHtml` para PDF.
- **Visor web**: `src/components/reports/VisualSlidesViewer.tsx` (Dialog fullscreen). Atajos: ←/→/Space, F (fullscreen), Esc.
- **PDF landscape**: edge function `generate-pdf-pdfshift` con `landscape: true` y `format: "1920x1080px"` → 1 slide = 1 página.

### Estilo editorial Wizr (v3)
- **Sandwich**: portada split-screen (dark left con KPIs + white right con logo Wizr grande). Cierre dark con glow violeta + sparkles naranja.
- **Header**: logo Wizr **54px** (antes 34px) en todos los slides de contenido (white bg). Section label en uppercase con tracking 0.25em.
- **Dominio**: `wizr.mx` (no `wizr.com.mx`).
- **Tipografía**: títulos 46-48px (antes 52-56px) para evitar competir con el contenido. KPIs 50-72px. Eyebrows uppercase 12px tracking 0.3em.
- **Padding top**: 160px en slides de contenido para dar aire al header del logo grande.

### Insights interpretativos (NUEVO)
Cada slide analítico tiene un cuadro "Lectura" con párrafo de IA (campo opcional en `SmartReportContent`):
- `timelineInsight` — explica picos/promedios
- `narrativesInsight` — qué dicen las narrativas en conjunto
- `influencersInsight` — concentración y tono de voces top
- `mediaInsight` — encuadre editorial dominante
- `platformsInsight` — dónde se concentra y qué implica

Si el campo viene vacío, el builder genera fallback contextual (ej. timeline calcula pico+promedio).

### Slides rediseñados
- **Hallazgos**: cada card con bloque lateral gradient violet→violetGlow + label semántico (Riesgo/Oportunidad/Tendencia/Señal).
- **Recomendaciones**: cada card con badge de plazo (Inmediato/Corto/Mediano/Seguimiento) en colores semánticos. Subtítulo: "Posicionamiento, riesgo reputacional y oportunidades de incidencia".
- **Cierre**: pill "Conclusión del periodo", glows duales (violet bottom-right + violet top-left), logo Wizr 64px, footer estructurado Wizr|Proyecto.

### Truncados ampliados (anti-corte de texto v2)
- Brief summary: **1600 chars** (font 20px)
- Sentiment interp: **1100 chars** (font 17px)
- Timeline insight: **800 chars**
- Narratives description: **360 chars** (font 13.5px) · narrative title 110 chars
- Lectura (narrativas/influencers/medios/plataformas): **700 chars** (font 15px)
- Hallazgos: **600 chars** (font 19px)
- Recomendaciones: **600 chars** (font 18px)
- Conclusión cierre: **800 chars** (font 42px)

### Sanitización de narrativas
El edge function `generate-smart-report` ahora:
- Fuerza 3-5 narrativas (mínimo 3, máximo 5).
- Sanea `mentions` post-IA: si viene `null`/no numérico, asigna fallback `Math.max(1, Math.round(total/narratives.length/2))`. **Elimina el `null` visible en cards.**
- Saneo idéntico para `sentiment` y `trend` (whitelist).

### Cambios IA (system prompt)
- **Entidades sinónimas**: si `entityNames` representa el mismo sujeto (no distinct por Jaccard), se inyecta bloque que prohíbe enumerarlas tipo "La conversación sobre X, Y, Z…". Usa nombre canónico o descriptor único.
- **Recomendaciones nivel directivo**: PROHIBIDO recomendaciones operativas de monitoreo ("ajustar keywords", "configurar alertas", "agregar fuentes"). SÍ posicionamiento, gestión de riesgo reputacional, oportunidades de incidencia pública, alertas tempranas. Cada recomendación debe contestar: ¿qué decisión?, ¿qué riesgo/oportunidad?, ¿en qué plazo?

### Decisiones técnicas
- SVG inline (cross-render browser/PDFShift sin headless React).
- Footer renumerado dinámicamente con `realTotal` tras filtrar slides condicionales.
- `@page size: 1920px 1080px` para PDFShift respete proporción 16:9.
