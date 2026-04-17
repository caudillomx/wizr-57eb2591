---
name: Strategic Context Anchoring (Antihallucination)
description: Reportes anclan narrativas al Enfoque Estratégico, prohíben "nuevo/otro/adicional" y usan conteos verificados deterministas
type: feature
---
## Anclaje al Enfoque Estratégico (Antialucinación)

`generate-smart-report` aplica cuatro capas para evitar que la IA invente eventos o cifras:

1. **Pre-extracción de casos conocidos**: Regex sobre `strategicContext` + `strategicFocus` extrae litigios, casos, disputas, demandas, controversias, investigaciones, acusaciones, fraudes y nombres propios. Se inyectan como lista `CASOS/HECHOS/ENTIDADES CONOCIDOS` en el prompt.

2. **Pre-conteo determinístico (CONTEOS VERIFICADOS)**: Para cada término canónico (sustantivos propios extraídos de casos conocidos + `entityNames`), se cuenta sobre el UNIVERSO COMPLETO de menciones (no la muestra) cuántas contienen el término en title/description/matched_keywords con `\bTERM\b` insensitive y normalización NFD. Los conteos se inyectan como `CONTEOS VERIFICADOS` con reglas estrictas:
   - Si una narrativa toca un término listado → DEBE usar el número exacto.
   - Si un término NO está listado → PROHIBIDO inventar cifra exacta; usar lenguaje cualitativo ("varias menciones", "presencia recurrente", "porción minoritaria").
   - PROHIBIDO afirmar "una sola mención", "solo X" para términos no verificados.

3. **Anclaje obligatorio**: Cuando una narrativa coincida temáticamente con un caso conocido, la IA DEBE referenciarla con frases como "vinculada al [caso] descrito en el Enfoque Estratégico", nunca como evento independiente.

4. **Prohibición léxica**: PROHIBIDO usar "nuevo", "otro", "adicional", "segundo", "distinto", "emergente" o "separado" para hechos/litigios/fraudes/casos que estén o sean subsumibles en el Enfoque. Ante ambigüedad → asumir que es el mismo caso.

Aplica al `systemPrompt` como REGLA CRÍTICA #1 (cifras auditables) y #2 (anclaje + prohibición léxica).
