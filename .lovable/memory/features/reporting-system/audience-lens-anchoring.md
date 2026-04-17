---
name: Audience Lens Anchoring
description: Hallazgos y recomendaciones del reporte deben leerse explícitamente a través del Enfoque Estratégico y la audiencia destinataria
type: feature
---
## Lente del destinatario (anclaje al Enfoque Estratégico)

`generate-smart-report` añade al `strategicBlock` una sección "LENTE DEL DESTINATARIO" que obliga a leer cada hallazgo, narrativa, conclusión y recomendación a través de `projectAudience` + `projectObjective` + Enfoque Estratégico:

- ≥5 de 6-8 **hallazgos** deben referenciar nominalmente un elemento del Enfoque (caso, actor, riesgo u oportunidad listada).
- ≥4 de 5-7 **recomendaciones** deben articularse en función del Enfoque (mitigar riesgo descrito, capitalizar oportunidad descrita, anticipar escalamiento del caso conocido).
- `summary` e `impactAssessment` deben abrir explicando qué significa el periodo monitoreado para el Enfoque Estratégico, no solo describir métricas.
- Prohibido entregar bullets genéricos de "mejores prácticas de comunicación" desconectados del Enfoque.

Las instrucciones de `keyFindings` y `recommendations` en `formatInstructions` repiten el requisito en su estructura interna (la "implicación estratégica" debe leerse en clave del Enfoque y nombrar el elemento que la motiva).
