
-- Mentions → project
ALTER TABLE public.mentions DROP CONSTRAINT IF EXISTS mentions_project_id_fkey;
ALTER TABLE public.mentions ADD CONSTRAINT mentions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Mentions → entity (also cascade so deleting an entity cleans its mentions)
ALTER TABLE public.mentions DROP CONSTRAINT IF EXISTS mentions_entity_id_fkey;
ALTER TABLE public.mentions ADD CONSTRAINT mentions_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;

-- Entities → project
ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_project_id_fkey;
ALTER TABLE public.entities ADD CONSTRAINT entities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Alert configs → project
ALTER TABLE public.alert_configs DROP CONSTRAINT IF EXISTS alert_configs_project_id_fkey;
ALTER TABLE public.alert_configs ADD CONSTRAINT alert_configs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Alert notifications → project
ALTER TABLE public.alert_notifications DROP CONSTRAINT IF EXISTS alert_notifications_project_id_fkey;
ALTER TABLE public.alert_notifications ADD CONSTRAINT alert_notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Alert notifications → alert config
ALTER TABLE public.alert_notifications DROP CONSTRAINT IF EXISTS alert_notifications_alert_config_id_fkey;
ALTER TABLE public.alert_notifications ADD CONSTRAINT alert_notifications_alert_config_id_fkey FOREIGN KEY (alert_config_id) REFERENCES public.alert_configs(id) ON DELETE CASCADE;

-- Thematic cards → project
ALTER TABLE public.thematic_cards DROP CONSTRAINT IF EXISTS thematic_cards_project_id_fkey;
ALTER TABLE public.thematic_cards ADD CONSTRAINT thematic_cards_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Auto save configs → project
ALTER TABLE public.auto_save_configs DROP CONSTRAINT IF EXISTS auto_save_configs_project_id_fkey;
ALTER TABLE public.auto_save_configs ADD CONSTRAINT auto_save_configs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Project search schedules → project
ALTER TABLE public.project_search_schedules DROP CONSTRAINT IF EXISTS project_search_schedules_project_id_fkey;
ALTER TABLE public.project_search_schedules ADD CONSTRAINT project_search_schedules_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Social scrape jobs → project
ALTER TABLE public.social_scrape_jobs DROP CONSTRAINT IF EXISTS social_scrape_jobs_project_id_fkey;
ALTER TABLE public.social_scrape_jobs ADD CONSTRAINT social_scrape_jobs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Social results → project
ALTER TABLE public.social_results DROP CONSTRAINT IF EXISTS social_results_project_id_fkey;
ALTER TABLE public.social_results ADD CONSTRAINT social_results_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Social results → job
ALTER TABLE public.social_results DROP CONSTRAINT IF EXISTS social_results_job_id_fkey;
ALTER TABLE public.social_results ADD CONSTRAINT social_results_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.social_scrape_jobs(id) ON DELETE CASCADE;

-- Post comments → project
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_project_id_fkey;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Post comments → mention
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_mention_id_fkey;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_mention_id_fkey FOREIGN KEY (mention_id) REFERENCES public.mentions(id) ON DELETE CASCADE;

-- Post comments → social result
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_social_result_id_fkey;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_social_result_id_fkey FOREIGN KEY (social_result_id) REFERENCES public.social_results(id) ON DELETE CASCADE;

-- FK profiles → project
ALTER TABLE public.fk_profiles DROP CONSTRAINT IF EXISTS fk_profiles_project_id_fkey;
ALTER TABLE public.fk_profiles ADD CONSTRAINT fk_profiles_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
