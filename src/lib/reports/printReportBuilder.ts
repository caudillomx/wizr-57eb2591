import type { SmartReportContent, SourceBreakdown, InfluencerInfo, TimelinePoint, NarrativeInfo } from "@/hooks/useSmartReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

// ── palette ──
const C = {
  primary: "#1e1b4b",
  accent: "#6366f1",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
  cardBg: "#f8fafc",
  white: "#ffffff",
  textDark: "#111827",
  textGray: "#6b7280",
};

function sentColor(s: string) {
  if (s === "positivo") return C.positive;
  if (s === "negativo") return C.negative;
  return C.neutral;
}

function sentLabel(s: string) {
  if (s === "positivo") return "Positivo";
  if (s === "negativo") return "Negativo";
  if (s === "mixto") return "Mixto";
  return "Neutral";
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("es-MX");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── badge detection ──
function detectBadge(report: SmartReportContent, isSummary: boolean): { label: string; bg: string } {
  if (isSummary) return { label: "RESUMEN", bg: "#3b82f6" };
  const total = report.metrics.totalMentions || 1;
  const negPct = (report.metrics.negativeCount / total) * 100;
  if (negPct > 60) return { label: "CRISIS", bg: C.negative };
  if (report.entityComparison) return { label: "COMPARATIVO", bg: "#0891b2" };
  return { label: "BRIEF", bg: "#3b82f6" };
}

// ── section wrapper ──
function section(title: string, body: string, headerBg = C.accent): string {
  return `<section style="margin-bottom:16px;">
    <div style="background:${headerBg};color:#fff;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;padding:8px 14px;border-radius:4px 4px 0 0;">${escapeHtml(title)}</div>
    <div style="border:0.5px solid ${C.accent};border-top:none;padding:14px;border-radius:0 0 4px 4px;">${body}</div>
  </section>`;
}

// ── logo SVG inline ──
const LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="14" stroke="${C.accent}" stroke-width="2.5"/>
  <path d="M16 6L18.5 13H25L19.5 17.5L21.5 25L16 20.5L10.5 25L12.5 17.5L7 13H13.5L16 6Z" fill="${C.accent}"/>
</svg>`;

// ── charts (HTML/CSS only) ──

function chartPlatformBars(sources: SourceBreakdown[]): string {
  const data = sources.slice(0, 8);
  if (!data.length) return "";
  const max = Math.max(...data.map(s => s.count), 1);
  const rows = data.map((s, i) => {
    const pct = (s.count / max) * 100;
    const color = i < 3 ? C.accent : C.neutral;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="min-width:110px;font-size:9px;color:${C.textGray};text-align:right;">${escapeHtml(s.source)}</span>
      <div style="flex:1;background:#e5e7eb;border-radius:3px;height:14px;overflow:hidden;">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:3px;"></div>
      </div>
      <span style="font-size:9px;font-weight:600;min-width:28px;">${s.count}</span>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:600;margin-bottom:6px;text-align:center;">Menciones por Plataforma</div>${rows}</div>`;
}

