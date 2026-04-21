import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";
import { Target, Sparkles, Lightbulb, Trophy, TrendingUp, Users2, FileText, BarChart3 } from "lucide-react";
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
  return `${Math.round(n)}`;
}

/**
 * Read-only, prop-driven version of PerformanceReportView for public sharing.
 * No editing, no internal state, no hooks beyond Recharts. Includes Wizr branded header.
 */
export function PerformanceReportPublicView({
  report, clientName, dateRange,
}: PerformanceReportPublicViewProps) {
  const isBrand = report.reportMode === "brand";

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
      name: labelBase.length > 22 ? `${labelBase.substring(0, 20)}…` : labelBase,
      fullName: r.name,
      network: r.network,
      value: r.engagement,
      fill: r.isOwn ? "hsl(var(--primary))" : "hsl(215, 16%, 57%)",
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

  return (
    <div className="bg-white">
      {/* Wizr branded header */}
      <div className="bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground px-8 py-10 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] opacity-80">Wizr · Performance</div>
              <div className="text-sm font-medium opacity-90">
                {isBrand ? "Reporte de Marca" : "Reporte de Benchmark"}
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/15 text-primary-foreground border-0 backdrop-blur">
            {dateRange.label}
          </Badge>
        </div>

        <div className="space-y-2 pt-2">
          <h1 className="text-3xl font-bold leading-tight">{report.title}</h1>
          <p className="text-sm opacity-90">
            <span className="font-medium">{clientName}</span>
            <span className="opacity-75"> · {dateRange.start} → {dateRange.end}</span>
          </p>
        </div>

        {report.summary && (
          <p className="text-sm leading-relaxed opacity-95 max-w-3xl pt-2 border-t border-white/15">
            {report.summary}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="px-8 py-8 space-y-6">
        {/* Highlights */}
        {report.highlights.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {report.highlights.map((h, i) => (
              <Card key={i} className="bg-gradient-to-br from-primary/5 to-transparent">
                <CardContent className="p-4 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {h.label}
                  </div>
                  <div className="text-2xl font-bold text-primary">{h.value}</div>
                  <div className="text-xs text-muted-foreground">{h.context}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              {isBrand ? "Engagement rate por perfil de la marca" : "Marca propia vs competencia"}
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
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingChartData} layout="vertical" margin={{ top: 8, right: 30, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} />
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
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sovChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value }) => `${name}: ${value}%`}
                      labelLine={false}
                      fontSize={10}
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
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Perfil</th>
                    <th className="px-4 py-2 font-medium">Red</th>
                    {!isBrand && <th className="px-4 py-2 font-medium">Tipo</th>}
                    <th className="px-4 py-2 font-medium text-right">Seguidores</th>
                    <th className="px-4 py-2 font-medium text-right">Crecimiento</th>
                    <th className="px-4 py-2 font-medium text-right">Engagement</th>
                    <th className="px-4 py-2 font-medium text-right">Posts/día</th>
                  </tr>
                </thead>
                <tbody>
                  {report.profiles.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2"><NetworkBadge network={p.network} size="xs" /></td>
                      {!isBrand && (
                        <td className="px-4 py-2">
                          <Badge variant={p.isCompetitor ? "outline" : "default"} className="text-[10px]">
                            {p.isCompetitor ? "Competencia" : "Marca"}
                          </Badge>
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">{p.followers != null ? formatNumber(p.followers) : "—"}</td>
                      <td className={`px-4 py-2 text-right ${p.growthPercent != null && p.growthPercent < 0 ? "text-destructive" : p.growthPercent != null && p.growthPercent > 0 ? "text-green-600" : ""}`}>
                        {p.growthPercent != null ? `${p.growthPercent > 0 ? "+" : ""}${p.growthPercent.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{p.engagementRate != null ? `${p.engagementRate.toFixed(2)}%` : "—"}</td>
                      <td className="px-4 py-2 text-right">{p.postsPerDay != null ? p.postsPerDay.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <div key={i} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold">#{i + 1}</span>
                    <span className="font-medium">{p.authorName}</span>
                    <NetworkBadge network={p.network} size="xs" />
                    <span className="text-muted-foreground">· {p.postDate}</span>
                  </div>
                  {p.postContent && (
                    <p className="text-sm line-clamp-3 text-muted-foreground">{p.postContent}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Engagement: <strong className="text-foreground">{formatNumber(p.engagement)}</strong></span>
                    <span>Likes: {formatNumber(p.likes)}</span>
                    <span>Comentarios: {formatNumber(p.comments)}</span>
                    {p.shares > 0 && <span>Compartidos: {formatNumber(p.shares)}</span>}
                    {p.views > 0 && <span>Vistas: {formatNumber(p.views)}</span>}
                  </div>
                  {p.postUrl && (
                    <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      Ver publicación →
                    </a>
                  )}
                </div>
              ))}
              {report.topContentInsight && (
                <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
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
              <p className="text-sm text-muted-foreground whitespace-pre-line">{report.competitiveInsight}</p>
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
              <ol className="space-y-3">
                {report.keyFindings.map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm">
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
              <ol className="space-y-3">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm">
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
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Conclusión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-line">{report.conclusion}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
