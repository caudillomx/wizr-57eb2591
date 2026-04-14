import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ExternalLink,
  FolderOpen,
  Activity,
  Eye,
  Zap,
  BarChart3,
  Search,
  FileText,
  Clock,
} from "lucide-react";
import { subDays, subHours, isWithinInterval, format, differenceInMinutes } from "date-fns";
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
      const dateFilter = `and(published_at.gte.${startIso},published_at.lte.${endIso}),and(published_at.is.null,created_at.gte.${startIso},created_at.lte.${endIso})`;

      const PAGE_SIZE = 1000;
      const allMentions: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("mentions")
          .select("id, title, source_domain, sentiment, created_at, published_at, url, is_read, matched_keywords")
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
    const h24 = subHours(now, 24);
    const h48 = subHours(now, 48);
    const getDate = (m: { published_at: string | null; created_at: string }) =>
      new Date(m.published_at ?? m.created_at);

    const last24h = mentions.filter((m) => isWithinInterval(getDate(m), { start: h24, end: now }));
    const prev24h = mentions.filter((m) => isWithinInterval(getDate(m), { start: h48, end: h24 }));
    const total = mentions.length;
    const positivo = mentions.filter((m) => m.sentiment === "positivo").length;
    const negativo = mentions.filter((m) => m.sentiment === "negativo").length;
    const neutral = mentions.filter((m) => m.sentiment === "neutral").length;
    const sinAnalizar = total - positivo - negativo - neutral;

    // Delta (24h vs prev 24h)
    const delta24h = last24h.length - prev24h.length;
    const deltaPercent = prev24h.length > 0 ? Math.round((delta24h / prev24h.length) * 100) : last24h.length > 0 ? 100 : 0;

    // Neg ratio for risk signal
    const negRatio24h = last24h.length > 0 
      ? last24h.filter((m) => m.sentiment === "negativo").length / last24h.length 
      : 0;

    // Sparkline: last 7 days
    const sparkline: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), i);
      const dayEnd = subDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), i - 1);
      sparkline.push(mentions.filter((m) => { const d = getDate(m); return d >= dayStart && d < dayEnd; }).length);
    }

    // Top sources
    const sourceCounts: Record<string, number> = {};
    last24h.forEach((m) => {
      const s = m.source_domain?.replace(/^www\./, "").split(".")[0] || "otro";
      sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    });
    const topSources = Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return {
      last24h: last24h.length,
      prev24h: prev24h.length,
      delta24h,
      deltaPercent,
      total,
      positivo,
      negativo,
      neutral,
      sinAnalizar,
      negRatio24h,
      sparkline,
      topSources,
      recentMentions: mentions.slice(0, 6),
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
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const maxSparkline = Math.max(...(stats?.sparkline || [1]), 1);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Panel ejecutivo</p>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            {selectedProject.nombre}
          </h1>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-xs text-muted-foreground">{format(new Date(), "HH:mm")} hrs</p>
        </div>
      </div>

      {/* ── Hero KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mentions 24h - Primary */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card
            className="cursor-pointer hover:shadow-md transition-all border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10"
            onClick={() => navigate("/dashboard/fuentes")}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/15 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                {stats && stats.deltaPercent !== 0 && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono gap-0.5 ${
                      stats.deltaPercent > 0
                        ? "text-green-600 border-green-200 bg-green-50"
                        : "text-red-600 border-red-200 bg-red-50"
                    }`}
                  >
                    {stats.deltaPercent > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(stats.deltaPercent)}%
                  </Badge>
                )}
              </div>
              <p className="data-value text-3xl">{stats?.last24h ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Menciones · 24h</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total 30d */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="cursor-pointer hover:shadow-md transition-all data-card" onClick={() => navigate("/dashboard/panorama")}>
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                  <Eye className="h-4 w-4" />
                </div>
              </div>
              <p className="data-value text-3xl">{stats?.total ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Total · 30 días</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sentiment signal */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card
            className={`cursor-pointer hover:shadow-md transition-all ${
              stats && stats.negRatio24h > 0.4
                ? "border-red-200 bg-gradient-to-br from-red-50/50 to-red-100/30"
                : "data-card"
            }`}
            onClick={() => navigate("/dashboard/semantica")}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${
                  stats && stats.negRatio24h > 0.4
                    ? "bg-red-100 text-red-600"
                    : stats && stats.positivo > stats.negativo
                    ? "bg-green-100 text-green-600"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {stats && stats.negRatio24h > 0.4 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : stats && stats.positivo > stats.negativo ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                </div>
                {stats && stats.negRatio24h > 0.4 && (
                  <Badge variant="destructive" className="text-[10px]">Riesgo</Badge>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="data-value text-3xl text-green-600">{stats?.positivo ?? 0}</span>
                <span className="text-muted-foreground text-lg">/</span>
                <span className="data-value text-3xl text-red-600">{stats?.negativo ?? 0}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Positivo / Negativo</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alerts */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card
            className={`cursor-pointer hover:shadow-md transition-all ${
              alertsCount && alertsCount > 0
                ? "border-orange-200 bg-gradient-to-br from-orange-50/50 to-orange-100/30"
                : "data-card"
            }`}
            onClick={() => navigate("/dashboard/panorama")}
          >
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${
                  alertsCount && alertsCount > 0
                    ? "bg-orange-100 text-orange-600"
                    : "bg-muted text-muted-foreground"
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                {alertsCount && alertsCount > 0 ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                  </span>
                ) : null}
              </div>
              <p className="data-value text-3xl">{alertsCount ?? 0}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Alertas activas</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Activity + Sentiment Breakdown ── */}
      {stats && stats.total > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="data-card overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border">
                {/* Sparkline */}
                <div className="md:col-span-3 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="section-label">Actividad · 7 días</p>
                    <span className="text-xs text-muted-foreground font-mono">{stats.total} total</span>
                  </div>
                  <div className="flex items-end gap-[3px] h-16">
                    {stats.sparkline.map((v, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max((v / maxSparkline) * 100, 3)}%` }}
                        transition={{ delay: 0.3 + i * 0.04, duration: 0.4 }}
                        className="flex-1 bg-primary/25 hover:bg-primary/50 rounded-sm transition-colors cursor-default relative group"
                        title={`${v} menciones`}
                      >
                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {v}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5">
                    {stats.sparkline.map((_, i) => (
                      <span key={i} className="text-[9px] text-muted-foreground text-center flex-1">
                        {format(subDays(new Date(), 6 - i), "EEE", { locale: es })}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Sentiment breakdown */}
                <div className="md:col-span-2 p-5">
                  <p className="section-label mb-3">Distribución de sentimiento</p>
                  <div className="space-y-3">
                    <SentimentRow
                      label="Positivo"
                      count={stats.positivo}
                      total={stats.total}
                      color="bg-green-500"
                      textColor="text-green-600"
                    />
                    <SentimentRow
                      label="Neutral"
                      count={stats.neutral}
                      total={stats.total}
                      color="bg-blue-400"
                      textColor="text-blue-500"
                    />
                    <SentimentRow
                      label="Negativo"
                      count={stats.negativo}
                      total={stats.total}
                      color="bg-red-500"
                      textColor="text-red-600"
                    />
                    {stats.sinAnalizar > 0 && (
                      <SentimentRow
                        label="Sin analizar"
                        count={stats.sinAnalizar}
                        total={stats.total}
                        color="bg-muted-foreground/30"
                        textColor="text-muted-foreground"
                      />
                    )}
                  </div>
                  {stats.topSources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="section-label mb-2 !text-[9px]">Fuentes principales · 24h</p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.topSources.map(([source, count]) => (
                          <Badge key={source} variant="secondary" className="text-[10px] font-mono">
                            {source} <span className="ml-1 text-muted-foreground">{count}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── AI Summary ── */}
      <DailyIntelligenceSummary projectId={selectedProject.id} projectName={selectedProject.nombre} />

      {/* ── Recent Mentions + Actions ── */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 data-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Últimas menciones</h2>
                {stats?.recentMentions && stats.recentMentions.filter(m => !m.is_read).length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">
                    {stats.recentMentions.filter(m => !m.is_read).length} nuevas
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => navigate("/dashboard/fuentes")}>
                Ver todas <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            {stats?.recentMentions && stats.recentMentions.length > 0 ? (
              <div className="space-y-1">
                {stats.recentMentions.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => m.url && window.open(m.url, "_blank")}
                  >
                    <SentimentDot sentiment={m.sentiment} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate transition-colors ${m.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'} group-hover:text-primary`}>
                        {m.title || "Sin título"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {m.source_domain?.replace(/^www\./, "").split(".")[0] || "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatTimeAgo(new Date(m.published_at ?? m.created_at))}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin menciones recientes</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/dashboard/fuentes")}>
                  Buscar menciones
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick nav */}
        <Card className="data-card">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Acceso rápido</h2>
            <div className="space-y-1.5">
              <QuickNav icon={<Search className="h-4 w-4" />} label="Capturar" desc="Buscar en fuentes" onClick={() => navigate("/dashboard/fuentes")} />
              <QuickNav icon={<Eye className="h-4 w-4" />} label="Panorama" desc="Vista general" onClick={() => navigate("/dashboard/panorama")} />
              <QuickNav icon={<BarChart3 className="h-4 w-4" />} label="Semántica" desc="Análisis profundo" onClick={() => navigate("/dashboard/semantica")} />
              <QuickNav icon={<FileText className="h-4 w-4" />} label="Reporte" desc="Generar con IA" onClick={() => navigate("/dashboard/reportes")} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/* ── Sub-components ── */

function SentimentRow({ label, count, total, color, textColor }: {
  label: string; count: number; total: number; color: string; textColor: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs w-20 ${textColor}`}>{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-10 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: string | null }) {
  const color =
    sentiment === "positivo" ? "bg-green-500"
    : sentiment === "negativo" ? "bg-red-500"
    : sentiment === "neutral" ? "bg-blue-400"
    : "bg-muted-foreground/30";
  return <div className={`h-2 w-2 rounded-full shrink-0 ${color}`} />;
}

function QuickNav({ icon, label, desc, onClick }: {
  icon: React.ReactNode; label: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
    >
      <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function formatTimeAgo(date: Date): string {
  const mins = differenceInMinutes(new Date(), date);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default DashboardHomePage;