function chartDailyBars(timeline: TimelinePoint[]): string {
  const data = timeline.slice(0, 14);
  if (!data.length) return "";
  const max = Math.max(...data.map(t => t.count), 1);
  const maxIdx = data.indexOf(data.reduce((a, b) => a.count > b.count ? a : b));
  const bars = data.map((t, i) => {
    const pct = (t.count / max) * 100;
    const color = i === maxIdx ? C.negative : C.accent;
    const dayLabel = t.date.slice(5); // MM-DD
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      <span style="font-size:7px;margin-bottom:2px;">${t.count}</span>
      <div style="width:80%;background:${color};border-radius:2px 2px 0 0;height:${Math.max(pct * 0.6, 2)}px;"></div>
      <span style="font-size:7px;color:${C.textGray};margin-top:2px;">${dayLabel}</span>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:600;margin-bottom:6px;text-align:center;">Evolución Diaria</div>
    <div style="display:flex;align-items:flex-end;height:70px;gap:2px;">${bars}</div></div>`;
}

function chartSentimentByPlatform(sources: SourceBreakdown[]): string {
  const data = sources.filter(s => s.count > 0).slice(0, 8);
  if (!data.length) return "";
  const rows = data.map(s => {
    const total = s.count || 1;
    const posPct = (s.positive / total) * 100;
    const neuPct = (s.neutral / total) * 100;
    const negPct = (s.negative / total) * 100;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="min-width:110px;font-size:9px;color:${C.textGray};text-align:right;">${escapeHtml(s.source)}</span>
      <div style="flex:1;display:flex;height:14px;border-radius:3px;overflow:hidden;">
        <div style="width:${posPct}%;background:${C.positive};"></div>
        <div style="width:${neuPct}%;background:${C.neutral};"></div>
        <div style="width:${negPct}%;background:${C.negative};"></div>
      </div>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:600;margin-bottom:6px;text-align:center;">Sentimiento por Plataforma</div>${rows}</div>`;
}

function chartTopInfluencersBars(influencers: InfluencerInfo[]): string {
  const data = influencers.slice(0, 6);
  if (!data.length) return "";
  const maxReach = Math.max(...data.map(inf => parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions), 1);
  const rows = data.map(inf => {
    const val = parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions;
    const pct = (val / maxReach) * 100;
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
      <span style="min-width:110px;font-size:9px;color:${C.textGray};text-align:right;">${escapeHtml(inf.name || inf.username)}</span>
      <div style="flex:1;background:#e5e7eb;border-radius:3px;height:14px;overflow:hidden;">
        <div style="width:${pct}%;background:${sentColor(inf.sentiment)};height:100%;border-radius:3px;"></div>
      </div>
      <span style="font-size:9px;font-weight:600;min-width:28px;">${fmtNum(val)}</span>
    </div>`;
  }).join("");
  return `<div><div style="font-size:10px;font-weight:600;margin-bottom:6px;text-align:center;">Top Influenciadores</div>${rows}</div>`;
}

// ── main builder ──

export function buildReportHTML(
  report: SmartReportContent,
  projectName: string,
  dateRange: DateRange,
  isSummary: boolean,
): string {
  const badge = detectBadge(report, isSummary);
  const generatedDate = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });
  const total = report.metrics.totalMentions || 1;
  const negPct = ((report.metrics.negativeCount / total) * 100).toFixed(1);
  const posPct = ((report.metrics.positiveCount / total) * 100).toFixed(1);

  const summaryFontSize = isSummary ? "13.5px" : "12.5px";
  const summaryLineHeight = isSummary ? "1.8" : "1.7";
  const sectionSeparator = isSummary
    ? '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">'
    : "";

  // ── HEADER ──
  const header = `<div style="background:${C.primary};padding:28px 32px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
      ${LOGO_SVG}
      <span style="color:#fff;font-size:13px;font-weight:600;letter-spacing:1.5px;">WIZR</span>
    </div>
    <div style="text-align:right;">
      <span style="background:${badge.bg};color:#fff;font-size:9px;font-weight:700;padding:3px 10px;border-radius:3px;text-transform:uppercase;letter-spacing:0.5px;">${badge.label}</span>
      <div style="color:#fff;font-size:15px;font-weight:600;margin-top:6px;">${escapeHtml(report.title)}</div>
      <div style="color:${C.neutral};font-size:11px;margin-top:3px;">${escapeHtml(dateRange.label)} · ${generatedDate}</div>
    </div>
  </div>`;

  // ── METRICS ROW ──
  const metricCell = (value: string, label: string, color = C.textDark) =>
    `<div style="flex:1;text-align:center;padding:12px 0;">
      <div style="font-size:22px;font-weight:700;color:${color};">${value}</div>
      <div style="font-size:11px;color:${C.textGray};margin-top:2px;">${label}</div>
    </div>`;
  const sep = `<div style="width:1px;background:#e5e7eb;"></div>`;
  const metricsRow = `<div style="display:flex;align-items:center;border:0.5px solid #e5e7eb;border-radius:4px;margin:16px 24px;">
    ${metricCell(fmtNum(report.metrics.estimatedImpressions), "Impresiones Est.")}${sep}
    ${metricCell(report.metrics.totalMentions.toString(), "Total Menciones")}${sep}
    ${metricCell(fmtNum(report.metrics.estimatedReach), "Alcance Est.")}${sep}
    ${metricCell(negPct + "%", "% Negativo", C.negative)}${sep}
    ${metricCell(posPct + "%", "% Positivo", C.positive)}
  </div>`;

  // ── SENTIMENT BAR ──
  const posW = report.metrics.positiveCount / total * 100;
  const neuW = report.metrics.neutralCount / total * 100;
  const negW = report.metrics.negativeCount / total * 100;
  const sentBar = `<div style="padding:16px 24px;">
    <div style="display:flex;height:28px;border-radius:6px;overflow:hidden;">
      <div style="width:${posW}%;background:${C.positive};"></div>
      <div style="width:${neuW}%;background:${C.neutral};"></div>
      <div style="width:${negW}%;background:${C.negative};"></div>
    </div>
    <div style="display:flex;gap:16px;margin-top:6px;font-size:10px;color:${C.textGray};">
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.positive};display:inline-block;"></span>Positivo ${posW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.neutral};display:inline-block;"></span>Neutral ${neuW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.negative};display:inline-block;"></span>Negativo ${negW.toFixed(0)}%</span>
    </div>
  </div>`;

  // ── SECTIONS ──
  const sections: string[] = [];

  // 1. Executive Summary
  sections.push(section("Resumen Ejecutivo",
    `<p style="font-size:${summaryFontSize};line-height:${summaryLineHeight};color:${C.textDark};">${escapeHtml(report.summary)}</p>`
  ));

  // 2. Data Visualization (full only)
  if (!isSummary) {
    const charts = [
      chartPlatformBars(report.sourceBreakdown),
      chartDailyBars(report.timeline),
      chartSentimentByPlatform(report.sourceBreakdown),
      chartTopInfluencersBars(report.influencers),
    ].filter(Boolean);
    if (charts.length > 0) {
      const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${charts.join("")}</div>`;
      sections.push(section("Visualización de Datos", grid));
    }
  }

  if (isSummary) sections.push(sectionSeparator);

  // 3. Key Findings
  const findings = isSummary ? report.keyFindings.slice(0, 3) : report.keyFindings;
  const findingsHtml = findings.map((f, i) => `<div class="finding-item" style="display:flex;gap:10px;margin-bottom:10px;">
    <div style="min-width:24px;height:24px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${i + 1}</div>
    <p style="font-size:12px;line-height:1.6;color:${C.textDark};margin:0;">${escapeHtml(f)}</p>
  </div>`).join("");
  sections.push(section("Hallazgos Clave", findingsHtml));

  if (isSummary) sections.push(sectionSeparator);

  // 4. Influencers table
  const infs = isSummary ? report.influencers.slice(0, 5) : report.influencers;
  if (infs.length > 0) {
    const headerRow = `<tr style="background:${C.primary};color:#fff;">
      <th style="padding:6px 10px;font-size:9px;text-align:left;">#</th>
      <th style="padding:6px 10px;font-size:9px;text-align:left;">Perfil</th>
      <th style="padding:6px 10px;font-size:9px;text-align:left;">Red</th>
      <th style="padding:6px 10px;font-size:9px;text-align:center;">Menciones</th>
      <th style="padding:6px 10px;font-size:9px;text-align:center;">Sentimiento</th>
      <th style="padding:6px 10px;font-size:9px;text-align:right;">Interacciones</th>
    </tr>`;
    const rows = infs.map((inf, i) => {
      const bg = i % 2 === 0 ? C.white : C.cardBg;
      return `<tr style="background:${bg};">
        <td style="padding:5px 10px;font-size:10px;">${i + 1}</td>
        <td style="padding:5px 10px;font-size:10px;font-weight:500;">${escapeHtml(inf.name || inf.username)}</td>
        <td style="padding:5px 10px;font-size:10px;">${escapeHtml(inf.platform)}</td>
        <td style="padding:5px 10px;font-size:10px;text-align:center;">${inf.mentions}</td>
        <td style="padding:5px 10px;font-size:10px;text-align:center;color:${sentColor(inf.sentiment)};font-weight:600;">${sentLabel(inf.sentiment)}</td>
        <td style="padding:5px 10px;font-size:10px;text-align:right;font-weight:600;">${escapeHtml(inf.reach || "—")}</td>
      </tr>`;
    }).join("");
    const table = `<table style="width:100%;border-collapse:collapse;border-radius:4px;overflow:hidden;">${headerRow}${rows}</table>`;
    sections.push(section("Influenciadores", table));
  }

  if (isSummary) sections.push(sectionSeparator);

  // 5. Narratives (full only)
  if (!isSummary && report.narratives.length > 0) {
    const narrativesHtml = report.narratives.map(n =>
      `<div class="narrative-card" style="border:0.5px solid #e5e7eb;border-radius:6px;padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;">${escapeHtml(n.narrative)}</span>
          <span style="background:${sentColor(n.sentiment)}22;color:${sentColor(n.sentiment)};font-size:9px;padding:2px 8px;border-radius:10px;font-weight:600;">${sentLabel(n.sentiment)}</span>
          <span style="font-size:9px;color:${C.textGray};">${n.mentions} menciones · ${n.trend === "creciente" ? "↑" : n.trend === "decreciente" ? "↓" : "→"} ${n.trend}</span>
        </div>
        <p style="font-size:11px;color:${C.textGray};line-height:1.5;margin:0;">${escapeHtml(n.description)}</p>
      </div>`
    ).join("");
    sections.push(section("Principales Narrativas", narrativesHtml));
  }

  // 6. Recommendations
  const recs = isSummary ? report.recommendations.slice(0, 2) : report.recommendations;
  const recsHtml = recs.map((r, i) => `<div style="display:flex;gap:10px;margin-bottom:10px;">
    <div style="min-width:24px;height:24px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${i + 1}</div>
    <p style="font-size:12px;line-height:1.6;color:${C.textDark};margin:0;">${escapeHtml(r)}</p>
  </div>`).join("");
  sections.push(section("Recomendaciones", recsHtml));

  if (isSummary) sections.push(sectionSeparator);

  // 7. Conclusions
  if (report.conclusions && report.conclusions.length > 0) {
    const concs = isSummary ? report.conclusions.slice(0, 2) : report.conclusions;
    const introText = report.summary.split(".").slice(0, 1).join(".") + ".";
    const bullets = concs.map(c =>
      `<li style="margin-bottom:6px;font-size:12px;line-height:1.6;color:${C.textDark};">${escapeHtml(c)}</li>`
    ).join("");
    const body = `<p style="font-size:12px;line-height:1.6;color:${C.textGray};margin-bottom:10px;">${escapeHtml(introText)}</p>
      <ul style="margin:0;padding-left:20px;list-style:none;">${bullets.replace(/<li/g, `<li style="position:relative;padding-left:14px;"><span style="position:absolute;left:0;top:7px;width:6px;height:6px;border-radius:50%;background:${C.accent};"></span`)}</ul>`;
    sections.push(section("Conclusiones", body, C.primary));
  }

  // ── FOOTER ──
  const footer = `<div style="background:${C.primary};padding:12px 24px;display:flex;align-items:center;justify-content:space-between;margin-top:16px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="${C.accent}" stroke-width="2.5"/><path d="M16 6L18.5 13H25L19.5 17.5L21.5 25L16 20.5L10.5 25L12.5 17.5L7 13H13.5L16 6Z" fill="${C.accent}"/></svg>
      <span style="color:${C.neutral};font-size:10px;">WIZR</span>
    </div>
    <span style="color:${C.neutral};font-size:10px;">Generado con Wizr · ${generatedDate}</span>
  </div>`;

  // ── FULL HTML ──
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(report.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;font-size:12.5px;color:${C.textDark};background:#fff;width:794px;margin:0 auto;}
@media print{
  body{width:100%;margin:0;}
  .page-break{break-before:page;}
  section{break-inside:avoid;}
  table{break-inside:avoid;}
  .narrative-card{break-inside:avoid;}
  .finding-item{break-inside:avoid;}
}
</style>
</head>
<body>
${header}
${metricsRow}
${sentBar}
<div style="padding:0 24px 16px;">
${sections.join("\n")}
</div>
${footer}
</body>
</html>`;
}
