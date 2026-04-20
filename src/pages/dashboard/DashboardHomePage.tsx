import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Search,
  BarChart3,
  Plus,
  ArrowRight,
  FolderOpen,
  Trophy,
  Sparkles,
} from "lucide-react";

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    (user?.email ? user.email.split("@")[0] : "");

  const cards = [
    {
      title: "Mis proyectos de Listening",
      description: "Entra a tus proyectos de monitoreo, investigación y crisis.",
      icon: FolderOpen,
      action: () => navigate("/dashboard/proyectos"),
      cta: "Ver proyectos",
      accent: "from-primary/10 to-primary/5 border-primary/20",
      iconBg: "bg-primary/15 text-primary",
      primary: true,
    },
    {
      title: "Crear proyecto de Listening",
      description: "Inicia un nuevo monitoreo con el asistente conversacional.",
      icon: Plus,
      action: () => navigate("/nuevo-proyecto"),
      cta: "Crear proyecto",
      accent: "data-card",
      iconBg: "bg-muted text-muted-foreground",
    },
    {
      title: "Benchmarking (Performance)",
      description: "Analiza el desempeño competitivo de perfiles en redes.",
      icon: Trophy,
      action: () => navigate("/dashboard/performance"),
      cta: "Ir a Benchmarking",
      accent: "from-accent/10 to-accent/5 border-accent/20",
      iconBg: "bg-accent/15 text-accent-foreground",
      primary: true,
    },
    {
      title: "Crear ranking nuevo",
      description: "Crea un ranking para comparar perfiles entre clientes.",
      icon: BarChart3,
      action: () => navigate("/dashboard/performance"),
      cta: "Nuevo ranking",
      accent: "data-card",
      iconBg: "bg-muted text-muted-foreground",
    },
  ] as Array<{
    title: string;
    description: string;
    icon: typeof Plus;
    action: () => void;
    cta: string;
    accent: string;
    iconBg: string;
    primary?: boolean;
  }>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 md:mb-10"
      >
        <p className="section-label mb-2 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Wizr
        </p>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          ¿Qué quieres hacer hoy?
        </p>
      </motion.div>

      {/* Hub cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.06 }}
            >
              <Card
                onClick={c.action}
                className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  c.primary
                    ? `bg-gradient-to-br ${c.accent}`
                    : c.accent
                }`}
              >
                <CardContent className="p-5 md:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-2.5 rounded-lg ${c.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h3 className="text-base md:text-lg font-semibold text-foreground mb-1.5">
                    {c.title}
                  </h3>
                  <p className="text-xs md:text-sm text-muted-foreground mb-4 leading-relaxed">
                    {c.description}
                  </p>
                  <Button
                    variant={c.primary ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      c.action();
                    }}
                  >
                    {c.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Footer hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-xs text-muted-foreground text-center mt-8"
      >
        Selecciona un proyecto en la barra superior para acceder a Panorama, Semántica, Influenciadores y Reportes.
      </motion.p>
    </div>
  );
};

export default DashboardHomePage;
