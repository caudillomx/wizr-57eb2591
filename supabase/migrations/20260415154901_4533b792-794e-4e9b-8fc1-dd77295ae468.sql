-- Drop old check constraint and add updated one with every_3_hours
ALTER TABLE public.project_search_schedules DROP CONSTRAINT IF EXISTS project_search_schedules_frequency_check;
ALTER TABLE public.project_search_schedules ADD CONSTRAINT project_search_schedules_frequency_check 
  CHECK (frequency IN ('hourly', 'every_3_hours', 'twice_daily', 'daily', 'weekly'));