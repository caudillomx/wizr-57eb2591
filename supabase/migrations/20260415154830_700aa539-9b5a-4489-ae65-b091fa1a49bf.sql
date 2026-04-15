-- Update calculate_next_run to support every_3_hours
CREATE OR REPLACE FUNCTION public.calculate_next_run(freq text, from_time timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN CASE freq
    WHEN 'hourly' THEN from_time + INTERVAL '1 hour'
    WHEN 'every_3_hours' THEN from_time + INTERVAL '3 hours'
    WHEN 'twice_daily' THEN from_time + INTERVAL '12 hours'
    WHEN 'daily' THEN from_time + INTERVAL '1 day'
    WHEN 'weekly' THEN from_time + INTERVAL '1 week'
    ELSE from_time + INTERVAL '1 day'
  END;
END;
$function$;

-- Create trigger function to auto-create search schedule
CREATE OR REPLACE FUNCTION public.handle_new_project_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.project_search_schedules (
    project_id,
    is_enabled,
    frequency,
    platforms,
    max_results_per_platform,
    next_run_at
  ) VALUES (
    NEW.id,
    true,
    'every_3_hours',
    ARRAY['news', 'twitter', 'facebook', 'youtube', 'tiktok', 'instagram', 'linkedin', 'reddit'],
    50,
    now() + INTERVAL '3 hours'
  );
  RETURN NEW;
END;
$$;

-- Create trigger on projects table
CREATE TRIGGER on_project_created_create_schedule
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_project_schedule();