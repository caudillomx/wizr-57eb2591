---
name: Findings Editorial Quality (Anti-Cliché)
description: Reglas anti-plantilla en hallazgos: umbrales de tracción, contenido del pico, varianza de anclaje, prohibición de cierres meta
type: feature
---
## Reglas anti-cliché en hallazgos del reporte

Aplicadas en `generate-smart-report` (REGLA CRÍTICA #4 + fallbacks):

1. **Umbral de "tracción"**: bullet de "voces" solo si autores top tienen ≥3 menciones O ≥500 interacciones acumuladas. Por debajo de eso, se omite o se reformula como "emisores recurrentes a vigilar" sin atribuirles peso.
2. **Pico debe contener qué**: bullet de pico de actividad debe incluir al menos un titular concreto y su medio (`peakData.samples[0]`), no solo fecha + %.
3. **Varianza de anclaje**: prohibido repetir "Enfoque Estratégico" más de 2 veces. Variantes: "el caso/asunto descrito en el contexto", "lo que el proyecto definió como prioridad", "el ángulo estratégico del monitoreo", o nombrar directamente el caso/actor.
4. **Cierre con consecuencia observable**: prohibido cerrar con frases meta tipo "esto debe leerse contra…", "este reparto es el insumo base…", "sirve para evaluar…". Cada cierre nombra qué medio fija encuadre, qué actor escala riesgo, qué término ancla asociación, qué jornada concentra exposición.
5. **Vocabulario rotado**: prohibido repetir "tono adverso", "carga reputacional", "lectura pública", "encuadre del periodo" en >50% de los hallazgos.
6. **Sanitizer ampliado**: `sanitizeFindingText` recorta oraciones finales que empiezan con patrones meta nuevos ("esta proporción es el insumo", "este reparto sirve como insumo", "cuando aparecen términos no previstos…").
7. **Tono ejecutivo en sentimiento**: el bullet de distribución cierra con consecuencia ejecutiva ("terreno hostil que conviene leer con prioridad", "mezcla que suele preceder consolidaciones negativas", "espacio editorial que puede ser capitalizado") en lugar de repetir la frase "Enfoque Estratégico".
