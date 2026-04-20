-- Deactivate (and remove) any cron job that triggers scheduled-ranking-sync
DO $$
DECLARE
  job RECORD;
BEGIN
  FOR job IN
    SELECT jobid, jobname FROM cron.job
    WHERE command ILIKE '%scheduled-ranking-sync%'
       OR jobname ILIKE '%ranking%sync%'
       OR jobname ILIKE '%scheduled-ranking%'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
END $$;