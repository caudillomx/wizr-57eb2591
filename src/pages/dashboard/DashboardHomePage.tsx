import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  BarChart3,
  FileText,
  ArrowRight,
  Minus,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { subDays, subHours, isWithinInterval, format } from "date-fns";
import { es } from "date-fns/locale";
import { DailyIntelligenceSummary } from "@/components/dashboard/DailyIntelligenceSummary";
import { motion } from "framer-motion";

const DashboardHomePage = () => {
  const { selectedProject } = useProject();
  const navigate = useNavigate();
  const projectId = selectedProject?.id;

  // Fetch last 30 days mentions (aligned with Panorama logic)
  const { data: mentions, isLoading } = useQuery({
    queryKey: ["dashboard-home-mentions", projectId],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      const startIso = thirtyDaysAgo.toISOString();
      const endIso = new Date().toISOString();

      // Use same date logic as Panorama: published_at OR created_at
      const dateFilter = `and(published_at.gte.${startIso},published_at.lte.${endIso}),and(published_at.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`;

      // Paginate to get all mentions (same as usePanoramaData)
      const PAGE_SIZE = 1000;
      const allMentions: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("mentions")
          .select("id, title, source_domain, sentiment, created_at, published_at, url, is_read")
          .eq("project_id", projectId!)
          .eq("is_archived", false)
          .or(dateFilter)
          .order("published_at", { ascending: false, nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allMentions.push(...(data || []));
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      return allMentions;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  // Fetch entities count
  const { data: entitiesCount } = useQuery({
    queryKey: ["dashboard-home-entities", projectId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("entities")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId!)
        .eq("activo", true);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  // Fetch unread alerts
  const { data: alertsCount } = useQuery({
    queryKey: ["dashboard-home-alerts", projectId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("alert_notifications")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId!)
        .eq("is_read", false)
        .eq("is_dismissed", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const stats = useMemo(() => {
    if (!mentions) return null;
    const now = new Date();
    const yesterday = subHours(now, 24);
    const last24h = mentions.filter((m) =>
      isWithinInterval(new Date(m.created_at), { start: yesterday, end: now })
    );
    const total = mentions.length;
    const positivo = mentions.filter((m) => m.sentiment === "positivo").length;
    const negativo = mentions.filter((m) => m.sentiment === "negativo").length;
    const neutral = mentions.filter((m) => m.sentiment === "neutral").length;
    const sinAnalizar = total - positivo - negativo - neutral;

    // Sparkline data: last 7 days
    const sparkline: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), i);
      const dayEnd = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), i - 1);
      sparkline.push(
        mentions.filter((m) => {
          const d = new Date(m.created_at);
          return d >= dayStart && d < dayEnd;
        }).length
      );
    }

    const dominantSentiment =
      positivo >= negativo && positivo >= neutral
        ? "positivo"
        : negativo >= positivo && negativo >= neutral
        ? "negativo"
        : "neutral";

    return {
      last24h: last24h.length,
      total,
      positivo,
      negativo,
      neutral,
      sinAnalizar,
      sparkline,
      dominantSentiment,
      recentMentions: mentions.slice(0, 5),
    };
  }, [mentions]);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <FolderOpen className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-muted-foreground">Sin proyecto seleccionado</h2>
        <p className="text-sm text-muted-foreground">Selecciona o crea un proyecto para comenzar.</p>
        <Button onClick={() => navigate("/nuevo-proyecto")}>Crear proyecto</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const maxSparkline = Math.max(...(stats?.sparkline || [1]), 1);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{selectedProject.nombre}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
          </p>
        </div>
        <span className="section-label hidden md:block">Panel ejecutivo</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Menciones 24h"
          value={stats?.last24h ?? 0}
          icon={<MessageSquare className="h-4 w-4" />}
          accent="primary"
          onClick={() => navigate("/dashboard/fuentes")}
        />
        <KPICard
          label="Sentimiento"
          value={
            stats?.dominantSentiment === "positivo"
              ? "Positivo"
              : stats?.dominantSentiment === "negativo"
              ? "Negativo"
              : "Neutral"
          }
          icon={
            stats?.dominantSentiment === "positivo" ? (
              <TrendingUp className="h-4 w-4" />
            ) : stats?.dominantSentiment === "negativo" ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )
          }
          accent={
            stats?.dominantSentiment === "positivo"
              ? "green"
              : stats?.dominantSentiment === "negativo"
              ? "red"
              : "muted"
          }
          subtitle={`${stats?.positivo ?? 0} pos · ${stats?.negativo ?? 0} neg`}
          onClick={() => navigate("/dashboard/panorama")}
        />
        <KPICard
          label="Alertas activas"
          value={alertsCount ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
          accent={alertsCount && alertsCount > 0 ? "orange" : "muted"}
          onClick={() => navigate("/dashboard/panorama")}
        />
        <KPICard
          label="Entidades"
          value={entitiesCount ?? 0}
          icon={<Search className="h-4 w-4" />}
          accent="muted"
          onClick={() => navigate("/dashboard/configuracion")}
        />
      </div>

      {/* Sparkline + Sentiment bar */}
      {stats && stats.total > 0 && (
        <Card className="data-card">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Mini sparkline */}
              <div className="flex-1">
                <p className="section-label mb-2">Actividad · 7 días ({stats.total} menciones)</p>
                <div className="flex items-end gap-1 h-12">
                  {stats.sparkline.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/20 rounded-sm min-h-[2px] transition-all hover:bg-primary/40"
                      style={{ height: `${(v / maxSparkline) * 100}%` }}
                      title={`${v} menciones`}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {format(subDays(new Date(), 6), "dd/MM")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Hoy</span>
                </div>
              </div>
              {/* Sentiment bar */}
              <div className="md:w-64">
                <p className="section-label mb-2">Sentimiento</p>
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  {stats.positivo > 0 && (
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${(stats.positivo / stats.total) * 100}%` }}
                    />
                  )}
                  {stats.neutral > 0 && (
                    <div
                      className="bg-blue-400 transition-all"
                      style={{ width: `${(stats.neutral / stats.total) * 100}%` }}
                    />
                  )}
                  {stats.negativo > 0 && (
                    <div
                      className="bg-red-500 transition-all"
                      style={{ width: `${(stats.negativo / stats.total) * 100}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span className="text-green-600">{stats.positivo} pos</span>
                  <span className="text-blue-500">{stats.neutral} neu</span>
                  <span className="text-red-500">{stats.negativo} neg</span>
                </div>
                {stats.sinAnalizar > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {stats.sinAnalizar} sin analizar
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Intelligence Summary (compact) */}
      <DailyIntelligenceSummary
        projectId={selectedProject.id}
        projectName={selectedProject.nombre}
      />

      {/* Recent Mentions + Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Recent mentions feed */}
        <Card className="md:col-span-2 data-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">Menciones recientes</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => navigate("/dashboard/fuentes")}
              >
                Ver todas <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {stats?.recentMentions && stats.recentMentions.length > 0 ? (
              <div className="space-y-2">
                {stats.recentMentions.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => m.url && window.open(m.url, "_blank")}
                  >
                    <SentimentDot sentiment={m.sentiment} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate text-foreground group-hover:text-primary transition-colors">
                        {m.title || "Sin título"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {m.source_domain?.replace(/^www\./, "").split(".")[0] || "—"}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(m.created_at), "dd/MM HH:mm")}
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No hay menciones recientes. Busca en Fuentes para comenzar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="data-card">
          <CardContent className="p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Acciones rápidas</h2>
            <div className="space-y-2">
              <QuickAction
                icon={<Search className="h-4 w-4" />}
                label="Buscar menciones"
                description="Capturar datos de redes y noticias"
                onClick={() => navigate("/dashboard/fuentes")}
              />
              <QuickAction
                icon={<BarChart3 className="h-4 w-4" />}
                label="Ver análisis"
                description="Semántica, sentimiento y tendencias"
                onClick={() => navigate("/dashboard/semantica")}
              />
              <QuickAction
                icon={<FileText className="h-4 w-4" />}
                label="Generar reporte"
                description="Crear entregable con IA"
                onClick={() => navigate("/dashboard/reportes")}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ── Sub-components ── */

function KPICard({
  label,
  value,
  icon,
  accent,
  subtitle,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent: "primary" | "green" | "red" | "orange" | "muted";
  subtitle?: string;
  onClick?: () => void;
}) {
  const accentMap = {
    primary: "text-primary bg-primary/10",
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    orange: "text-orange-600 bg-orange-50",
    muted: "text-muted-foreground bg-muted",
  };
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all data-card"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-1.5 rounded-md ${accentMap[accent]}`}>{icon}</div>
          <span className="section-label !text-[10px]">{label}</span>
        </div>
        <p className="data-value">{value}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function SentimentDot({ sentiment }: { sentiment: string | null }) {
  const color =
    sentiment === "positivo"
      ? "bg-green-500"
      : sentiment === "negativo"
      ? "bg-red-500"
      : sentiment === "neutral"
      ? "bg-blue-400"
      : "bg-muted-foreground/30";
  return <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${color}`} />;
}

function QuickAction({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left group"
    >
      <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export default DashboardHomePage;
