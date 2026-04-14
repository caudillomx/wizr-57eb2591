
-- 1. Eliminar el cron de scheduled-monitoring (redundante con unified-search)
SELECT cron.unschedule('scheduled-entity-monitoring');

-- 2. Cambiar unified-search de cada hora a cada 6 horas (00:00, 06:00, 12:00, 18:00 UTC)
SELECT cron.unschedule('scheduled-unified-search-hourly');
SELECT cron.schedule(
  'scheduled-unified-search-6h',
  '0 0,6,12,18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yfcfyeueckjqanmtoubt.supabase.co/functions/v1/scheduled-unified-search',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Z5ZXVlY2tqcWFubXRvdWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzQ2NDYsImV4cCI6MjA4NTAxMDY0Nn0.U-sTpWo2RkpA28QNUEjuLBPtn_VmRJD1CvVHPbLPVdQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Mover ranking-sync de 00:00 a 06:00 UTC (medianoche CDMX)
SELECT cron.unschedule('daily-ranking-sync');
SELECT cron.schedule(
  'daily-ranking-sync-6am',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yfcfyeueckjqanmtoubt.supabase.co/functions/v1/scheduled-ranking-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmY2Z5ZXVlY2tqcWFubXRvdWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzQ2NDYsImV4cCI6MjA4NTAxMDY0Nn0.U-sTpWo2RkpA28QNUEjuLBPtn_VmRJD1CvVHPbLPVdQ"}'::jsonb,
    body := '{"triggered_by": "cron"}'::jsonb
  ) AS request_id;
  $$
);
