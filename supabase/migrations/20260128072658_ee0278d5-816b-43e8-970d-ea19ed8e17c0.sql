-- Create table for Fanpage Karma profile configurations
CREATE TABLE public.fk_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  network TEXT NOT NULL CHECK (network IN ('facebook', 'instagram', 'youtube', 'linkedin', 'tiktok', 'threads', 'twitter')),
  profile_id TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_own_profile BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, network, profile_id)
);

-- Create table for cached KPI data from Fanpage Karma
CREATE TABLE public.fk_profile_kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fk_profile_id UUID NOT NULL REFERENCES public.fk_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  followers INTEGER,
  follower_growth_percent NUMERIC(10,4),
  engagement_rate NUMERIC(10,4),
  posts_per_day NUMERIC(10,2),
  reach_per_day INTEGER,
  impressions_per_interaction NUMERIC(10,4),
  page_performance_index NUMERIC(10,4),
  raw_data JSONB DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fk_profile_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.fk_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fk_profile_kpis ENABLE ROW LEVEL SECURITY;

-- RLS policies for fk_profiles
CREATE POLICY "Users can view FK profiles in their projects"
  ON public.fk_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create FK profiles in their projects"
  ON public.fk_profiles FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update FK profiles in their projects"
  ON public.fk_profiles FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete FK profiles in their projects"
  ON public.fk_profiles FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = fk_profiles.project_id AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all FK profiles"
  ON public.fk_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all FK profiles"
  ON public.fk_profiles FOR SELECT
  USING (has_role(auth.uid(), 'director'));

-- RLS policies for fk_profile_kpis
CREATE POLICY "Users can view FK KPIs in their projects"
  ON public.fk_profile_kpis FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM fk_profiles 
    JOIN projects ON projects.id = fk_profiles.project_id
    WHERE fk_profiles.id = fk_profile_kpis.fk_profile_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can create FK KPIs in their projects"
  ON public.fk_profile_kpis FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM fk_profiles 
    JOIN projects ON projects.id = fk_profiles.project_id
    WHERE fk_profiles.id = fk_profile_kpis.fk_profile_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can update FK KPIs in their projects"
  ON public.fk_profile_kpis FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM fk_profiles 
    JOIN projects ON projects.id = fk_profiles.project_id
    WHERE fk_profiles.id = fk_profile_kpis.fk_profile_id 
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all FK KPIs"
  ON public.fk_profile_kpis FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Directors can view all FK KPIs"
  ON public.fk_profile_kpis FOR SELECT
  USING (has_role(auth.uid(), 'director'));

-- Trigger for updated_at
CREATE TRIGGER update_fk_profiles_updated_at
  BEFORE UPDATE ON public.fk_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();