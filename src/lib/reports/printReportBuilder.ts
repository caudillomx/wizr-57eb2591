import type { SmartReportContent, SourceBreakdown, InfluencerInfo, TimelinePoint } from "@/hooks/useSmartReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LOGO_WHITE_B64 } from "./logoBase64";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

const C = {
  primary: "#1e1b4b",
  accent: "#6366f1",
  accentLight: "#a5b4fc",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
  cardBg: "#f8fafc",
  white: "#ffffff",
  textDark: "#111827",
  textGray: "#6b7280",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
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

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function detectBadge(report: SmartReportContent, isSummary: boolean): { label: string; bg: string } {
  if (isSummary) return { label: "RESUMEN", bg: "#3b82f6" };
  const total = report.metrics.totalMentions || 1;
  const negPct = (report.metrics.negativeCount / total) * 100;
  if (negPct > 60) return { label: "CRISIS", bg: C.negative };
  if (report.entityComparison) return { label: "COMPARATIVO", bg: "#0891b2" };
  return { label: "BRIEF", bg: "#3b82f6" };
}

function section(title: string, body: string, headerBg = C.accent): string {
  return `<div class="report-section" style="border-radius:6px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 1px 3px rgba(0,0,0,0.04);background:${C.white};">
    <div class="section-header-wrap" style="break-inside:avoid;page-break-inside:avoid;">
      <div class="section-header" style="background:${headerBg};color:#fff;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;padding:8px 16px;">${escapeHtml(title)}</div>
    </div>
    <div class="section-body" style="padding:14px 16px;background:${C.white};">${body}</div>
  </div>`;
}

function estimateTextLines(text: string, charsPerLine = 96): number {
  const plainText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return 1;
  return Math.max(1, Math.ceil(plainText.length / charsPerLine));
}

function insightCard(text: string, icon: string, color: string): string {
  return `<div class="avoid-break" style="background:${color}08;border-left:4px solid ${color};border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;">
    <span style="font-size:14px;flex-shrink:0;margin-top:1px;">${icon}</span>
    <p style="font-size:10.5px;line-height:1.6;color:${C.textDark};margin:0;">${text}</p>
  </div>`;
}

function highlightText(text: string): string {
  const escaped = escapeHtml(text);
  let result = escaped.replace(/(\d[\d,.]*\s*(?:%|menciones|interacciones|M\b|K\b))/gi, "<strong>$1</strong>");
  result = result.replace(/&#39;([^&#]+?)&#39;/g, "<strong>'$1'</strong>");
  result = result.replace(/'([^']+?)'/g, "<strong>'$1'</strong>");
  return result;
}

function chartPlatformBars(sources: SourceBreakdown[]): string {
  const data = sources.slice(0, 8);
  if (!data.length) return "";
  const max = Math.max(...data.map((s) => s.count), 1);
  const rows = data
    .map((s, i) => {
      const pct = (s.count / max) * 100;
      const color = i < 3 ? C.accent : C.neutral;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="min-width:90px;font-size:8px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.source)}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:14px;overflow:hidden;">
        <div style="width:${pct}%;background:${color};height:100%;border-radius:3px;min-width:2px;"></div>
      </div>
      <span style="font-size:9px;font-weight:700;min-width:28px;color:${C.textDark};">${s.count}</span>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:6px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Menciones por Plataforma</div>${rows}</div>`;
}

function chartDailyBars(timeline: TimelinePoint[]): string {
  const data = timeline.slice(0, 14);
  if (!data.length) return "";
  const max = Math.max(...data.map((t) => t.count), 1);
  const maxIdx = data.indexOf(data.reduce((a, b) => (a.count > b.count ? a : b)));
  const bars = data
    .map((t, i) => {
      const pct = (t.count / max) * 100;
      const color = i === maxIdx ? C.negative : C.accent;
      const dayLabel = t.date.slice(5);
      return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      <span style="font-size:7px;font-weight:700;color:${C.textDark};margin-bottom:3px;">${t.count}</span>
      <div style="width:55%;background:${color};border-radius:2px 2px 0 0;height:${Math.max(pct * 0.45, 3)}px;"></div>
      <span style="font-size:7px;color:${C.textGray};margin-top:3px;">${dayLabel}</span>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:10px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Evolución Diaria de Menciones</div>
    <div style="display:flex;align-items:flex-end;height:55px;gap:3px;">${bars}</div></div>`;
}

function chartSentimentByPlatform(sources: SourceBreakdown[]): string {
  const data = sources.filter((s) => s.count > 0).slice(0, 8);
  if (!data.length) return "";
  const rows = data
    .map((s) => {
      const total = s.count || 1;
      const posPct = (s.positive / total) * 100;
      const neuPct = (s.neutral / total) * 100;
      const negPct = (s.negative / total) * 100;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="min-width:90px;font-size:8px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.source)}</span>
      <div style="flex:1;display:flex;height:14px;border-radius:3px;overflow:hidden;">
        <div style="width:${posPct}%;background:${C.positive};"></div>
        <div style="width:${neuPct}%;background:${C.neutral};"></div>
        <div style="width:${negPct}%;background:${C.negative};"></div>
      </div>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:6px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Sentimiento por Plataforma</div>${rows}</div>`;
}

function chartTopInfluencersBars(influencers: InfluencerInfo[]): string {
  const data = influencers.slice(0, 6);
  if (!data.length) return "";
  const maxReach = Math.max(
    ...data.map((inf) => parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions),
    1,
  );
  const rows = data
    .map((inf) => {
      const val = parseInt(inf.reach?.replace(/\D/g, "") || "0") || inf.mentions;
      const pct = (val / maxReach) * 100;
      return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span style="min-width:90px;font-size:8px;color:${C.textGray};text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(inf.name || inf.username)}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:14px;overflow:hidden;">
        <div style="width:${pct}%;background:${sentColor(inf.sentiment)};height:100%;border-radius:3px;min-width:2px;"></div>
      </div>
      <span style="font-size:9px;font-weight:700;min-width:32px;color:${C.textDark};">${fmtNum(val)}</span>
    </div>`;
    })
    .join("");
  return `<div><div style="font-size:9px;font-weight:700;margin-bottom:6px;text-align:center;color:${C.textDark};text-transform:uppercase;letter-spacing:0.5px;">Top Influenciadores</div>${rows}</div>`;
}

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

  const summaryFontSize = isSummary ? "12px" : "11px";
  const summaryLineHeight = isSummary ? "1.75" : "1.65";
  const sectionSeparator = isSummary
    ? `<hr style="border:none;border-top:1.5px solid ${C.border};margin:16px 0;">`
    : "";

  const header = `<div style="background:${C.primary};padding:22px 24px;display:flex;align-items:center;justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="${LOGO_WHITE_B64}" alt="Wizr" style="height:34px;width:auto;display:block;" />
    </div>
    <div style="text-align:right;">
      <span style="background:${badge.bg};color:#fff;font-size:8px;font-weight:700;padding:3px 12px;border-radius:3px;text-transform:uppercase;letter-spacing:1px;">${badge.label}</span>
      <div style="color:#fff;font-size:13px;font-weight:600;margin-top:8px;max-width:440px;">${escapeHtml(report.title)}</div>
      <div style="color:${C.accentLight};font-size:9.5px;margin-top:4px;">${escapeHtml(dateRange.label)} · ${generatedDate}</div>
    </div>
  </div>`;

  const metricCell = (value: string, label: string, color = C.textDark) =>
    `<div style="flex:1;text-align:center;padding:10px 6px;">
      <div style="font-size:18px;font-weight:700;color:${color};line-height:1.2;">${value}</div>
      <div style="font-size:8px;color:${C.textGray};margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;font-weight:500;">${label}</div>
    </div>`;
  const sep = `<div style="width:1px;background:${C.border};margin:8px 0;"></div>`;
  const metricsRow = `<div style="display:flex;align-items:stretch;border:1px solid ${C.border};border-radius:6px;margin:14px 20px;background:${C.white};box-shadow:0 1px 3px rgba(0,0,0,0.04);">
    ${metricCell(fmtNum(report.metrics.estimatedImpressions), "Impresiones Est.")}${sep}
    ${metricCell(report.metrics.totalMentions.toString(), "Total Menciones")}${sep}
    ${metricCell(fmtNum(report.metrics.estimatedReach), "Alcance Est.")}${sep}
    ${metricCell(negPct + "%", "% Negativo", C.negative)}${sep}
    ${metricCell(posPct + "%", "% Positivo", C.positive)}
  </div>`;

  const posW = (report.metrics.positiveCount / total) * 100;
  const neuW = (report.metrics.neutralCount / total) * 100;
  const negW = (report.metrics.negativeCount / total) * 100;
  const sentBar = `<div style="padding:4px 20px 12px;">
    <div style="display:flex;height:20px;border-radius:10px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.12);">
      <div style="width:${posW}%;background:${C.positive};"></div>
      <div style="width:${neuW}%;background:${C.neutral};"></div>
      <div style="width:${negW}%;background:${C.negative};"></div>
    </div>
    <div style="display:flex;gap:20px;margin-top:6px;font-size:9px;color:${C.textGray};font-weight:500;">
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.positive};display:inline-block;"></span>Positivo ${posW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.neutral};display:inline-block;"></span>Neutral ${neuW.toFixed(0)}%</span>
      <span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:${C.negative};display:inline-block;"></span>Negativo ${negW.toFixed(0)}%</span>
    </div>
  </div>`;

  const blocks: string[] = [];

  blocks.push(
    section(
      "Resumen Ejecutivo",
      `<p style="font-size:${summaryFontSize};line-height:${summaryLineHeight};color:${C.textDark};margin:0;">${highlightText(report.summary)}</p>`,
    ),
  );

  if (!isSummary) {
    const charts = [
      chartPlatformBars(report.sourceBreakdown),
      chartDailyBars(report.timeline),
      chartSentimentByPlatform(report.sourceBreakdown),
      chartTopInfluencersBars(report.influencers),
    ].filter(Boolean);

    if (charts.length > 0) {
      const grid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">${charts.join("")}</div>`;
      blocks.push(section("Visualización de Datos", grid));
    }
  }

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  const findings = isSummary ? report.keyFindings.slice(0, 3) : report.keyFindings;
  let findingsHtml = "";
  if (findings.length > 0) {
    const firstSentiment = parseFloat(negPct) > 60 ? C.negative : C.accent;
    findingsHtml += `<div class="avoid-break">${insightCard(highlightText(findings[0]), "🔍", firstSentiment)}</div>`;
    findings.slice(1).forEach((f, i) => {
      findingsHtml += `<div class="avoid-break" style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
        <div style="min-width:24px;height:24px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 2}</div>
        <p style="font-size:10.5px;line-height:1.6;color:${C.textDark};margin:0;">${highlightText(f)}</p>
      </div>`;
    });
  }
  blocks.push(section("Hallazgos Clave", findingsHtml));

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  const infs = isSummary ? report.influencers.slice(0, 5) : report.influencers;
  if (infs.length > 0) {
    const headerRow = `<tr style="background:${C.primary};">
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">#</th>
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">Perfil</th>
      <th style="padding:7px 10px;font-size:8px;text-align:left;color:#fff;font-weight:600;letter-spacing:0.5px;">Red</th>
      <th style="padding:7px 10px;font-size:8px;text-align:center;color:#fff;font-weight:600;letter-spacing:0.5px;">Menciones</th>
      <th style="padding:7px 10px;font-size:8px;text-align:center;color:#fff;font-weight:600;letter-spacing:0.5px;">Sentimiento</th>
      <th style="padding:7px 10px;font-size:8px;text-align:right;color:#fff;font-weight:600;letter-spacing:0.5px;">Interacciones</th>
    </tr>`;
    const rows = infs
      .map((inf, i) => {
        const bg = i % 2 === 0 ? C.white : C.cardBg;
        const sentBg = `${sentColor(inf.sentiment)}15`;
        return `<tr style="background:${bg};">
        <td style="padding:5px 10px;font-size:9px;color:${C.textGray};">${i + 1}</td>
        <td style="padding:5px 10px;font-size:9.5px;font-weight:600;color:${C.textDark};">${escapeHtml(inf.name || inf.username)}</td>
        <td style="padding:5px 10px;font-size:9px;color:${C.textGray};">${escapeHtml(inf.platform)}</td>
        <td style="padding:5px 10px;font-size:9.5px;text-align:center;color:${C.textDark};font-weight:600;">${inf.mentions}</td>
        <td style="padding:5px 10px;font-size:9px;text-align:center;"><span style="background:${sentBg};color:${sentColor(inf.sentiment)};font-weight:700;padding:2px 8px;border-radius:10px;font-size:8px;">${sentLabel(inf.sentiment)}</span></td>
        <td style="padding:5px 10px;font-size:9.5px;text-align:right;font-weight:600;color:${C.textDark};">${escapeHtml(inf.reach || "—")}</td>
      </tr>`;
      })
      .join("");
    const table = `<table style="width:100%;border-collapse:collapse;">${headerRow}${rows}</table>`;
    blocks.push(section("Influenciadores", table));
  }

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  if (!isSummary && report.narratives.length > 0) {
    const narrativesHtml = report.narratives
      .map((n) => {
        const trendIcon = n.trend === "creciente" ? "📈" : n.trend === "decreciente" ? "📉" : "➡️";
        return `<div class="avoid-break" style="border:1px solid ${C.border};border-radius:6px;padding:10px 14px;margin-bottom:10px;background:${C.cardBg};border-left:4px solid ${sentColor(n.sentiment)};">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;font-weight:700;color:${C.textDark};">${escapeHtml(n.narrative)}</span>
          <span style="background:${sentColor(n.sentiment)}15;color:${sentColor(n.sentiment)};font-size:8px;padding:2px 8px;border-radius:10px;font-weight:700;">${sentLabel(n.sentiment)}</span>
          <span style="font-size:8px;color:${C.textGray};font-weight:500;">${trendIcon} <strong>${n.mentions}</strong> menciones · ${n.trend}</span>
        </div>
        <p style="font-size:10px;color:${C.textGray};line-height:1.55;margin:0;">${highlightText(n.description)}</p>
      </div>`;
      })
      .join("");
    blocks.push(section("Principales Narrativas", narrativesHtml));
  }

  const recs = isSummary ? report.recommendations.slice(0, 2) : report.recommendations;
  let recsHtml = "";
  if (recs.length > 0) {
    recsHtml += insightCard(highlightText(recs[0]), "💡", C.accent);
    recs.slice(1).forEach((r, i) => {
      recsHtml += `<div class="avoid-break" style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
        <div style="min-width:24px;height:24px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${i + 2}</div>
        <p style="font-size:10.5px;line-height:1.6;color:${C.textDark};margin:0;">${highlightText(r)}</p>
      </div>`;
    });
  }
  blocks.push(section("Recomendaciones", recsHtml));

  if (isSummary) {
    blocks.push(sectionSeparator);
  }

  if (report.conclusions && report.conclusions.length > 0) {
    const concs = isSummary ? report.conclusions.slice(0, 2) : report.conclusions;
    const bodyWithBullets = concs
      .map(
        (c) => `<div class="avoid-break" style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
        <span style="min-width:6px;height:6px;border-radius:50%;background:${C.accent};display:block;margin-top:5px;flex-shrink:0;"></span>
        <p style="font-size:10.5px;line-height:1.6;color:${C.textDark};margin:0;">${highlightText(c)}</p>
      </div>`,
      )
      .join("");
    blocks.push(section("Conclusiones", bodyWithBullets, C.primary));
  }

  const headerContext = truncateText(`${projectName} · ${badge.label} · ${dateRange.label}`, 68);
  const headerSubtitle = truncateText(report.title, 90);
  const repeatedHeader = `<div class="print-repeat-header" aria-hidden="true">
    <div class="print-repeat-header-inner">
      <img src="${LOGO_WHITE_B64}" alt="Wizr" class="print-repeat-header-logo" />
      <div class="print-repeat-header-copy">
        <div class="print-repeat-header-context">${escapeHtml(headerContext)}</div>
        <div class="print-repeat-header-title">${escapeHtml(headerSubtitle)}</div>
      </div>
    </div>
  </div>`;

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
body{
  font-family:'Inter',sans-serif;
  font-size:11px;
  color:${C.textDark};
  background:#fff;
  width:794px;
  margin:0 auto;
  -webkit-print-color-adjust:exact !important;
  print-color-adjust:exact !important;
  color-adjust:exact !important;
}
strong{font-weight:700;color:${C.primary};}
.report-shell{background:${C.white};}
.print-report-table{
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  background:${C.white};
}
.print-report-table td{
  padding:0;
  vertical-align:top;
}
.print-report-table thead{display:none;}
.print-repeat-header-row,
.print-repeat-header-cell{
  background:${C.primary};
}
.print-repeat-header{
  background:${C.primary};
  height:72px;
  position:relative;
  transform:translateY(-1px);
}
.print-repeat-header::after{
  content:"";
  display:block;
  height:18px;
  background:${C.white};
}
.print-repeat-header-inner{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:18px;
  height:72px;
  padding:0 26px;
}
.print-repeat-header-logo{
  height:56px;
  width:auto;
  display:block;
  flex-shrink:0;
}
.print-repeat-header-copy{
  min-width:0;
  max-width:72%;
  text-align:right;
  color:#fff;
}
.print-repeat-header-context{
  font-size:10px;
  line-height:1.35;
  font-weight:600;
  color:${C.accentLight};
  letter-spacing:0.2px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.print-repeat-header-title{
  font-size:11px;
  line-height:1.35;
  font-weight:700;
  color:#fff;
  margin-top:4px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.page-intro{padding-bottom:6px;}
.report-content{padding:0 20px 18px;}
.report-content > .pdf-section-block{margin-bottom:14px;}
.report-content > .pdf-section-block:last-child{margin-bottom:0;}

@page{
  size:A4;
  margin:0 0 44px 0;

  @bottom-left{
    content:"Generado con Wizr · ${generatedDate.replace(/"/g, '\\"')}";
    background-color:${C.primary};
    color:${C.accentLight};
    font-family:'Inter',sans-serif;
    font-size:8.5px;
    letter-spacing:0.4px;
    padding:0 0 0 24px;
    width:100%;
    margin:0;
    vertical-align:middle;
  }
  @bottom-right{
    content:"Página " counter(page) " de " counter(pages);
    background-color:${C.primary};
    color:#ffffff;
    font-family:'Inter',sans-serif;
    font-size:9px;
    font-weight:600;
    letter-spacing:0.4px;
    padding:0 24px 0 0;
    margin:0;
    vertical-align:middle;
  }
}

@media print{
  body{width:100%;margin:0;padding:0;}
  .print-report-table thead{display:table-header-group;}
  .print-repeat-header-cell{padding:0;}
  .print-repeat-header-row{height:90px;}
  .report-shell{padding:0;}
  .page-intro{page-break-inside:avoid;break-inside:avoid;}
  .page-intro-header{display:none;}
  .report-content{padding:0 20px 12px;}
  .report-content > .pdf-section-block{margin-bottom:14px;padding-bottom:8px;}
  .report-section{page-break-inside:auto;break-inside:auto;margin-bottom:6px;}
  .pdf-section-block{page-break-inside:auto;break-inside:auto;}
  .section-header-wrap{page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid;}
  .section-header{page-break-after:avoid;break-after:avoid;page-break-inside:avoid;break-inside:avoid;}
  .section-body{page-break-inside:auto;break-inside:auto;padding-bottom:6px;}
  .section-body > *:first-child{page-break-before:avoid;break-before:avoid;}
  .section-body > *:last-child{margin-bottom:14px;}
  .avoid-break{page-break-inside:avoid;break-inside:avoid;}
  table{page-break-inside:auto;}
  thead{display:table-header-group;}
  tr{page-break-inside:auto;page-break-after:auto;break-inside:auto;}
  p{orphans:2;widows:2;}
  h1,h2,h3,h4{page-break-after:avoid;break-after:avoid;}
}
@media screen{
  body{padding-bottom:30px;background:${C.borderLight};}
  .report-shell{box-shadow:0 8px 24px rgba(15,23,42,0.08);}
}
</style>
</head>
<body>
  <div class="report-shell">
    <table class="print-report-table" role="presentation">
      <thead>
        <tr class="print-repeat-header-row">
          <td class="print-repeat-header-cell">${repeatedHeader}</td>
        </tr>
      </thead>
      <tbody>
        <tr class="print-intro-row">
          <td>
            <div class="page-intro">
              <div class="page-intro-header">${header}</div>
              ${metricsRow}${sentBar}
            </div>
            <div class="report-content">
              ${blocks.map((block, blockIndex) => `<div class="pdf-section-block" data-pdf-section="block-${blockIndex + 1}">${block}</div>`).join("\n")}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}
