---
name: Influencers vs Media Outlets Split
description: Reportes separan dos tablas — Influenciadores en redes sociales y Medios digitales — con criterio híbrido
type: feature
---
## Separación Influenciadores vs Medios Digitales

`useSmartReport.computeAnalytics` clasifica cada mención en una de dos tablas:

### Criterio híbrido
1. Dominio en lista de redes sociales conocidas (twitter/x, facebook, instagram, tiktok, youtube, reddit, linkedin) **+ autor identificable** → `influencers`
2. Dominio en `KNOWN_MEDIA_BRANDS` → `mediaOutlets`
3. Resto: si no es red social y tiene título de artículo → `mediaOutlets`; si tiene autor con @ en red social → `influencers`

### Estructura
- `InfluencerInfo`: name, username, avatar, platform, mentions, sentiment dominante, reach (interacciones)
- `MediaOutletInfo`: name (formateado vía KNOWN_MEDIA_BRANDS), domain, articles, sentiment dominante (pos/neg/neutral/mixto por mayoría >50%), positive/negative/neutral counts, lastPublishedAt

### Renderizado
- **Web** (`ReportAnalyticsCharts.tsx`): dos `Card` consecutivas — "Influenciadores de la Conversación" y "Medios Digitales en la Conversación"
- **PDF** (`printReportBuilder.ts`): dos secciones — "Influenciadores en Redes Sociales" y "Medios Digitales de Amplio Alcance"
- **PDF Resumen**: top 5 de cada tabla; **PDF Completo**: hasta 20 de cada una

### Catálogo de medios conocidos
Definido inline en `useSmartReport.ts` (sincronizado con `mentionAuthors.ts`): elfinanciero, eleconomista, expansion, reforma, eluniversal, milenio, excelsior, jornada, forbes, bloomberg, reuters, informador, proceso, animalpolitico, aristeguinoticias, sinembargo, sdpnoticias, hrratings, cbonds, polemon, infobae, elpais.
