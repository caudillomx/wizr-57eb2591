---
name: Severity Calibration
description: Anti-alarmismo en reportes — severidad requiere amplificación medible (engagement, tier-1), no solo % negativo
type: feature
---
## Calibración de severidad reputacional

`generate-smart-report` calcula `severityLevel` antes del prompt usando:
- `totalEngagement` = Σ(likes+comments+shares) de toda la muestra
- `maxAuthorEngagement` = engagement acumulado por el autor top
- `tier1Mentions` = menciones en medios tier-1 (regex curado: reforma, milenio, eluniversal, animalpolitico, infobae, forbes, heraldodemexico, etc.)

Umbrales:
- **severa**: totalEngagement ≥50k OR maxAuthor ≥20k OR tier1 ≥5
- **potencialmente_critica**: ≥10k / ≥5k / ≥2
- **atencion**: ≥2k / ≥1k / ≥1 OR total ≥100
- **monitoreo**: por debajo

El nivel se inyecta en `detailedAnalysis` como `=== SEÑALES DE AMPLIFICACIÓN MEDIDAS ===` y la REGLA CRÍTICA #5 del prompt obliga a usar el vocabulario correspondiente:
- SEVERA → "crisis", "impacto severo" permitidos
- POTENCIALMENTE CRITICA → "riesgo latente", "potencial de escalamiento"; PROHIBIDO "crisis severa"
- ATENCION → "conversación negativa que conviene monitorear"; PROHIBIDO "crisis", "severo", "viralización"
- MONITOREO → "señal temprana"; PROHIBIDO vocabulario de crisis

Reglas adicionales: "viral" exige cifra concreta (views/shares ≥5k); 60-80% negativo en <100 menciones sin amplificación NO es crisis.

**Por qué**: el modelo etiquetaba "impacto reputacional severo" para 41 menciones sin influencers ni cobertura tier-1, solo porque el % negativo era alto.
