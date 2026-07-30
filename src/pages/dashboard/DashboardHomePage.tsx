import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectsOverview } from "@/hooks/useProjectsOverview";
import {
  Plus,
  ArrowRight,
  Trophy,
  Sparkles,
  Check,
  Settings,
  Search,
  BarChart3,
  FileText,
} from "lucide-react";

const STEP_ICONS = [Settings, Search, BarChart3, FileText];
const STEP_NAMES = ["Definir", "Capturar", "Analizar", "Reportar"];

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setSelectedProject } = useProject();
  const { summaries, isLoading } = useProjectsOverview();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "");

  const goTo = (projectId: string, route: string) => {
    const summary = summaries.find((s) => s.project.id === projectId);
    if (summary) setSelectedProject(summary.project);
    navigate(route);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <p className="section-label mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Wizr
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Retoma el trabajo donde lo dejaste.
        </p>
      </motion.div>

      {/* Proyectos de listening con su estado de flujo */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Proyectos de listening
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo proyecto
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      ) : summaries.length === 0 ? (
        <Card className="data-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no tienes proyectos. Crea el primero con el asistente conversacional.
            </p>
            <Button className="gap-1.5" onClick={() => navigate("/nuevo-proyecto")}>
              <Plus className="h-4 w-4" />
              Crear proyecto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summaries.map((s, i) => {
            const stepValues = [s.entities, s.mentions, s.analyzed, s.reports];
            return (
              <motion.div
                key={s.project.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i }}
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-base font-semibold">{s.project.nombre}</h3>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {s.project.tipo}
                          </Badge>
                        </div>
                        {s.project.descripcion && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {s.project.descripcion}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => goTo(s.project.id, s.nextRoute)}
                      >
                        {s.nextLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <Progress value={s.progress} className="mt-4 h-1.5" />

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {STEP_NAMES.map((name, idx) => {
                        const Icon = STEP_ICONS[idx];
                        const value = stepValues[idx];
                        const done = value > 0;
                        return (
                          <div
                            key={name}
                            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                              done
                                ? "border-primary/30 bg-primary/5 text-foreground"
                                : "border-border bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            ) : (
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate">{name}</span>
                            <span className="ml-auto font-semibold tabular-nums">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Benchmarking como contexto secundario */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Otros módulos
      </h2>
      <Card
        onClick={() => navigate("/dashboard/performance")}
        className="group cursor-pointer border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5 transition-all hover:shadow-md"
      >
        <CardContent className="flex items-center gap-4 p-5">
          <div className="rounded-lg bg-accent/15 p-2.5 text-accent-foreground">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">Benchmarking competitivo</h3>
            <p className="text-xs text-muted-foreground">
              Desempeño de perfiles por cliente, rankings y reportes de performance.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardHomePage;
