-- Make project_id optional and add client_id + report_kind for Performance reports
ALTER TABLE public.shared_reports
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.shared_reports
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS report_kind text NOT NULL DEFAULT 'listening';

-- Ensure exactly one owner (project OR client, not both, not neither)
ALTER TABLE public.shared_reports
  DROP CONSTRAINT IF EXISTS shared_reports_owner_check;

ALTER TABLE public.shared_reports
  ADD CONSTRAINT shared_reports_owner_check
  CHECK (
    (project_id IS NOT NULL AND client_id IS NULL) OR
    (project_id IS NULL AND client_id IS NOT NULL)
  );

-- Validate report_kind values
ALTER TABLE public.shared_reports
  DROP CONSTRAINT IF EXISTS shared_reports_kind_check;

ALTER TABLE public.shared_reports
  ADD CONSTRAINT shared_reports_kind_check
  CHECK (report_kind IN ('listening', 'performance_brand', 'performance_benchmark'));

CREATE INDEX IF NOT EXISTS idx_shared_reports_client_id ON public.shared_reports(client_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_kind ON public.shared_reports(report_kind);

-- Update RLS: allow creation for client-owned reports too
DROP POLICY IF EXISTS "Users can create reports in their projects" ON public.shared_reports;

CREATE POLICY "Users can create reports in their projects or clients"
  ON public.shared_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      (project_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = shared_reports.project_id AND p.user_id = auth.uid()
      ))
      OR
      (client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = shared_reports.client_id AND c.user_id = auth.uid()
      ))
    )
  );