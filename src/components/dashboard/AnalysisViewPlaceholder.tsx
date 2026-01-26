import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProject } from "@/contexts/ProjectContext";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Plus } from "lucide-react";

interface AnalysisViewPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const AnalysisViewPlaceholder = ({
  title,
  description,
  icon: Icon,
}: AnalysisViewPlaceholderProps) => {
  const { selectedProject, loading } = useProject();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Sin proyecto seleccionado</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Crea o selecciona un proyecto para ver {title.toLowerCase()}
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">
          {description} — <span className="font-medium">{selectedProject.nombre}</span>
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-primary/10 p-4">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Vista en desarrollo</h3>
          <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
            Esta vista de análisis estará disponible próximamente. Aquí podrás
            explorar insights de {title.toLowerCase()} del proyecto{" "}
            <span className="font-medium">{selectedProject.nombre}</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisViewPlaceholder;
