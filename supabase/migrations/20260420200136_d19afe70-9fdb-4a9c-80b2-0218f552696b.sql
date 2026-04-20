-- ============================================
-- 1. CLIENTS TABLE
-- ============================================
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  logo_url text,
  services_enabled jsonb NOT NULL DEFAULT '{}'::jsonb,
  kimediamx_profile_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clients"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients"
  ON public.clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients"
  ON public.clients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients"
  ON public.clients FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients"
  ON public.clients FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all clients"
  ON public.clients FOR SELECT
  USING (has_role(auth.uid(), 'director'::app_role));

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- ============================================
-- 2. EXTEND fk_profiles
-- ============================================
ALTER TABLE public.fk_profiles
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN is_competitor boolean NOT NULL DEFAULT false;

CREATE INDEX idx_fk_profiles_client_id ON public.fk_profiles(client_id);

-- Allow access to fk_profiles via client ownership too
CREATE POLICY "Users can view FK profiles in their clients"
  ON public.fk_profiles FOR SELECT
  USING (
    client_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = fk_profiles.client_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users can create FK profiles in their clients"
  ON public.fk_profiles FOR INSERT
  WITH CHECK (
    client_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = fk_profiles.client_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users can update FK profiles in their clients"
  ON public.fk_profiles FOR UPDATE
  USING (
    client_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = fk_profiles.client_id AND c.user_id = auth.uid())
  );

CREATE POLICY "Users can delete FK profiles in their clients"
  ON public.fk_profiles FOR DELETE
  USING (
    client_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = fk_profiles.client_id AND c.user_id = auth.uid())
  );

-- ============================================
-- 3. fk_posts TABLE (full post universe)
-- ============================================
CREATE TABLE public.fk_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fk_profile_id uuid NOT NULL REFERENCES public.fk_profiles(id) ON DELETE CASCADE,
  network text NOT NULL,
  external_id text,
  published_at timestamp with time zone NOT NULL,
  message text,
  link text,
  post_image_url text,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  engagement integer DEFAULT 0,
  reach integer DEFAULT 0,
  interaction_rate numeric,
  interaction_per_impression numeric,
  post_type text,
  raw_data jsonb DEFAULT '{}'::jsonb,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_fk_posts_profile_external
  ON public.fk_posts(fk_profile_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX idx_fk_posts_profile_published ON public.fk_posts(fk_profile_id, published_at DESC);
CREATE INDEX idx_fk_posts_published_at ON public.fk_posts(published_at DESC);
CREATE INDEX idx_fk_posts_network ON public.fk_posts(network);

ALTER TABLE public.fk_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fk_posts via profile ownership"
  ON public.fk_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      LEFT JOIN public.projects p ON p.id = fp.project_id
      LEFT JOIN public.rankings r ON r.id = fp.ranking_id
      LEFT JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_posts.fk_profile_id
        AND (
          (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
          OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
          OR (fp.client_id IS NOT NULL AND c.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users can insert fk_posts via profile ownership"
  ON public.fk_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      LEFT JOIN public.projects p ON p.id = fp.project_id
      LEFT JOIN public.rankings r ON r.id = fp.ranking_id
      LEFT JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_posts.fk_profile_id
        AND (
          (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
          OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
          OR (fp.client_id IS NOT NULL AND c.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users can update fk_posts via profile ownership"
  ON public.fk_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      LEFT JOIN public.projects p ON p.id = fp.project_id
      LEFT JOIN public.rankings r ON r.id = fp.ranking_id
      LEFT JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_posts.fk_profile_id
        AND (
          (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
          OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
          OR (fp.client_id IS NOT NULL AND c.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Users can delete fk_posts via profile ownership"
  ON public.fk_posts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      LEFT JOIN public.projects p ON p.id = fp.project_id
      LEFT JOIN public.rankings r ON r.id = fp.ranking_id
      LEFT JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_posts.fk_profile_id
        AND (
          (fp.project_id IS NOT NULL AND p.user_id = auth.uid())
          OR (fp.ranking_id IS NOT NULL AND r.user_id = auth.uid())
          OR (fp.client_id IS NOT NULL AND c.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Admins can view all fk_posts"
  ON public.fk_posts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all fk_posts"
  ON public.fk_posts FOR SELECT
  USING (has_role(auth.uid(), 'director'::app_role));

CREATE TRIGGER update_fk_posts_updated_at
  BEFORE UPDATE ON public.fk_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 4. Extend fk_profile_kpis access via clients
-- ============================================
CREATE POLICY "Users can view FK KPIs via client ownership"
  ON public.fk_profile_kpis FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_profile_kpis.fk_profile_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert FK KPIs via client ownership"
  ON public.fk_profile_kpis FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_profile_kpis.fk_profile_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update FK KPIs via client ownership"
  ON public.fk_profile_kpis FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_profile_kpis.fk_profile_id
        AND c.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. Extend fk_daily_top_posts access via clients
-- ============================================
CREATE POLICY "Users can view daily top posts via client ownership"
  ON public.fk_daily_top_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_daily_top_posts.fk_profile_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert daily top posts via client ownership"
  ON public.fk_daily_top_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_daily_top_posts.fk_profile_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update daily top posts via client ownership"
  ON public.fk_daily_top_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.fk_profiles fp
      JOIN public.clients c ON c.id = fp.client_id
      WHERE fp.id = fk_daily_top_posts.fk_profile_id
        AND c.user_id = auth.uid()
    )
  );