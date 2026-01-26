-- Create enum for entity types
CREATE TYPE public.entity_type AS ENUM ('persona', 'marca', 'institucion');

-- Create entities table
CREATE TABLE public.entities (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    tipo entity_type NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    palabras_clave TEXT[] NOT NULL DEFAULT '{}',
    aliases TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_entities_project_id ON public.entities(project_id);
CREATE INDEX idx_entities_tipo ON public.entities(tipo);

-- Enable Row Level Security
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage entities in their own projects
CREATE POLICY "Users can view entities in their projects"
ON public.entities
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all entities"
ON public.entities
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Directors can view all entities"
ON public.entities
FOR SELECT
USING (has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Users can create entities in their projects"
ON public.entities
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update entities in their projects"
ON public.entities
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete entities in their projects"
ON public.entities
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = entities.project_id
        AND projects.user_id = auth.uid()
    )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();