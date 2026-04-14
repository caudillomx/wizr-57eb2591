
-- Add unique constraint for CSV import upsert
ALTER TABLE public.fk_profiles 
ADD CONSTRAINT fk_profiles_ranking_network_profile_unique 
UNIQUE (ranking_id, network, profile_id);

-- Add unique constraint for KPI upsert
ALTER TABLE public.fk_profile_kpis 
ADD CONSTRAINT fk_profile_kpis_profile_period_unique 
UNIQUE (fk_profile_id, period_start, period_end);
