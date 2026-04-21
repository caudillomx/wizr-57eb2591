import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";
import { Target, Sparkles, Lightbulb, Trophy, TrendingUp, Users2, FileText } from "lucide-react";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { EditableText } from "./EditableText";
import { NetworkBadge } from "@/components/rankings/NetworkBadge";

interface PerformanceReportViewProps {
  report: PerformanceReportContent;
  editing?: boolean;
  onUpdate?: (patch: Partial<PerformanceReportContent>) => void;
  dateLabel: string;
}

// Paleta consistente por marca (no gris). Marca propia siempre = primary (violeta Wizr).
const BRAND_PALETTE = [
  "#4338ca", // indigo
  "#f97316", // orange
  "#22c55e", // green
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#eab308", // amber
  "#ef4444", // red
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#a855f7", // purple
  "#f59e0b", // amber-500
];

// Color por red social (consistente con badges de la app)
const NETWORK_COLOR: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  x: "#1DA1F2",
  tiktok: "#000000",
  linkedin: "#0A66C2",
};

function colorForBrand(brand: string, isOwn: boolean, brandsList: string[]): string {
  if (isOwn) return "hsl(var(--primary))";
  const idx = brandsList.findIndex((b) => b === brand);
  return BRAND_PALETTE[(idx + 1) % BRAND_PALETTE.length];
}

