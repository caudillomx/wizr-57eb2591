## Objetivo

Cerrar el último hueco en la curva de actividad: las menciones de Facebook, Instagram, TikTok y X que entran sin `published_at` (Apify y otros scrapers no lo devuelven siempre). Hoy esas menciones caen al `created_at` y distorsionan el gráfico (picos artificiales del día de captura + valles en los días reales).

Ya hay paliativo visual ("Solo fechas verificadas" en Panorama → Actividad Diaria), pero la solución de fondo es reconstruir la fecha real.

## Alcance

Edge function nueva `enrich-social-dates` + un panel mínimo en el módulo de Fuentes para dispararla manualmente y verla correr en background. No toca el flujo de captura inicial (sigue Microworlds/apidojo/etc); enriquece después.

## Arquitectura

```text
mentions (published_at IS NULL, platform in fb/ig/tt/x)
        │
        ▼
enrich-social-dates  ──► router por plataforma
        ├── facebook  → Apify apify/facebook-post-scraper (input: postUrls[])
        ├── instagram → Apify apify/instagram-post-scraper (input: directUrls[])
        ├── tiktok    → Apify clockworks/tiktok-video-scraper o BrightData (ya configurado)
        └── x/twitter → apidojo/twitter-scraper-lite (input: tweetUrls[])
        │
        ▼
normalize.ts → extrae taken_at / timestamp / createTime / createdAt
        │
        ▼
UPDATE mentions SET published_at = ?, raw_metadata.date_source='apify_enrichment',
                    raw_metadata.date_confidence='high'
```

Reusa `APIFY_API_TOKEN` y `BRIGHTDATA_API_KEY` (ya en secretos). Sin claves nuevas.

## Implementación

1. **`supabase/functions/enrich-social-dates/index.ts`**
   - Params: `{ project_id, platforms?, limit?, dry_run? }`
   - Selecciona mentions sin `published_at` (filtra por dominio: facebook.com, instagram.com, tiktok.com, x.com/twitter.com)
   - Agrupa por plataforma, batch de 50 URLs por run de Apify (sync mode con timeout 60s)
   - Mapea respuesta → `published_at`
   - Update por lotes, registra en `raw_metadata` el origen
   - Devuelve `{ scanned, updated, failed_by_platform }`

2. **Reutilizar `_shared/normalize.ts`**
   - Añadir helper `extractPublishedAt(rawItem, platform)` con los paths conocidos: `taken_at`, `timestamp`, `createTimeISO`, `createdAt`, `time`.

3. **Panel UI en `/dashboard/fuentes`** (sección "Mantenimiento")
   - Card "Enriquecer fechas de redes sociales"
   - Muestra conteo de pendientes por plataforma (query en vivo)
   - Botón "Ejecutar" → invoca la función, muestra progreso
   - Histórico simple de últimas 5 corridas (timestamp, scanned, updated)

4. **Cron opcional (fase 2)**
   - Schedule diario 04:00 UTC que enriquezca hasta 500 mentions por proyecto activo. Solo si la fase manual demuestra costo aceptable.

## Consideraciones

- **Costo Apify**: ~$0.30 por 1000 posts FB/IG. Para los 25 pendientes del caso conejita: irrelevante. Para volumen sostenido habrá que monitorear.
- **Rate limits**: batches de 50 con espera de 2s entre runs.
- **Fallback**: si Apify devuelve 404 (post borrado), marca `date_confidence='unavailable'` para no reintentar.
- **No tocar** `enforce_mention_age_floor` ni triggers de relevance; solo UPDATE de `published_at` + `raw_metadata`.

## Entregables

- 1 edge function nueva
- 1 helper en `_shared/normalize.ts`
- 1 card en Fuentes (`SocialDateEnrichmentCard.tsx`)
- 0 migraciones (solo UPDATEs runtime)

## Validación

Tras correr sobre las ~25 menciones del proyecto Instituto La Paz, esperamos ver la curva real de la conversación de "la conejita" reconstruida en Panorama con el toggle "Solo fechas verificadas" desactivado y los picos artificiales del 16 may eliminados.
