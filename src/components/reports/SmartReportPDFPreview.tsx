import { forwardRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SmartReportContent, InfluencerInfo, SourceBreakdown, NarrativeInfo } from "@/hooks/useSmartReport";
import logoUrl from "@/assets/wizr-logo-full-transparent.png";

interface Props {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  editedTemplate: string;
  pageIndex?: number;
  totalPages?: number;
}

function safeDate(iso: string) {
  try { return format(new Date(iso), "d MMM yyyy", { locale: es }); }
  catch { return iso.split("T")[0]; }
}

function fmt(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function platform(d: string) {
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
  if (s === "negativo") return "text-red-500";
  if (s === "positivo") return "text-green-500";
  return "text-slate-400";
}

function sentLabel(s: string) {
  if (s === "negativo") return "Negativo";
  if (s === "positivo") return "Positivo";
  return "Mixto";
}

/** Parses simple markdown bold and bullet formatting into JSX */
function FormattedText({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, pi) => {
        const lines = para.split(/\n/).filter(Boolean);
        return (
          <div key={pi} className="space-y-1">
            {lines.map((line, li) => {
              const trimmed = line.trim();

              // Numbered list
              const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
              if (numMatch) {
                return (
                  <div key={li} className="flex items-start gap-2 pl-1">
                    <span className="font-bold text-[#6366f1] min-w-[18px]">{numMatch[1]}.</span>
                    <span><InlineBold text={numMatch[2]} /></span>
                  </div>
                );
              }

              // Bullet list
              const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
              if (bulletMatch) {
                return (
                  <div key={li} className="flex items-start gap-2 pl-2">
                    <span className="text-[#6366f1] mt-1.5 w-1.5 h-1.5 rounded-full bg-[#6366f1] shrink-0" />
                    <span><InlineBold text={bulletMatch[1]} /></span>
                  </div>
                );
              }

              // Full bold line
              const boldMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
              if (boldMatch) {
                return <p key={li} className="font-bold">{boldMatch[1]}</p>;
              }

              // Normal text (with possible inline bold)
              return <p key={li}><InlineBold text={trimmed} /></p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

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

// eslint-disable-next-line react/display-name
export const SmartReportPDFPreview = forwardRef<HTMLDivElement, Props>(
  ({ report, projectName, dateRange, editedTemplate }, ref) => {
    const total = report.metrics.totalMentions || 1;
    const posPct = Math.round((report.metrics.positiveCount / total) * 100);
    const neuPct = Math.round((report.metrics.neutralCount / total) * 100);
    const negPct = Math.round((report.metrics.negativeCount / total) * 100);

    const period = `${safeDate(dateRange.start)} — ${safeDate(dateRange.end)}`;
    const generated = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });

    return (
      <div
        ref={ref}
        style={{ width: 794, fontFamily: "Helvetica, Arial, sans-serif" }}
        className="bg-white text-[#111827] text-[13px] leading-relaxed"
      >
        {/* ═══ HEADER ═══ */}
        <div className="bg-[#0f172a] px-10 py-6 flex items-center justify-between">
          <img src={logoUrl} alt="Wizr" className="h-8" />
          <div className="text-right">
            <h1 className="text-white font-bold text-[16px] max-w-[460px] leading-tight">
              {report.title}
            </h1>
            <p className="text-slate-400 text-[11px] mt-1">{period} · Generado: {generated}</p>
          </div>
        </div>

        {/* ═══ METRICS ROW ═══ */}
        <div className="grid grid-cols-5 gap-3 px-10 py-5">
          {[
            { v: fmt(report.metrics.estimatedImpressions || 0), l: "Impresiones Est." },
            { v: report.metrics.totalMentions.toString(), l: "Total Menciones" },
            { v: fmt(report.metrics.estimatedReach || 0), l: "Alcance Estimado" },
            { v: `${negPct}%`, l: "% Negativo" },
            { v: `${posPct}%`, l: "% Positivo" },
          ].map((m, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 text-center bg-[#f8fafc]">
              <p className="text-[22px] font-bold text-[#6366f1]">{m.v}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{m.l}</p>
            </div>
          ))}
        </div>

        {/* ═══ SENTIMENT BAR ═══ */}
        <div className="px-10 pb-5">
          <div className="flex h-6 rounded-md overflow-hidden">
            {posPct > 0 && (
              <div className="bg-[#22c55e] flex items-center justify-center text-white text-[10px] font-bold"
                style={{ width: `${posPct}%` }}>
                {posPct > 5 && `${posPct}%`}
              </div>
            )}
            {neuPct > 0 && (
              <div className="bg-[#94a3b8] flex items-center justify-center text-white text-[10px] font-bold"
                style={{ width: `${neuPct}%` }}>
                {neuPct > 5 && `${neuPct}%`}
              </div>
            )}
            {negPct > 0 && (
              <div className="bg-[#ef4444] flex items-center justify-center text-white text-[10px] font-bold"
                style={{ width: `${negPct}%` }}>
                {negPct > 5 && `${negPct}%`}
              </div>
            )}
          </div>
          <div className="flex gap-5 mt-2 text-[10px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />Positivo {posPct}%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />Neutral {neuPct}%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />Negativo {negPct}%</span>
          </div>
        </div>

        {/* ═══ SECTIONS ═══ */}
        <div className="px-10 space-y-5 pb-6">
          {/* Resumen Ejecutivo */}
          <Section title="Resumen Ejecutivo">
            <FormattedText text={report.summary} />
          </Section>

          {/* Análisis de Sentimiento */}
          {report.sentimentAnalysis && (
            <Section title="Análisis de Sentimiento">
              <FormattedText text={report.sentimentAnalysis} />
            </Section>
          )}

          {/* Evaluación de Impacto */}
          {report.impactAssessment && (
            <Section title="Evaluación de Impacto">
              <FormattedText text={report.impactAssessment} />
            </Section>
          )}

          {/* Hallazgos Clave */}
          <Section title="Hallazgos Clave">
            <div className="space-y-2">
              {report.keyFindings.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#6366f1] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span><InlineBold text={f} /></span>
                </div>
              ))}
            </div>
          </Section>

          {/* Influenciadores */}
          {report.influencers.length > 0 && (
            <Section title="Influenciadores de la Conversación">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th className="py-1.5 px-2 text-center font-bold">#</th>
                    <th className="py-1.5 px-2 text-left font-bold">Perfil</th>
                    <th className="py-1.5 px-2 text-center font-bold">Red</th>
                    <th className="py-1.5 px-2 text-center font-bold">Menciones</th>
                    <th className="py-1.5 px-2 text-center font-bold">Sentimiento</th>
                    <th className="py-1.5 px-2 text-right font-bold">Interacciones</th>
                  </tr>
                </thead>
                <tbody>
                  {report.influencers.map((inf: InfluencerInfo, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                      <td className="py-1 px-2 text-center">{i + 1}</td>
                      <td className="py-1 px-2">{inf.username ? `@${inf.username}` : inf.name}</td>
                      <td className="py-1 px-2 text-center">{platform(inf.platform)}</td>
                      <td className="py-1 px-2 text-center">{inf.mentions}</td>
                      <td className={`py-1 px-2 text-center font-semibold ${sentColor(inf.sentiment)}`}>
                        {sentLabel(inf.sentiment)}
                      </td>
                      <td className="py-1 px-2 text-right">{inf.reach}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Distribución por Plataformas */}
          {report.sourceBreakdown.length > 0 && (
            <Section title="Distribución por Medios y Plataformas">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#0f172a] text-white">
                    <th className="py-1.5 px-2 text-left font-bold">Fuente</th>
                    <th className="py-1.5 px-2 text-center font-bold">Total</th>
                    <th className="py-1.5 px-2 text-center font-bold">Pos</th>
                    <th className="py-1.5 px-2 text-center font-bold">Neu</th>
                    <th className="py-1.5 px-2 text-center font-bold">Neg</th>
                    <th className="py-1.5 px-2 text-center font-bold">% Neg</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sourceBreakdown.slice(0, 10).map((s: SourceBreakdown, i: number) => {
                    const negP = Math.round((s.negative / (s.count || 1)) * 100);
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#f8fafc]"}>
                        <td className="py-1 px-2 font-semibold">{platform(s.source)}</td>
                        <td className="py-1 px-2 text-center">{s.count}</td>
                        <td className="py-1 px-2 text-center">{s.positive}</td>
                        <td className="py-1 px-2 text-center">{s.neutral}</td>
                        <td className="py-1 px-2 text-center">{s.negative}</td>
                        <td className={`py-1 px-2 text-center font-semibold ${negP >= 70 ? "text-red-500" : negP >= 40 ? "text-amber-500" : ""}`}>
                          {negP}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          )}

          {/* Recomendaciones */}
          <Section title="Recomendaciones Estratégicas">
            <div className="space-y-2">
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#6366f1] text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span><InlineBold text={rec} /></span>
                </div>
              ))}
            </div>
          </Section>

          {/* Mensaje Ejecutivo */}
          {editedTemplate && (
            <Section title="Mensaje Ejecutivo">
              <FormattedText text={editedTemplate} />
            </Section>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="bg-[#0f172a] px-10 py-3 flex items-center justify-between">
          <img src={logoUrl} alt="Wizr" className="h-4" />
          <p className="text-slate-400 text-[10px]">{projectName}</p>
          <p className="text-slate-400 text-[10px]">Generado con Wizr</p>
        </div>
      </div>
    );
  }
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-[#6366f1] text-white font-bold text-[12px] uppercase tracking-wide py-2 px-4 rounded-md mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}
