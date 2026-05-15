---
name: Impressions Reach Calibration
description: Multiplicadores y pisos calibrados para impresiones/alcance estimados (2024-2025 benchmarks)
type: feature
---
## Cálculo de impresiones y alcance estimados

En `src/hooks/useSmartReport.ts`, por cada mención se estima impresiones usando esta jerarquía:

1. **views directas** (raw_metadata.views) si existen
2. **engagement × multiplicador** si hay likes/comments/shares:
   - twitter 35, facebook 45, instagram 40, linkedin 25, **tiktok 60**, **youtube 50**, reddit 30
   - default 30 para plataformas no listadas
3. **PRESS_FLOOR = 1500** para dominios de medios digitales (regex de prensa)
4. **Piso por red** para social sin métricas: twitter 400, facebook 500, instagram 600, linkedin 300, tiktok 800, youtube 700, reddit 350
5. **default 250** para resto

**Alcance estimado = impresiones × 0.70** (antes 0.65).

**Por qué los valores anteriores eran muy conservadores**: el piso de 50 impresiones por post sin métricas era ~1 orden de magnitud por debajo del baseline orgánico real. Multiplicadores antiguos (TikTok 12, YT 8) ignoraban que esos formatos tienen alcance viral por construcción.

**Detección de prensa**: dominio `.com|.mx|.org|.net|.info|.news|.press|.co` que NO sea red social conocida.
