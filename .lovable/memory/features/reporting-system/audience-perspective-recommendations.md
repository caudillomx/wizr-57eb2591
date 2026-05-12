---
name: Audience Perspective for Recommendations
description: Recommendations adapt tone to whether audience is institutional, external participant, or observer
type: feature
---
## Perspectiva de la audiencia (Reportes inteligentes)
El generador clasifica `projectAudience` + `projectObjective` en una de tres categorías y adapta las recomendaciones:

- **A) Institucional / Vocería oficial** (gobierno, marca monitoreada, equipo de prensa): puede ordenar respuesta institucional, definir postura rectora, coordinar vocería.
- **B) Participante externo / Sociedad civil / Privado** (activistas, empresarios, candidatos, ONG, líderes sociales, comunicadores independientes): NO controla la entidad monitoreada. Recomendaciones se redactan para ENTRAR a la conversación con voz propia, contenidos, alianzas, presencia digital. PROHIBIDO sugerir "intervenir", "postura rectora", "área de asuntos públicos", "respuesta institucional".
- **C) Observador / Analista**: documenta, no interviene.

Regla dura: si la audiencia no es claramente A, nunca asumir autoridad institucional. Fórmulas prohibidas fuera de A: "área de comunicación estratégica", "dirección responsable", "respuesta institucional", "postura rectora", "coordinar vocería oficial".

Implementado en `supabase/functions/generate-smart-report/index.ts` bajo el bloque `PERSPECTIVA DE LA AUDIENCIA`.
