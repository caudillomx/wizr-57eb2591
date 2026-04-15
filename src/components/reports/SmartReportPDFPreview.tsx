import { forwardRef, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type {
  SmartReportContent,
  InfluencerInfo,
  SourceBreakdown,
  NarrativeInfo,
  TimelinePoint,
  ReportType,
} from "@/hooks/useSmartReport";

/* ─── helpers ─── */

function safeDate(iso: string) {
  try { return format(new Date(iso), "d MMM yyyy", { locale: es }); }
  catch { return iso.split("T")[0]; }
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function platformLabel(d: string) {
  const m: Record<string, string> = {
    "twitter.com": "X/Twitter", "x.com": "X/Twitter", twitter: "X/Twitter",
    "facebook.com": "Facebook", facebook: "Facebook",
    "instagram.com": "Instagram", instagram: "Instagram",
    "tiktok.com": "TikTok", tiktok: "TikTok",
    "youtube.com": "YouTube", youtube: "YouTube",
    "reddit.com": "Reddit", reddit: "Reddit",
    "linkedin.com": "LinkedIn", linkedin: "LinkedIn",
  };
  return m[d] || d.replace(/^www\./, "");
}

function sentColor(s: string) {
  if (s === "negativo") return "#ef4444";
  if (s === "positivo") return "#22c55e";
  return "#94a3b8";
}

function sentLabel(s: string) {
  if (s === "negativo") return "Negativo";
  if (s === "positivo") return "Positivo";
  return "Mixto";
}

const reportTypeBadge: Record<string, { bg: string; label: string }> = {
  crisis: { bg: "#ef4444", label: "CRISIS" },
  brief: { bg: "#3b82f6", label: "BRIEF" },
  thematic: { bg: "#8b5cf6", label: "TEMÁTICO" },
  comparative: { bg: "#0891b2", label: "COMPARATIVO" },
};

/* ─── Inline markdown parser ─── */

function InlineBold({ text }: { text: string }) {
  const parts = text.split(/\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </>
  );
}

function FormattedText({ text, fontSize = "12.5px" }: { text: string; fontSize?: string }) {
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {paragraphs.map((para, pi) => {
        const lines = para.split(/\n/).filter(Boolean);
        return (
          <div key={pi} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {lines.map((line, li) => {
              const trimmed = line.trim();
              const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
              if (numMatch) {
                return (
                  <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: "8px", paddingLeft: "4px", fontSize, lineHeight: "1.75" }}>
                    <span style={{ fontWeight: 700, color: "#6366f1", minWidth: "18px" }}>{numMatch[1]}.</span>
                    <span><InlineBold text={numMatch[2]} /></span>
                  </div>
                );
              }
              const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
              if (bulletMatch) {
                return (
                  <div key={li} style={{ display: "flex", alignItems: "flex-start", gap: "8px", paddingLeft: "8px", fontSize, lineHeight: "1.75" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6366f1", flexShrink: 0, marginTop: "7px" }} />
                    <span><InlineBold text={bulletMatch[1]} /></span>
                  </div>
                );
              }
              const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
              if (boldMatch) {
                return <p key={li} style={{ fontWeight: 700, fontSize, lineHeight: "1.75" }}>{boldMatch[1]}</p>;
              }
              return <p key={li} style={{ fontSize, lineHeight: "1.75" }}><InlineBold text={trimmed} /></p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Chart components (pure HTML/CSS) ─── */

function HorizontalBarChart({ data, colorFn, maxVal }: {
  data: { label: string; value: number }[];
  colorFn?: (item: { label: string; value: number }, idx: number) => string;
  maxVal?: number;
}) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, 2);
        const color = colorFn ? colorFn(d, i) : (i < 3 ? "#6366f1" : "#94a3b8");
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "80px", fontSize: "10px", color: "#475569", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <div style={{ flex: 1, height: "14px", backgroundColor: "#f1f5f9", borderRadius: "3px", position: "relative", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: "4px" }}>
                {pct > 20 && <span style={{ fontSize: "9px", color: "#fff", fontWeight: 600 }}>{d.value}</span>}
              </div>
            </div>
            {pct <= 20 && <span style={{ fontSize: "9px", color: "#64748b", minWidth: "24px" }}>{d.value}</span>}
          </div>
        );
      })}
    </div>
  );
}

function VerticalBarChart({ data, highlightMax }: {
  data: { label: string; value: number }[];
  highlightMax?: boolean;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const maxIdx = data.findIndex(d => d.value === max);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "100px" }}>
        {data.map((d, i) => {
          const h = Math.max((d.value / max) * 90, 4);
          const isMax = highlightMax && i === maxIdx;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "8px", color: "#475569", fontWeight: 600, marginBottom: "2px" }}>{d.value}</span>
              <div style={{ width: "100%", height: `${h}px`, backgroundColor: isMax ? "#ef4444" : "#6366f1", borderRadius: "2px 2px 0 0" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "3px" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "7px", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section wrappers ─── */

function SectionHeader({ title, dark }: { title: string; dark?: boolean }) {
  return (
    <div style={{
      backgroundColor: dark ? "#0f172a" : "#6366f1",
      color: "#fff",
      fontSize: "10px",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      padding: "6px 12px",
      borderRadius: "4px 4px 0 0",
    }}>
      {title}
    </div>
  );
}

function SectionBody({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <div style={{
      border: "0.5px solid #6366f1",
      borderTop: "none",
      borderRadius: "0 0 4px 4px",
      padding: "14px",
      backgroundColor: bg || "#fff",
    }}>
      {children}
    </div>
  );
}

/* ─── Props ─── */

interface Props {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  editedTemplate: string;
  reportType?: ReportType;
  pageIndex?: number;
  totalPages?: number;
}

/* ─── Main component ─── */

// eslint-disable-next-line react/display-name
export const SmartReportPDFPreview = forwardRef<HTMLDivElement, Props>(
  ({ report, projectName, dateRange, reportType = "brief" }, ref) => {
    const total = report.metrics.totalMentions || 1;
    const posPct = Math.round((report.metrics.positiveCount / total) * 100);
    const neuPct = Math.round((report.metrics.neutralCount / total) * 100);
    const negPct = Math.round((report.metrics.negativeCount / total) * 100);

    const period = `${safeDate(dateRange.start)} — ${safeDate(dateRange.end)}`;
    const generated = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });
    const badge = reportTypeBadge[reportType] || reportTypeBadge.brief;

    // Chart data derived from report
    const mentionsByPlatform = useMemo(() =>
      report.sourceBreakdown.slice(0, 8).map(s => ({ label: platformLabel(s.source), value: s.count })),
      [report.sourceBreakdown]
    );

    const dailyMentions = useMemo(() =>
      report.timeline.slice(-14).map((t: TimelinePoint) => ({
        label: (() => { try { return format(new Date(t.date), "dd/MM"); } catch { return t.date; } })(),
        value: t.count,
      })),
      [report.timeline]
    );

    const negPctByPlatform = useMemo(() =>
      report.sourceBreakdown
        .filter(s => s.count > 0)
        .map(s => ({ label: platformLabel(s.source), value: Math.round((s.negative / s.count) * 100) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      [report.sourceBreakdown]
    );

    const topInfluencersByInteractions = useMemo(() =>
      report.influencers.slice(0, 8).map((inf: InfluencerInfo) => ({
        label: inf.username ? `@${inf.username}` : inf.name,
        value: parseInt(String(inf.reach).replace(/[^\d]/g, "")) || 0,
        sentiment: inf.sentiment,
      })),
      [report.influencers]
    );

    // Derive conclusions from summary
    const conclusionIntro = "Con base en el análisis de las menciones recopiladas durante el periodo evaluado, se identifican los siguientes puntos clave:";
    const conclusionBullets = report.keyFindings.slice(0, 5);

    // Daily change %
    const dailyChange = useMemo(() => {
      if (report.timeline.length < 2) return null;
      const last = report.timeline[report.timeline.length - 1]?.count || 0;
      const prev = report.timeline[report.timeline.length - 2]?.count || 1;
      return Math.round(((last - prev) / prev) * 100);
    }, [report.timeline]);

    return (
      <div
        ref={ref}
        style={{ width: 794, fontFamily: "Helvetica, Arial, sans-serif", backgroundColor: "#fff", color: "#111827", fontSize: "12.5px", lineHeight: 1.6 }}
      >
        {/* ═══ 1. HEADER ═══ */}
        <div style={{ backgroundColor: "#0f172a", padding: "28px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo left */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", backgroundColor: "#6366f1", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <span style={{ fontSize: "13px", color: "#e2e8f0", letterSpacing: "0.08em", fontWeight: 700 }}>WIZR</span>
          </div>

          {/* Right */}
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "inline-block", backgroundColor: badge.bg, color: "#fff", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.06em" }}>
              {badge.label}
            </span>
            <h1 style={{ color: "#f8fafc", fontSize: "15px", fontWeight: 700, marginTop: "6px", maxWidth: "480px", lineHeight: 1.35 }}>
              {report.title}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "11px", marginTop: "4px" }}>{period} · Generado: {generated}</p>
          </div>
        </div>

        {/* ═══ 2. METRICS ROW ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", borderBottom: "1px solid #e2e8f0" }}>
          {[
            { v: fmt(report.metrics.estimatedImpressions || 0), l: "Impresiones Est.", c: "#6366f1" },
            { v: report.metrics.totalMentions.toString(), l: "Total Menciones", c: "#6366f1" },
            { v: fmt(report.metrics.estimatedReach || 0), l: "Alcance Est.", c: "#6366f1" },
            { v: `${negPct}%`, l: "% Negativo", c: "#ef4444" },
            { v: `${posPct}%`, l: "% Positivo", c: "#22c55e" },
          ].map((m, i) => (
            <div key={i} style={{
              padding: "16px 12px",
              textAlign: "center",
              backgroundColor: "#fff",
              borderRight: i < 4 ? "1px solid #e2e8f0" : "none",
            }}>
              <p style={{ fontSize: "22px", fontWeight: 500, color: m.c, margin: 0 }}>{m.v}</p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0" }}>{m.l}</p>
            </div>
          ))}
        </div>

        {/* ═══ 3. SENTIMENT BAR ═══ */}
        <div style={{ padding: "16px 24px" }}>
          <div style={{ display: "flex", height: "28px", borderRadius: "6px", overflow: "hidden" }}>
            {posPct > 0 && (
              <div style={{ width: `${posPct}%`, backgroundColor: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
                {posPct > 5 && `${posPct}%`}
              </div>
            )}
            {neuPct > 0 && (
              <div style={{ width: `${neuPct}%`, backgroundColor: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
                {neuPct > 5 && `${neuPct}%`}
              </div>
            )}
            {negPct > 0 && (
              <div style={{ width: `${negPct}%`, backgroundColor: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "11px", fontWeight: 700 }}>
                {negPct > 5 && `${negPct}%`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "20px", marginTop: "8px", fontSize: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} />Positivo {posPct}%</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />Neutral {neuPct}%</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />Negativo {negPct}%</span>
          </div>
        </div>

        {/* ═══ 4. BODY ═══ */}
        <div style={{ padding: "0 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* — Resumen Ejecutivo — */}
          <div>
            <SectionHeader title="Resumen Ejecutivo" />
            <SectionBody>
              <FormattedText text={report.summary} />
            </SectionBody>
          </div>

          {/* — Visualización de Datos — */}
          <div>
            <SectionHeader title="Visualización de Datos" />
            <SectionBody>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Chart 1: Menciones por plataforma */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>Menciones por plataforma</p>
                  {mentionsByPlatform.length > 0 ? (
                    <HorizontalBarChart data={mentionsByPlatform} />
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>

                {/* Chart 2: Evolución diaria */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>Evolución diaria de menciones</p>
                  {dailyMentions.length > 0 ? (
                    <>
                      <VerticalBarChart data={dailyMentions} highlightMax />
                      {dailyChange !== null && (
                        <p style={{ fontSize: "9px", color: "#64748b", marginTop: "6px", textAlign: "right" }}>
                          {dailyChange >= 0 ? "+" : ""}{dailyChange}% vs día anterior
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>

                {/* Chart 3: % negativo por plataforma */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>% Negativo por plataforma</p>
                  {negPctByPlatform.length > 0 ? (
                    <HorizontalBarChart
                      data={negPctByPlatform.map(d => ({ label: d.label, value: d.value }))}
                      colorFn={(d) => d.value >= 80 ? "#ef4444" : d.value >= 60 ? "#f97316" : "#6366f1"}
                      maxVal={100}
                    />
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>

                {/* Chart 4: Top influenciadores por interacciones */}
                <div style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "14px" }}>
                  <p style={{ fontSize: "11px", textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.06em", marginBottom: "10px", fontWeight: 600 }}>Top influenciadores por interacciones</p>
                  {topInfluencersByInteractions.length > 0 ? (
                    <HorizontalBarChart
                      data={topInfluencersByInteractions}
                      colorFn={(d) => {
                        const inf = topInfluencersByInteractions.find(x => x.label === d.label);
                        return sentColor(inf?.sentiment || "mixto");
                      }}
                    />
                  ) : (
                    <p style={{ fontSize: "10px", color: "#cbd5e1" }}>Sin datos</p>
                  )}
                </div>
              </div>
            </SectionBody>
          </div>

          {/* — Hallazgos Clave — */}
          <div>
            <SectionHeader title="Hallazgos Clave" />
            <SectionBody>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {report.keyFindings.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span style={{
                      flexShrink: 0, width: "22px", height: "22px", borderRadius: "50%",
                      backgroundColor: "#6366f1", color: "#fff", fontSize: "11px", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px",
                    }}>{i + 1}</span>
                    <span style={{ fontSize: "12.5px", lineHeight: "1.65" }}><InlineBold text={f} /></span>
                  </div>
                ))}
              </div>
            </SectionBody>
          </div>

          {/* — Influenciadores — */}
          {report.influencers.length > 0 && (
            <div>
              <SectionHeader title="Influenciadores de la Conversación" />
              <SectionBody>
                <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#0f172a" }}>
                      {["#", "Perfil", "Red", "Menciones", "Sentimiento", "Interacciones"].map((h, i) => (
                        <th key={i} style={{ padding: "6px 8px", color: "#e2e8f0", fontWeight: 700, textAlign: i === 0 || i >= 3 ? "center" : "left", fontSize: "10px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.influencers.map((inf: InfluencerInfo, i: number) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500 }}>{i + 1}</td>
                        <td style={{ padding: "5px 8px", fontWeight: 500 }}>{inf.username ? `@${inf.username}` : inf.name}</td>
                        <td style={{ padding: "5px 8px", fontWeight: 500 }}>{platformLabel(inf.platform)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500 }}>{inf.mentions}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 600, color: sentColor(inf.sentiment) }}>{sentLabel(inf.sentiment)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500 }}>{inf.reach}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionBody>
            </div>
          )}

          {/* — Principales Narrativas — */}
          {report.narratives && report.narratives.length > 0 && (
            <div>
              <SectionHeader title="Principales Narrativas" />
              <SectionBody>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {report.narratives.map((n: NarrativeInfo, i: number) => {
                    const sentBadge = n.sentiment === "negativo"
                      ? { bg: "#fef2f2", color: "#b91c1c" }
                      : n.sentiment === "positivo"
                        ? { bg: "#f0fdf4", color: "#166534" }
                        : { bg: "#f1f5f9", color: "#475569" };
                    const trendIcon = n.trend === "creciente" ? "↑" : n.trend === "decreciente" ? "↓" : "→";
                    return (
                      <div key={i} style={{ border: "0.5px solid #e2e8f0", borderRadius: "6px", padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 500 }}>{n.narrative}</span>
                          <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "3px", backgroundColor: sentBadge.bg, color: sentBadge.color, fontWeight: 600 }}>
                            {sentLabel(n.sentiment)}
                          </span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{n.mentions} menciones</span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{trendIcon} {n.trend}</span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6, marginTop: "4px" }}>{n.description}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionBody>
            </div>
          )}

          {/* — Recomendaciones Estratégicas — */}
          <div>
            <SectionHeader title="Recomendaciones Estratégicas" />
            <SectionBody>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {report.recommendations.map((rec, i) => {
                  // Try to parse urgency from text like "(24 hrs)" or "(48 hrs)"
                  const urgencyMatch = rec.match(/\((\d+\s*hrs?)\)/i);
                  const urgency = urgencyMatch ? urgencyMatch[1] : null;
                  const cleanRec = urgency ? rec.replace(urgencyMatch![0], "").trim() : rec;
                  // Split into title (first sentence) and description
                  const dotIdx = cleanRec.indexOf(".");
                  const title = dotIdx > 0 ? cleanRec.slice(0, dotIdx + 1) : cleanRec;
                  const desc = dotIdx > 0 ? cleanRec.slice(dotIdx + 1).trim() : "";

                  return (
                    <div key={i}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 0" }}>
                        <span style={{
                          flexShrink: 0, width: "22px", height: "22px", borderRadius: "50%",
                          backgroundColor: "#0f172a", color: "#fff", fontSize: "11px", fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px",
                        }}>{i + 1}</span>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "12.5px", fontWeight: 500 }}><InlineBold text={title} /></span>
                            {urgency && (
                              <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "3px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                                {urgency}
                              </span>
                            )}
                          </div>
                          {desc && <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6, marginTop: "2px" }}><InlineBold text={desc} /></p>}
                        </div>
                      </div>
                      {i < report.recommendations.length - 1 && (
                        <div style={{ height: "0.5px", backgroundColor: "#e2e8f0" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionBody>
          </div>

          {/* — Conclusiones — */}
          <div>
            <SectionHeader title="Conclusiones" dark />
            <SectionBody bg="#f8fafc">
              <p style={{ fontSize: "12.5px", lineHeight: 1.75, marginBottom: "10px" }}>{conclusionIntro}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {conclusionBullets.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6366f1", flexShrink: 0, marginTop: "7px" }} />
                    <span style={{ fontSize: "12.5px", lineHeight: 1.65 }}><InlineBold text={b} /></span>
                  </div>
                ))}
              </div>
            </SectionBody>
          </div>
        </div>

        {/* ═══ 5. FOOTER ═══ */}
        <div style={{ backgroundColor: "#0f172a", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "20px", height: "20px", backgroundColor: "#6366f1", borderRadius: "5px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>Wizr</span>
          </div>
          <span style={{ fontSize: "11px", color: "#64748b" }}>{projectName}</span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>Generado con Wizr</span>
        </div>
      </div>
    );
  }
);