function colorForNetwork(network: string): string {
  return NETWORK_COLOR[network.toLowerCase()] || "hsl(var(--primary))";
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

export function PerformanceReportView({
  report, editing = false, onUpdate, dateLabel,
}: PerformanceReportViewProps) {
  const isBrand = report.reportMode === "brand";
  const update = (patch: Partial<PerformanceReportContent>) => onUpdate?.(patch);

  const updateArrayItem = (key: "keyFindings" | "recommendations", index: number, value: string) => {
    const arr = [...(report[key] || [])];
    arr[index] = value;
    update({ [key]: arr } as Partial<PerformanceReportContent>);
  };

  const networkLabel = (n: string) => {
    const map: Record<string, string> = {
      facebook: "Facebook", instagram: "Instagram", youtube: "YouTube",
      twitter: "X", x: "X", tiktok: "TikTok", linkedin: "LinkedIn",
    };
    return map[n.toLowerCase()] || n;
  };

  // Brand list ordering for stable color assignment
  const brandsList = (report.analytics?.brandEngagement ?? []).map((b) => b.brand);

  // Custom Y-axis tick: marca arriba, red abajo
  const TwoLineTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    if (!payload?.value) return null;
    const [line1, line2] = payload.value.split("|");
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-8} y={-2} textAnchor="end" fontSize={10} fontWeight={600} fill="hsl(var(--foreground))">{line1}</text>
        {line2 && <text x={-8} y={10} textAnchor="end" fontSize={9} fill="hsl(var(--muted-foreground))">{line2}</text>}
      </g>
    );
  };

  const rankingValid = (report.analytics?.rankingByEngagement ?? []).filter((r) => r.hasData !== false && r.engagement > 0);
  const rankingChartData = rankingValid.slice(0, 10).map((r) => ({
    name: `${r.name}|${networkLabel(r.network)}`,
    fullName: r.name,
    network: r.network,
    value: r.engagement,
    fill: r.isOwn ? "hsl(var(--primary))" : colorForNetwork(r.network),
    isOwn: r.isOwn,
  }));

  const sovChartData = (report.analytics?.shareOfVoice ?? [])
    .filter((s) => s.engagementShare > 0)
    .slice(0, 8)
    .map((s, i) => ({
      name: s.name,
      value: s.engagementShare,
      isOwn: s.isOwn,
      fill: s.isOwn ? "hsl(var(--primary))" : BRAND_PALETTE[(i + 1) % BRAND_PALETTE.length],
    }));

  return (
    <div className="space-y-8">
      {/* ── Editorial header (Listening identity) ── */}
      <div
        className="rounded-xl px-8 py-7 text-white shadow-md"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
        }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.2em] px-2.5 py-1 rounded"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#c7d2fe" }}
            >
              {isBrand ? "PERFORMANCE · MARCA" : "PERFORMANCE · BENCHMARK"}
            </span>
            <span className="text-[10px] font-medium tracking-wider px-2.5 py-1 rounded bg-white/10 text-white/90">
              {report.clientName}
            </span>
          </div>
          <span className="text-[11px] font-semibold tracking-wider px-3 py-1.5 rounded-full bg-white/10 text-white/90 inline-flex items-center gap-1.5">
            {isBrand ? <Target className="h-3 w-3" /> : <Users2 className="h-3 w-3" />}
            {dateLabel}
          </span>
        </div>
        <EditableText
          editing={editing}
          value={report.title}
          onChange={(v) => update({ title: v })}
          className="text-3xl font-bold block leading-tight mb-3 text-white"
          placeholder="Título del reporte"
        />
        <div className="h-px bg-white/15 my-3" />
        <EditableText
          editing={editing}
          value={report.summary}
          onChange={(v) => update({ summary: v })}
          multiline
          minRows={3}
          className="block text-[13.5px] leading-[1.7] text-white/85"
          placeholder="Resumen ejecutivo"
        />
      </div>

      {/* ── KPI Cards (4, accionables, con unidad + contexto) ── */}
      {(report.highlights?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {report.highlights!.slice(0, 4).map((h, i) => (
            <Card key={i} className="border-l-4 border-l-primary/60 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
              <CardContent className="p-4 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">
                  {h.label}
                </div>
                <div className="text-[22px] font-bold text-primary leading-tight break-words">
                  {h.value}
                </div>
                <div className="text-xs text-muted-foreground leading-snug">{h.context}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Brecha Actinver vs líder (benchmark only) ── */}
      {!isBrand && report.analytics.ownBrandGap && (
        <Card className="bg-gradient-to-r from-orange-500/5 to-transparent border-orange-500/30">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-orange-500/15 p-2"><TrendingUp className="h-4 w-4 text-orange-600" /></div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-orange-600">Brecha competitiva</div>
                <div className="text-sm font-medium">
                  {report.clientName} promedia <strong>{report.analytics.ownBrandGap.ownAvg.toFixed(2)}%</strong> de engagement
                  · líder <strong>{report.analytics.ownBrandGap.leaderName}</strong> con <strong>{report.analytics.ownBrandGap.leaderAvg.toFixed(2)}%</strong>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-orange-600">{report.analytics.ownBrandGap.multiple}×</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Por debajo</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Engagement promedio por marca (agregado) — solo BENCHMARK ── */}
      {!isBrand && report.analytics.brandEngagement.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Engagement promedio por marca
            </CardTitle>
            <CardDescription className="text-xs">
              Suma de los perfiles de cada marca · {report.clientName} resaltado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.analytics.brandEngagement.slice(0, 12).map((b) => ({
                    name: b.brand.length > 18 ? `${b.brand.substring(0, 16)}…` : b.brand,
                    fullName: b.brand,
                    value: b.avgEngagement,
                    profiles: b.profiles,
                    fill: b.isOwn ? "hsl(var(--primary))" : "#94a3b8",
                  }))}
                  layout="vertical"
                  margin={{ top: 8, right: 30, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.fullName}</div>
                          <div className="text-muted-foreground">{p.value.toFixed(2)}% engagement · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {report.analytics.brandEngagement.slice(0, 12).map((b, i) => (
                      <Cell key={i} fill={b.isOwn ? "hsl(var(--primary))" : "#94a3b8"} />
                    ))}
                    <LabelList dataKey="value" position="right" formatter={(v: number) => `${v.toFixed(2)}%`} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
                {report.clientName}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-400" />
                Competencia
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Ranking por engagement (perfiles individuales) — solo cuando hay >1 perfil ── */}
      {rankingChartData.length > 1 && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            {isBrand
              ? `Engagement por perfil · ${report.clientName}`
              : `Top perfiles por engagement (Top ${Math.min(rankingChartData.length, 10)})`}
          </CardTitle>
          <CardDescription className="text-xs">
            {isBrand
              ? "Comparativa interna entre los perfiles de la marca en sus distintas redes"
              : "Engagement rate por perfil individual · vista detallada por red"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rankingChartData.length === 0 ? (
            <div className="h-[200px] flex flex-col items-center justify-center text-center px-4">
              <Trophy className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Sin datos de engagement en este período</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Fanpage Karma aún no ha calculado el engagement rate. Prueba un período más amplio.
              </p>
            </div>
          ) : (
            <>
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingChartData} layout="vertical" margin={{ top: 8, right: 50, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={(props) => <TwoLineTick {...props} />} width={170} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                            <div className="font-semibold">{p.fullName}</div>
                            <div className="text-muted-foreground">{networkLabel(p.network)} · tasa de engagement {p.value.toFixed(2)}%</div>
                            {p.isOwn && <div className="text-primary text-[10px] uppercase mt-0.5">Marca propia</div>}
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {rankingChartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      <LabelList dataKey="value" position="right" formatter={(v: number) => `${v.toFixed(2)}%`} fontSize={10} fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Lectura: ranking por tasa de engagement (interacciones / seguidores). Cada barra usa el color de su red social para identificar de un vistazo dónde está la conversación; los perfiles de {report.clientName} se resaltan en violeta.
              </p>
              {report.rankingInsight && (
                <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/40">
                  <EditableText
                    editing={editing}
                    value={report.rankingInsight}
                    onChange={(v) => update({ rankingInsight: v })}
                    multiline
                    minRows={2}
                    className="block"
                    placeholder="Lectura del ranking…"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── Crecimiento por red social (agregado) ── */}
      {report.analytics.networkGrowth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Crecimiento promedio por red social
            </CardTitle>
            <CardDescription className="text-xs">
              Promedio de growth % de seguidores por plataforma en el período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.analytics.networkGrowth.map((n) => ({
                  name: n.network.charAt(0).toUpperCase() + n.network.slice(1),
                  value: n.avgGrowth,
                  profiles: n.profiles,
                  fill: n.avgGrowth >= 0 ? "#22c55e" : "#ef4444",
                }))} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">{p.value.toFixed(2)}% · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {report.analytics.networkGrowth.map((n, i) => (
                      <Cell key={i} fill={n.avgGrowth >= 0 ? "#22c55e" : "#ef4444"} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(v: number) => `${v.toFixed(2)}%`} fontSize={10} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {isBrand
                ? `Lectura: cada barra muestra cómo evolucionó el número de seguidores de ${report.clientName} en cada red durante el período. Verde indica ganancia neta de audiencia; rojo, pérdida.`
                : "Lectura: promedio del crecimiento de seguidores agregado por red en todo el set (marca + competencia). Permite ver qué plataforma está sumando audiencia en el sector y cuál se contrae."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Share of voice agrupado por marca (benchmark only) ── */}
      {!isBrand && report.analytics.brandEngagement.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              Share of voice por marca (engagement)
            </CardTitle>
            <CardDescription className="text-xs">
              Participación de cada marca en el engagement total · agregando todas sus redes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const total = report.analytics.brandEngagement.reduce((s, b) => s + b.avgEngagement, 0) || 1;
              const data = report.analytics.brandEngagement
                .filter((b) => b.avgEngagement > 0)
                .map((b) => ({
                  name: b.brand.length > 18 ? `${b.brand.substring(0, 16)}…` : b.brand,
                  fullName: b.brand,
                  value: Math.round((b.avgEngagement / total) * 1000) / 10,
                  isOwn: b.isOwn,
                  fill: b.isOwn ? "hsl(var(--primary))" : "#94a3b8",
                }));
              return (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 30, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload;
                          return (
                            <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                              <div className="font-semibold">{p.fullName}</div>
                              <div className="text-muted-foreground">{p.value.toFixed(1)}% del engagement total</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        <LabelList dataKey="value" position="right" formatter={(v: number) => `${v.toFixed(1)}%`} fontSize={10} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
            {report.sovInsight && (
              <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/40">
                <EditableText
                  editing={editing}
                  value={report.sovInsight}
                  onChange={(v) => update({ sovInsight: v })}
                  multiline
                  minRows={2}
                  className="block"
                  placeholder="Lectura del share of voice…"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Seguidores por perfil (Top 15) — solo BENCHMARK ── */}
      {!isBrand && report.analytics.followersByProfile?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              Perfiles con más seguidores (Top 15)
            </CardTitle>
            <CardDescription className="text-xs">
              Tamaño de audiencia por perfil · {report.clientName} resaltado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.analytics.followersByProfile.slice(0, 15).map((f) => ({
                    name: `${f.name.length > 14 ? f.name.substring(0, 12) + "…" : f.name} · ${networkShort(f.network)}`,
                    fullName: f.name,
                    network: f.network,
                    value: f.followers,
                    isOwn: f.isOwn,
                  }))}
                  margin={{ top: 16, right: 16, left: 0, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} height={70} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatNumber} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.fullName}</div>
                          <div className="text-muted-foreground">{p.network} · {formatNumber(p.value)} seguidores</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {report.analytics.followersByProfile.slice(0, 15).map((f, i) => (
                      <Cell key={i} fill={f.isOwn ? "hsl(var(--primary))" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              Lectura: ranking de los perfiles con mayor audiencia del set. Permite dimensionar la brecha de alcance potencial entre {report.clientName} y la competencia.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Engagement promedio por red social ── */}
      {report.analytics.networkEngagement?.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Engagement promedio por red social
            </CardTitle>
            <CardDescription className="text-xs">
              {isBrand
                ? `¿En qué red está logrando ${report.clientName} mayor tasa de interacción?`
                : "¿Qué plataforma genera más interacción en el sector?"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.analytics.networkEngagement.map((n) => ({
                  name: networkLabel(n.network),
                  network: n.network,
                  value: n.avgEngagement,
                  profiles: n.profiles,
                }))} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[0, "auto"]} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-muted-foreground">tasa de engagement {p.value.toFixed(2)}% · {p.profiles} perfil(es)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {report.analytics.networkEngagement.map((n, i) => (
                      <Cell key={i} fill={colorForNetwork(n.network)} />
                    ))}
                    <LabelList dataKey="value" position="top" formatter={(v: number) => `${v.toFixed(2)}%`} fontSize={10} fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
              {isBrand
                ? `Lectura: cada barra muestra la tasa de interacción promedio (interacciones ÷ seguidores) que ${report.clientName} consigue en cada red donde está presente. Sirve para identificar qué canal está activando mejor a la audiencia propia y dónde hay que ajustar contenido o cadencia.`
                : `Lectura: cada barra es la tasa de engagement promedio de todos los perfiles del sector en esa red, no solo los de ${report.clientName}. Una tasa muy baja indica que el canal está saturado para todas las marcas; una tasa alta señala dónde la audiencia sí está reaccionando y vale la pena invertir contenido.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Cuota de interacciones (donut por marca) ── */}
      {!isBrand && report.analytics.brandEngagement.length > 0 && (() => {
        const total = report.analytics.brandEngagement.reduce((s, b) => s + b.avgEngagement, 0) || 1;
        const donutData = report.analytics.brandEngagement
          .filter((b) => b.avgEngagement > 0)
          .map((b, i) => ({
            name: b.brand,
            value: Math.round((b.avgEngagement / total) * 1000) / 10,
            isOwn: b.isOwn,
            fill: b.isOwn ? "hsl(var(--primary))" : COLORS[(i + 1) % COLORS.length],
          }));
        if (donutData.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users2 className="h-4 w-4 text-primary" />
                Cuota de interacciones por marca
              </CardTitle>
              <CardDescription className="text-xs">
                ¿Qué marca obtuvo mayor participación del engagement total?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={120}
                      paddingAngle={2}
                      label={({ name, value }) => `${name} · ${value}%`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }}
                    >
                      {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-md border bg-background p-2 shadow-md text-xs">
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-muted-foreground">{p.value}% del engagement total</div>
                            {p.isOwn && <div className="text-primary text-[10px] uppercase mt-0.5">Marca propia</div>}
                          </div>
                        );
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Tabla compacta de perfiles ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3Icon />
            {isBrand
              ? `Perfiles de ${report.clientName} · detalle`
              : `Top ${Math.min(report.profiles?.length ?? 0, 10)} perfiles por engagement`}
          </CardTitle>
          <CardDescription className="text-xs">
            Tabla resumen · ordenada por engagement rate
          </CardDescription>
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
                {[...(report.profiles ?? [])]
                  .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))
                  .slice(0, 10)
                  .map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
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
          {(report.profiles?.length ?? 0) > 10 && (
            <div className="p-3 text-xs text-muted-foreground text-center border-t bg-muted/20">
              Mostrando 10 de {report.profiles.length} perfiles. El detalle completo está en el PDF descargable.
            </div>
          )}
          {report.profilesInsight && (
            <div className="m-4 rounded-md bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground border-l-2 border-primary/40">
              <EditableText
                editing={editing}
                value={report.profilesInsight}
                onChange={(v) => update({ profilesInsight: v })}
                multiline
                minRows={2}
                className="block"
                placeholder="Lectura de los perfiles…"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top content */}
      {(report.topPosts?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Mejores contenidos del período
            </CardTitle>
            <CardDescription className="text-xs">
              Top {Math.min(report.topPosts!.length, 5)} posts por engagement
            </CardDescription>
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
          </CardContent>
          {report.topContentInsight && (
            <CardContent className="pt-0">
              <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm">
                <EditableText
                  editing={editing}
                  value={report.topContentInsight}
                  onChange={(v) => update({ topContentInsight: v })}
                  multiline
                  minRows={2}
                  className="block text-muted-foreground"
                  placeholder="Análisis del contenido top"
                />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Competitive insight (benchmark only) */}
      {!isBrand && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Posicionamiento competitivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditableText
              editing={editing}
              value={report.competitiveInsight}
              onChange={(v) => update({ competitiveInsight: v })}
              multiline
              minRows={3}
              className="block text-sm text-muted-foreground"
              placeholder="Análisis de posicionamiento competitivo"
            />
          </CardContent>
        </Card>
      )}

      {/* ── Hallazgos clave (editorial) ── */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">
              Sección 01
            </span>
          </div>
          <CardTitle className="text-xl font-bold mt-1">Hallazgos clave</CardTitle>
          <CardDescription className="text-xs">
            Lectura crítica del período · {report.clientName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {(report.keyFindings ?? []).map((f, i) => (
              <li key={i} className="flex gap-4 pb-5 border-b last:border-0 last:pb-0">
                <span className="flex-shrink-0 text-3xl font-bold text-primary leading-none tabular-nums w-10">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <EditableText
                  editing={editing}
                  value={f}
                  onChange={(v) => updateArrayItem("keyFindings", i, v)}
                  multiline
                  minRows={2}
                  className="flex-1 block text-[13.5px] leading-[1.7] text-foreground"
                />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Recomendaciones (editorial) ── */}
      <Card className="border-l-4" style={{ borderLeftColor: "#f97316" }}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" style={{ color: "#f97316" }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#f97316" }}>
              Sección 02
            </span>
          </div>
          <CardTitle className="text-xl font-bold mt-1">Recomendaciones</CardTitle>
          <CardDescription className="text-xs">
            Decisiones accionables · ámbito digital
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {(report.recommendations ?? []).map((r, i) => (
              <li key={i} className="flex gap-4 pb-5 border-b last:border-0 last:pb-0">
                <span
                  className="flex-shrink-0 text-3xl font-bold leading-none tabular-nums w-10"
                  style={{ color: "#f97316" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <EditableText
                  editing={editing}
                  value={r}
                  onChange={(v) => updateArrayItem("recommendations", i, v)}
                  multiline
                  minRows={2}
                  className="flex-1 block text-[13.5px] leading-[1.7] text-foreground"
                />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ── Conclusión (editorial closing) ── */}
      {report.conclusion && (
        <div
          className="rounded-xl px-8 py-7 text-white shadow-md"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4" style={{ color: "#c7d2fe" }} />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: "#c7d2fe" }}>
              Conclusión ejecutiva
            </span>
          </div>
          <EditableText
            editing={editing}
            value={report.conclusion}
            onChange={(v) => update({ conclusion: v })}
            multiline
            minRows={2}
            className="block text-[14px] leading-[1.75] text-white/90"
            placeholder="Conclusión ejecutiva"
          />
        </div>
      )}
    </div>
  );
}

// inline icon to avoid extra import
function BarChart3Icon() {
  return (
    <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M7 16V8" /><path d="M12 16v-5" /><path d="M17 16v-3" />
    </svg>
  );
}
