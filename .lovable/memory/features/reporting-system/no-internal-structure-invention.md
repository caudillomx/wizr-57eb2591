---
name: No Internal Structure Invention
description: Reportes prohíben inventar áreas/direcciones/voceros internos y cifras no auditables tipo "X menciones en universo total de Y"
type: feature
---
## Regla Crítica #3 — No inventar estructura organizacional

`generate-smart-report` PROHÍBE inventar:
- Áreas/direcciones internas: "Dirección de Comunicación Corporativa", "Área de Asuntos Públicos", "Vocería oficial", "Equipo Legal", "Comité de Crisis", etc.
- Atribuciones de liderazgo o responsabilidad ("liderado por X", "coordinado desde Y") salvo que aparezcan textualmente en CONTEXTO ESTRATÉGICO o menciones.
- Nombres propios de funcionarios/voceros no documentados.

Sustituir por formulaciones neutras: "se sugiere que el área responsable evalúe...", "convendría que la organización defina la vocería...", "el equipo a cargo de comunicación estratégica podría considerar...".

## Refuerzo Regla #1 — Cifras compuestas auditables

PROHIBIDO construir frases del tipo "el término X fue mencionado en N ocasiones en el universo total de M menciones" salvo que:
- N esté en CONTEOS VERIFICADOS para X.
- M sea exactamente `metrics.totalMentions` del reporte.

PROHIBIDO derivar interpretaciones cuantitativas ("baja vinculación", "alta concentración", porcentajes) si numerador o denominador no son auditables.

## Narrativas: piso 4

`narratives` ahora exige OBLIGATORIO 4-5 (antes 3-5 → la IA convergía a 3). Si el tema parece monolítico, debe descomponer ángulos secundarios: encuadre mediático, reacción de audiencias, dimensión regulatoria, reputacional, redes vs prensa.
