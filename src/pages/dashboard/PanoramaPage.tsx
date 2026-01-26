import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  MessageSquare,
  Users,
  Clock,
  Globe,
  AlertCircle,
  Plus,
} from "lucide-react";

const PanoramaPage = () => {
  const { selectedProject, loading } = useProject();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
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
          Crea o selecciona un proyecto para ver el panorama de análisis
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  const REGION_LABELS: Record<string, string> = {
    mexico: "México",
    latam: "Latinoamérica",
    usa: "Estados Unidos",
    espana: "España",
    global: "Global",
  };

  const TEMPORAL_LABELS: Record<string, string> = {
    tiempo_real: "Tiempo Real",
    diario: "Diario",
    semanal: "Semanal",
    mensual: "Mensual",
    historico: "Histórico",
  };

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{selectedProject.nombre}</h1>
          <Badge variant="outline" className="capitalize">
            {selectedProject.tipo}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">{selectedProject.objetivo}</p>
      </div>

      {/* Project Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alcance Temporal</p>
              <p className="font-semibold">
                {TEMPORAL_LABELS[selectedProject.alcance_temporal]}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-secondary p-3">
              <Globe className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cobertura</p>
              <p className="font-semibold">
                {selectedProject.alcance_geografico
                  .map((r) => REGION_LABELS[r] || r)
                  .join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-accent/10 p-3">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Audiencia</p>
              <p className="line-clamp-1 font-semibold">{selectedProject.audiencia}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-3">
              <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Versión</p>
              <p className="font-semibold">v{selectedProject.version}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <TrendingUp className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Gráfico de Actividad
            </p>
            <p className="text-sm text-muted-foreground">
              Próximamente: Tendencias y volumen de menciones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Sentimiento
            </p>
            <p className="text-sm text-muted-foreground">
              Próximamente: Análisis de sentimiento
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PanoramaPage;
