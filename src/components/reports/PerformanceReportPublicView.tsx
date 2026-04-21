import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";
import { Target, Sparkles, Lightbulb, Trophy, TrendingUp, Users2, FileText, BarChart3, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { NetworkBadge } from "@/components/rankings/NetworkBadge";

interface PerformanceReportPublicViewProps {
  report: PerformanceReportContent;
  clientName: string;
  dateRange: { start: string; end: string; label: string };
}

const COLORS = [
  "hsl(var(--primary))", "#f97316", "#22c55e", "#06b6d4",
  "#8b5cf6", "#ec4899", "#eab308", "#ef4444",
];

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n).toLocaleString("es-MX")}`;
}

function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("es-MX");
}

/**
 * Read-only, prop-driven version of PerformanceReportView for public sharing.
 * No editing, no internal state, no hooks beyond Recharts. Includes Wizr branded header.
 */
export function PerformanceReportPublicView({
  report, clientName, dateRange,
}: PerformanceReportPublicViewProps) {
  const isBrand = report.reportMode === "brand";
  const [showAllProfiles, setShowAllProfiles] = useState(false);

  const networkShort = (n: string) => {
    const map: Record<string, string> = {
      facebook: "FB", instagram: "IG", youtube: "YT", twitter: "X",
      tiktok: "TT", linkedin: "LI", threads: "TH",
    };
    return map[n.toLowerCase()] || n;
  };

  const rankingValid = report.analytics.rankingByEngagement.filter((r: any) => r.hasData !== false && r.engagement > 0);
  const rankingChartData = rankingValid.slice(0, 10).map((r) => {
    const labelBase = `${r.name} · ${networkShort(r.network)}`;
    return {
      name: labelBase.length > 26 ? `${labelBase.substring(0, 24)}…` : labelBase,
      fullName: r.name,
      network: r.network,
      value: r.engagement,
      fill: r.isOwn ? "hsl(var(--primary))" : "hsl(215, 16%, 65%)",
      isOwn: r.isOwn,
    };
  });

  const sovChartData = report.analytics.shareOfVoice
    .filter((s) => s.engagementShare > 0)
    .slice(0, 8)
    .map((s, i) => ({
      name: s.name,
      value: s.engagementShare,
      isOwn: s.isOwn,
      fill: s.isOwn ? "hsl(var(--primary))" : COLORS[(i + 1) % COLORS.length],
    }));

  const profilesToShow = showAllProfiles ? report.profiles : report.profiles.slice(0, 12);
  const hiddenCount = report.profiles.length - profilesToShow.length;

  return (
    <div className="bg-white">
      {/* Wizr branded header */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground px-8 py-10">
        <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.22em] opacity-80">Wizr · Performance</div>
              <div className="text-sm font-medium opacity-90">
                {isBrand ? "Reporte de Marca" : "Reporte de Benchmark"}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/15 text-primary-foreground border-0 backdrop-blur whitespace-nowrap flex-shrink-0">
            {dateRange.label}
          </Badge>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold leading-tight break-words">{report.title}</h1>
          <p className="text-sm opacity-90">
            <span className="font-medium">{clientName}</span>
            <span className="opacity-75"> · {dateRange.start} → {dateRange.end}</span>
          </p>
        </div>

        {report.summary && (
          <p className="text-sm leading-relaxed opacity-95 max-w-3xl mt-5 pt-5 border-t border-white/15">
            {report.summary}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="px-8 py-10 space-y-8">
        {/* Highlights */}
        {report.highlights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {report.highlights.map((h, i) => (
              <Card key={i} className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                <CardContent className="p-4 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium leading-tight min-h-[28px]">
                    {h.label}
                  </div>
                  <div className="text-xl font-bold text-primary leading-tight break-words hyphens-auto">{h.value}</div>
                  <div className="text-xs text-muted-foreground leading-snug">{h.context}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Perfiles</div>
              <div className="text-2xl font-bold">{report.profiles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Engagement promedio</div>
              <div className="text-2xl font-bold">{report.analytics.avgEngagement}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Crecimiento promedio</div>
              <div className="text-2xl font-bold">{report.analytics.avgGrowth}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total seguidores</div>
              <div className="text-2xl font-bold">{formatNumber(report.analytics.totalFollowers)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Ranking chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Ranking por engagement
            </CardTitle>
            <CardDescription className="text-xs">
              {isBrand ? "Engagement rate por perfil de la marca" : "Marca propia (color primario) vs competencia"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rankingChartData.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-center px-4">
                <Trophy className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Sin datos de engagement en este período</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Los perfiles del rango seleccionado aún no tienen engagement rate calculado.
                </p>
              </div>
            ) : (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingChartData} layout="vertical" margin={{ top: 8, right: 50, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} interval={0} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                            <div className="font-semibold">{p.fullName}</div>
                            <div className="text-muted-foreground">{p.network} · {p.value}%</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {rankingChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      <LabelList dataKey="value" position="right" formatter={(v: number) => `${v}%`} fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SoV (benchmark) */}
        {!isBrand && sovChartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users2 className="h-4 w-4 text-primary" />
                Share of voice (engagement)
              </CardTitle>
              <CardDescription className="text-xs">
                Distribución del engagement total entre las marcas del set
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sovChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}%`}
                      labelLine={false}
                      fontSize={11}
                    >
                      {sovChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profiles table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métricas por perfil</CardTitle>
            <CardDescription className="text-xs">
              {report.profiles.length} perfiles analizados en el período
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b sticky top-0">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Perfil</th>
                    <th className="px-4 py-2.5 font-medium">Red</th>
                    {!isBrand && <th className="px-4 py-2.5 font-medium">Tipo</th>}
                    <th className="px-4 py-2.5 font-medium text-right">Seguidores</th>
                    <th className="px-4 py-2.5 font-medium text-right">Crecimiento</th>
                    <th className="px-4 py-2.5 font-medium text-right">Engagement</th>
                    <th className="px-4 py-2.5 font-medium text-right">Posts/día</th>
                  </tr>
                </thead>
                <tbody>
                  {profilesToShow.map((p, idx) => (
                    <tr key={p.id} className={`border-b last:border-0 ${idx % 2 === 1 ? "bg-muted/20" : ""} hover:bg-muted/40 transition-colors`}>
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2"><NetworkBadge network={p.network} size="xs" /></td>
                      {!isBrand && (
                        <td className="px-4 py-2">
                          <Badge variant={p.isCompetitor ? "outline" : "default"} className="text-[10px]">
                            {p.isCompetitor ? "Competencia" : "Marca"}
                          </Badge>
                        </td>
                      )}
                      <td className="px-4 py-2 text-right tabular-nums">{p.followers != null ? formatNumber(p.followers) : "—"}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${p.growthPercent != null && p.growthPercent < 0 ? "text-destructive" : p.growthPercent != null && p.growthPercent > 0 ? "text-green-600" : ""}`}>
                        {p.growthPercent != null ? `${p.growthPercent > 0 ? "+" : ""}${p.growthPercent.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">{p.engagementRate != null ? `${p.engagementRate.toFixed(2)}%` : "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.postsPerDay != null ? p.postsPerDay.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hiddenCount > 0 && (
              <div className="border-t bg-muted/20 p-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllProfiles(true)}
                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Ver {hiddenCount} perfiles más
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top content */}
        {report.topPosts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Mejores contenidos del período
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.topPosts.slice(0, 5).map((p, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2 hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold text-primary">#{i + 1}</span>
                    <span className="font-medium">{p.authorName}</span>
                    <NetworkBadge network={p.network} size="xs" />
                    <span className="text-muted-foreground">· {p.postDate}</span>
                  </div>
                  {p.postContent && (
                    <p className="text-sm line-clamp-3 text-muted-foreground">{p.postContent}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Engagement: <strong className="text-foreground tabular-nums">{formatInt(p.engagement)}</strong></span>
                    <span>Likes: <span className="tabular-nums">{formatInt(p.likes)}</span></span>
                    <span>Comentarios: <span className="tabular-nums">{formatInt(p.comments)}</span></span>
                    {p.shares > 0 && <span>Compartidos: <span className="tabular-nums">{formatInt(p.shares)}</span></span>}
                    {p.views > 0 && <span>Vistas: <span className="tabular-nums">{formatInt(p.views)}</span></span>}
                  </div>
                  {p.postUrl && (
                    <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      Ver publicación →
                    </a>
                  )}
                </div>
              ))}
              {report.topContentInsight && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-4 text-sm text-foreground/80 leading-relaxed">
                  {report.topContentInsight}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Competitive insight */}
        {!isBrand && report.competitiveInsight && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Posicionamiento competitivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{report.competitiveInsight}</p>
            </CardContent>
          </Card>
        )}

        {/* Findings */}
        {report.keyFindings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Hallazgos clave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3.5">
                {report.keyFindings.map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1">{f}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Recomendaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3.5">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-xs flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1">{r}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Conclusion */}
        {report.conclusion && (
          <Card className="bg-gradient-to-br from-primary/5 via-muted/30 to-transparent border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Conclusión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line leading-relaxed">{report.conclusion}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
