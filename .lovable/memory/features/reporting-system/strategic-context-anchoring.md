---
name: Strategic Context Anchoring (Antihallucination)
description: Reportes anclan narrativas al Enfoque Estratégico y prohíben "nuevo/otro/adicional" para casos ya descritos
type: feature
---
## Anclaje al Enfoque Estratégico (Antialucinación)

`generate-smart-report` aplica tres capas para evitar que la IA invente eventos:

1. **Pre-extracción de casos conocidos**: Regex sobre `strategicContext` + `strategicFocus` extrae litigios, casos, disputas, demandas, controversias, investigaciones, acusaciones, fraudes y nombres propios. Se inyectan como lista `CASOS/HECHOS/ENTIDADES CONOCIDOS` en el prompt.

2. **Anclaje obligatorio**: Cuando una narrativa coincide temáticamente con un caso conocido, la IA DEBE referenciarla con frases como "vinculada al [caso] descrito en el Enfoque Estratégico", nunca como evento independiente.

3. **Prohibición léxica**: PROHIBIDO usar "nuevo", "otro", "adicional", "segundo", "distinto", "emergente" o "separado" para hechos/litigios/fraudes/casos que estén o sean subsumibles en el Enfoque. Ante ambigüedad → asumir que es el mismo caso.

Aplica al `systemPrompt` como REGLA CRÍTICA #2, junto a la regla de lenguaje cauteloso.
