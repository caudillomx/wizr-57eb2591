-- Tabla de reportes guardados con link público compartible
CREATE TABLE public.shared_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  project_name TEXT NOT NULL,
  content JSONB NOT NULL,
  date_range JSONB NOT NULL,
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_reports_project_id ON public.shared_reports(project_id);
CREATE INDEX idx_shared_reports_public_token ON public.shared_reports(public_token);
CREATE INDEX idx_shared_reports_created_by ON public.shared_reports(created_by);

ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

-- Acceso público de lectura solo si el token es válido (no revocado y no expirado)
CREATE POLICY "Public can view active shared reports by token"
ON public.shared_reports
FOR SELECT
TO anon, authenticated
USING (
  is_revoked = false
  AND (expires_at IS NULL OR expires_at > now())
);

-- Owner: ver, crear, editar, eliminar sus reportes (sobrescribe la pública si están logueados)
CREATE POLICY "Users can create reports in their projects"
ON public.shared_reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = shared_reports.project_id
      AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own reports"
ON public.shared_reports
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own reports"
ON public.shared_reports
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Admins can view all shared reports"
ON public.shared_reports
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all shared reports"
ON public.shared_reports
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'director'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_shared_reports_updated_at
BEFORE UPDATE ON public.shared_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para incrementar view_count de forma segura desde acceso público
CREATE OR REPLACE FUNCTION public.increment_report_view(_token TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shared_reports
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE public_token = _token
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_report_view(TEXT) TO anon, authenticated;