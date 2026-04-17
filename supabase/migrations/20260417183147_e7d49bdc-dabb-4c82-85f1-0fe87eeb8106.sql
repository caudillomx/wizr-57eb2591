CREATE TABLE public.smart_report_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  request_payload JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT smart_report_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_smart_report_jobs_user_created_at ON public.smart_report_jobs(user_id, created_at DESC);
CREATE INDEX idx_smart_report_jobs_status_created_at ON public.smart_report_jobs(status, created_at ASC);

ALTER TABLE public.smart_report_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smart report jobs"
ON public.smart_report_jobs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own smart report jobs"
ON public.smart_report_jobs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smart report jobs"
ON public.smart_report_jobs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_smart_report_jobs_updated_at
BEFORE UPDATE ON public.smart_report_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();