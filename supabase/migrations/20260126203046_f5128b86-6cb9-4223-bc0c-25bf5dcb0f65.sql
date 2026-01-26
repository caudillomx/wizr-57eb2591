-- Create table for thematic cards (Fichas Temáticas)
CREATE TABLE public.thematic_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Card metadata
  title TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('conversation_analysis', 'informative')),
  period_start DATE,
  period_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  
  -- Generated content (editable by analyst)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Mention references (for conversation analysis type)
  mention_ids UUID[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.thematic_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view thematic cards in their projects"
ON public.thematic_cards
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Admins can view all thematic cards"
ON public.thematic_cards
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all thematic cards"
ON public.thematic_cards
FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Users can create thematic cards in their projects"
ON public.thematic_cards
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update thematic cards in their projects"
ON public.thematic_cards
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete thematic cards in their projects"
ON public.thematic_cards
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = thematic_cards.project_id
  AND projects.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_thematic_cards_updated_at
BEFORE UPDATE ON public.thematic_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_thematic_cards_project_id ON public.thematic_cards(project_id);
CREATE INDEX idx_thematic_cards_status ON public.thematic_cards(status);