---
name: Relevance Filter Rule
description: Post-search relevance filters must match by full phrase or ≥2 meaningful tokens, never by a single tokenized word
type: constraint
---
## Regla de relevancia post-scraping

**Problema histórico**: `youtube-search` tokenizaba la query (`"Las Libres Guanajuato"` → `["las","libres","guanajuato"]`) y aceptaba el resultado si **un solo token** aparecía. Esto coló "Camino de Guanajuato" (José Alfredo Jiménez, VEVO, 66M views) por matchear solo "guanajuato".

**Regla obligatoria** para cualquier filtro post-search por keywords:
1. **Match preferente**: la frase completa (≥4 chars, sin comillas) en título/descripción/canal/autor.
2. **Fallback**: si no hay frase exacta, requerir mínimo **2 tokens significativos** matcheados (≥3 chars, excluyendo stopwords ES/EN: de, del, la, el, los, las, un, una, y, o, en, a, al, por, para, con, sin, que, the, of, and, or, in, on, at, to, for, an, is, it).
3. **Nunca** aceptar por un solo token suelto cuando la query tiene 2+ tokens significativos.

**Aplicado en**: `supabase/functions/youtube-search/index.ts` (`isRelevantResult` + `extractKeywordTokens`).

**Otros scrapers** (`apify-status`, `scheduled-unified-search.contentMatchesKeywords`) ya usan `mainText.includes(phrase)` con la frase completa, sin tokenizar — mantienen ese patrón.

**Why**: evita falsos positivos en queries multi-palabra; preserva captura limpia y consistente con el piso de 365 días y el dedup semántico.
