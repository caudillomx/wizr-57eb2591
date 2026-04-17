import type {
  SmartReportContent,
  SourceBreakdown,
  InfluencerInfo,
  TimelinePoint,
  MediaOutletInfo,
  NarrativeInfo,
} from "@/hooks/useSmartReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LOGO_WHITE_B64 } from "./logoBase64";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

// Sandwich palette: dark indigo for cover/closing, light slate for content
const C = {
  darkBg: "#0f172a",
  darkBg2: "#1e1b4b",
  darkAccent: "#a5b4fc",
  lightBg: "#ffffff",
  lightBg2: "#f8fafc",
  primary: "#4f46e5",
  primarySoft: "#eef2ff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#94a3b8",
  warning: "#f59e0b",
};

function esc(t: string | undefined | null): string {
  if (!t) return "";
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtNum(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("es-MX");
}

function sentColor(s: string): string {
  if (s === "positivo") return C.positive;
  if (s === "negativo") return C.negative;
  if (s === "mixto") return C.warning;
  return C.neutral;
}

function sentLabel(s: string): string {
  if (s === "positivo") return "Positivo";
  if (s === "negativo") return "Negativo";
  if (s === "mixto") return "Mixto";
  return "Neutral";
}

function trendIcon(t: string): string {
  if (t === "creciente") return "↗";
  if (t === "decreciente") return "↘";
  return "→";
}

function truncate(t: string, n: number): string {
  const s = (t || "").replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

/** Slide chrome — base 1920x1080, scales via CSS transform when embedded */
function slideShell(opts: {
  bg: "dark" | "light";
  pageNumber: number;
  total: number;
  projectName: string;
  body: string;
}): string {
  const isDark = opts.bg === "dark";
  const bg = isDark
    ? `background: linear-gradient(135deg, ${C.darkBg} 0%, ${C.darkBg2} 100%);`
    : `background: ${C.lightBg};`;
  const fg = isDark ? "#ffffff" : C.text;
  const subtle = isDark ? "rgba(255,255,255,0.55)" : C.textMuted;

  return `<section class="slide" style="position:relative;width:1920px;height:1080px;${bg}color:${fg};font-family:'Inter','Segoe UI',sans-serif;overflow:hidden;page-break-after:always;break-after:page;">
    ${opts.body}
    <footer style="position:absolute;left:80px;right:80px;bottom:36px;display:flex;justify-content:space-between;align-items:center;font-size:18px;color:${subtle};letter-spacing:0.04em;">
      <span style="font-weight:600;">${esc(opts.projectName)}</span>
      <span>${opts.pageNumber} / ${opts.total}</span>
    </footer>
  </section>`;
}

// ---------- SVG chart helpers (work in both browser & PDFShift) ----------

function svgDonut(pos: number, neu: number, neg: number, size = 380): string {
  const total = Math.max(pos + neu + neg, 1);
  const r = size / 2 - 30;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const segs = [
    { val: pos, color: C.positive },
    { val: neu, color: C.neutral },
    { val: neg, color: C.negative },
  ];
  let offset = 0;
  const arcs = segs
    .map((s) => {
      const len = (s.val / total) * circ;
      const dash = `${len} ${circ - len}`;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="48" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return el;
    })
    .join("");
  const dom = pos >= neg && pos >= neu ? "Positivo" : neg >= neu ? "Negativo" : "Neutral";
  const domColor = dom === "Positivo" ? C.positive : dom === "Negativo" ? C.negative : C.neutral;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${arcs}
    <text x="${cx}" y="${cy - 10}" text-anchor="middle" font-size="64" font-weight="800" fill="${C.text}">${total}</text>
    <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="22" fill="${C.textMuted}">menciones</text>
    <text x="${cx}" y="${cy + 70}" text-anchor="middle" font-size="20" font-weight="700" fill="${domColor}">${dom}</text>
  </svg>`;
}

function svgAreaTimeline(timeline: TimelinePoint[], width = 1500, height = 380): string {
  if (!timeline.length) return "";
  const data = timeline;
  const maxV = Math.max(...data.map((d) => d.count), 1);
  const padX = 60;
  const padY = 40;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (d.count / maxV) * innerH;
    return `${x},${y}`;
  });
  const path = `M${padX},${padY + innerH} L${points.join(" L")} L${padX + (data.length - 1) * stepX},${padY + innerH} Z`;
  const linePath = `M${points.join(" L")}`;

  // Mark peak
  const peakIdx = data.indexOf(data.reduce((a, b) => (a.count > b.count ? a : b)));
  const peak = data[peakIdx];
  const peakX = padX + peakIdx * stepX;
  const peakY = padY + innerH - (peak.count / maxV) * innerH;

  // X-axis labels (every Nth)
  const labelEvery = Math.max(1, Math.floor(data.length / 8));
  const xLabels = data
    .map((d, i) => {
      if (i % labelEvery !== 0 && i !== data.length - 1) return "";
      const x = padX + i * stepX;
      const lbl = d.date.slice(5);
      return `<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="16" fill="${C.textMuted}">${lbl}</text>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${C.primary}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="${C.primary}" stop-opacity="0.05"/>
      </linearGradient>
    </defs>
    <path d="${path}" fill="url(#areaGrad)"/>
    <path d="${linePath}" fill="none" stroke="${C.primary}" stroke-width="3"/>
    <circle cx="${peakX}" cy="${peakY}" r="9" fill="${C.negative}" stroke="#fff" stroke-width="3"/>
    <text x="${peakX}" y="${peakY - 18}" text-anchor="middle" font-size="20" font-weight="700" fill="${C.negative}">Pico: ${peak.count}</text>
    ${xLabels}
  </svg>`;
}

function svgHorizontalBars(
  data: { label: string; value: number; color?: string }[],
  width = 1700,
  rowH = 56,
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => d.value), 1);
  const labelW = 360;
  const valueW = 120;
  const barW = width - labelW - valueW - 60;
  const height = data.length * rowH + 20;
  const rows = data
    .map((d, i) => {
      const y = i * rowH + 10;
      const w = (d.value / max) * barW;
      const color = d.color || C.primary;
      return `
        <text x="${labelW - 20}" y="${y + rowH / 2 + 8}" text-anchor="end" font-size="22" font-weight="600" fill="${C.text}">${esc(truncate(d.label, 32))}</text>
        <rect x="${labelW}" y="${y + 12}" width="${barW}" height="${rowH - 24}" rx="6" fill="${C.lightBg2}"/>
        <rect x="${labelW}" y="${y + 12}" width="${w}" height="${rowH - 24}" rx="6" fill="${color}"/>
        <text x="${labelW + barW + 20}" y="${y + rowH / 2 + 8}" font-size="22" font-weight="700" fill="${C.text}">${fmtNum(d.value)}</text>
      `;
    })
    .join("");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows}</svg>`;
}

// ---------- Slides ----------

function slideCover(report: SmartReportContent, projectName: string, dateRange: DateRange, total: number): string {
  const dateLabel = `${format(new Date(dateRange.start), "d 'de' MMMM", { locale: es })} – ${format(new Date(dateRange.end), "d 'de' MMMM yyyy", { locale: es })}`;
  const body = `
    <div style="position:absolute;top:80px;left:80px;display:flex;align-items:center;gap:18px;">
      <img src="${LOGO_WHITE_B64}" alt="Wizr" style="height:48px;"/>
      <span style="font-size:18px;letter-spacing:0.2em;color:${C.darkAccent};font-weight:600;">REPORTE VISUAL</span>
    </div>
    <div style="position:absolute;top:50%;left:80px;right:80px;transform:translateY(-50%);">
      <div style="font-size:24px;color:${C.darkAccent};letter-spacing:0.15em;text-transform:uppercase;font-weight:600;margin-bottom:24px;">Inteligencia de medios</div>
      <h1 style="font-size:96px;font-weight:800;line-height:1.05;margin:0 0 32px 0;letter-spacing:-0.02em;">${esc(projectName)}</h1>
      <div style="font-size:32px;color:rgba(255,255,255,0.85);font-weight:400;">${dateLabel}</div>
      <div style="margin-top:48px;display:flex;gap:48px;">
        <div><div style="font-size:64px;font-weight:800;color:#fff;">${fmtNum(report.metrics.totalMentions)}</div><div style="font-size:18px;color:${C.darkAccent};text-transform:uppercase;letter-spacing:0.1em;">Menciones</div></div>
        <div><div style="font-size:64px;font-weight:800;color:#fff;">${fmtNum(report.metrics.estimatedReach)}</div><div style="font-size:18px;color:${C.darkAccent};text-transform:uppercase;letter-spacing:0.1em;">Alcance estimado</div></div>
        <div><div style="font-size:64px;font-weight:800;color:#fff;">${report.totalUniqueAuthors || 0}</div><div style="font-size:18px;color:${C.darkAccent};text-transform:uppercase;letter-spacing:0.1em;">Autores únicos</div></div>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: 1, total, projectName, body });
}

function slideSummary(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const m = report.metrics;
  const tot = m.totalMentions || 1;
  const negPct = Math.round((m.negativeCount / tot) * 100);
  const posPct = Math.round((m.positiveCount / tot) * 100);
  const summary = report.summary || "";
  const body = `
    <div style="padding:96px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:18px;">Brief Ejecutivo</div>
      <h2 style="font-size:48px;font-weight:800;margin:0 0 36px 0;line-height:1.15;color:${C.text};">${esc(report.title || "Resumen del período")}</h2>
      <p style="font-size:26px;line-height:1.55;color:${C.text};margin:0 0 48px 0;max-width:1600px;">${esc(truncate(summary, 480))}</p>
      <div style="margin-top:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;">
        <div style="background:${C.primarySoft};border-radius:16px;padding:32px;">
          <div style="font-size:18px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Menciones</div>
          <div style="font-size:64px;font-weight:800;color:${C.primary};margin-top:8px;">${fmtNum(m.totalMentions)}</div>
        </div>
        <div style="background:#dcfce7;border-radius:16px;padding:32px;">
          <div style="font-size:18px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Positivo</div>
          <div style="font-size:64px;font-weight:800;color:${C.positive};margin-top:8px;">${posPct}%</div>
        </div>
        <div style="background:#fee2e2;border-radius:16px;padding:32px;">
          <div style="font-size:18px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Negativo</div>
          <div style="font-size:64px;font-weight:800;color:${C.negative};margin-top:8px;">${negPct}%</div>
        </div>
        <div style="background:#f1f5f9;border-radius:16px;padding:32px;">
          <div style="font-size:18px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Alcance</div>
          <div style="font-size:64px;font-weight:800;color:${C.text};margin-top:8px;">${fmtNum(m.estimatedReach)}</div>
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideSentiment(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const m = report.metrics;
  const interp = report.sentimentAnalysis || "El análisis muestra el balance del sentimiento del periodo.";
  const body = `
    <div style="padding:96px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:18px;">Pulso de Sentimiento</div>
      <h2 style="font-size:48px;font-weight:800;margin:0 0 48px 0;color:${C.text};">Distribución del periodo</h2>
      <div style="display:flex;gap:80px;align-items:center;flex:1;">
        <div style="flex-shrink:0;">${svgDonut(m.positiveCount, m.neutralCount, m.negativeCount, 440)}</div>
        <div style="flex:1;">
          <div style="display:flex;flex-direction:column;gap:18px;margin-bottom:36px;">
            <div style="display:flex;align-items:center;gap:18px;font-size:24px;"><span style="width:24px;height:24px;border-radius:6px;background:${C.positive};"></span>Positivo · <strong>${m.positiveCount}</strong></div>
            <div style="display:flex;align-items:center;gap:18px;font-size:24px;"><span style="width:24px;height:24px;border-radius:6px;background:${C.neutral};"></span>Neutral · <strong>${m.neutralCount}</strong></div>
            <div style="display:flex;align-items:center;gap:18px;font-size:24px;"><span style="width:24px;height:24px;border-radius:6px;background:${C.negative};"></span>Negativo · <strong>${m.negativeCount}</strong></div>
          </div>
          <div style="background:${C.lightBg2};border-left:6px solid ${C.primary};padding:28px 32px;border-radius:8px;font-size:22px;line-height:1.55;color:${C.text};">
            ${esc(truncate(interp, 380))}
          </div>
        </div>
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideTimeline(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const peak = report.timeline.length
    ? report.timeline.reduce((a, b) => (a.count > b.count ? a : b))
    : null;
  const body = `
    <div style="padding:96px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:18px;">Volumen en el Tiempo</div>
      <h2 style="font-size:48px;font-weight:800;margin:0 0 36px 0;color:${C.text};">Evolución diaria de menciones</h2>
      <div style="background:${C.lightBg2};border-radius:16px;padding:36px;flex:1;display:flex;align-items:center;justify-content:center;">
        ${svgAreaTimeline(report.timeline, 1620, 460)}
      </div>
      ${peak ? `<div style="margin-top:24px;font-size:22px;color:${C.textMuted};">Pico de actividad: <strong style="color:${C.text};">${peak.date}</strong> con <strong style="color:${C.negative};">${peak.count} menciones</strong>.</div>` : ""}
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideNarratives(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const narr = report.narratives.slice(0, 5);
  const totalMentions = report.metrics.totalMentions || 1;
  const cards = narr
    .map((n: NarrativeInfo, i: number) => {
      const pct = Math.round((n.mentions / totalMentions) * 100);
      const sc = sentColor(n.sentiment);
      return `<div style="background:${C.lightBg};border:2px solid ${C.border};border-left:8px solid ${sc};border-radius:14px;padding:26px 28px;display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <div style="font-size:14px;font-weight:800;color:${C.primary};letter-spacing:0.1em;">NARRATIVA ${i + 1}</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span style="background:${sc};color:#fff;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;text-transform:uppercase;">${sentLabel(n.sentiment)}</span>
            <span style="font-size:18px;color:${C.textMuted};">${trendIcon(n.trend)}</span>
          </div>
        </div>
        <div style="font-size:22px;font-weight:700;color:${C.text};line-height:1.3;">${esc(truncate(n.narrative, 90))}</div>
        <div style="font-size:16px;color:${C.textMuted};line-height:1.45;">${esc(truncate(n.description, 180))}</div>
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid ${C.border};padding-top:10px;">
          <span style="font-size:13px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">Volumen</span>
          <span style="font-size:28px;font-weight:800;color:${C.text};">${n.mentions} <span style="font-size:16px;color:${C.textMuted};font-weight:500;">(${pct}%)</span></span>
        </div>
      </div>`;
    })
    .join("");
  const body = `
    <div style="padding:80px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:14px;">Narrativas Dominantes</div>
      <h2 style="font-size:44px;font-weight:800;margin:0 0 32px 0;color:${C.text};">Top ${narr.length} ideas que circularon</h2>
      <div style="display:grid;grid-template-columns:repeat(${narr.length <= 2 ? narr.length : narr.length <= 4 ? 2 : 3},1fr);gap:20px;flex:1;">
        ${cards}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideInfluencers(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const top = report.influencers.slice(0, 6);
  const rows = top
    .map((inf, i) => {
      const reach = inf.reach || `${fmtNum(inf.mentions)} menciones`;
      return `<div style="display:flex;align-items:center;gap:24px;padding:22px 28px;background:${i === 0 ? C.primarySoft : C.lightBg2};border-radius:14px;border:2px solid ${i === 0 ? C.primary : "transparent"};">
        <div style="width:60px;height:60px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:24px;font-weight:800;color:${C.text};line-height:1.2;">${esc(truncate(inf.name || inf.username, 36))}</div>
          <div style="font-size:16px;color:${C.textMuted};margin-top:4px;">${esc(inf.platform)} · ${esc(reach)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:800;color:${C.text};">${inf.mentions}</div>
          <div style="font-size:13px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">menciones</div>
        </div>
        <span style="background:${sentColor(inf.sentiment)};color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;text-transform:uppercase;">${sentLabel(inf.sentiment)}</span>
      </div>`;
    })
    .join("");
  const body = `
    <div style="padding:80px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:14px;">Influenciadores Clave</div>
      <h2 style="font-size:44px;font-weight:800;margin:0 0 32px 0;color:${C.text};">Voces con mayor impacto en redes</h2>
      <div style="display:flex;flex-direction:column;gap:14px;flex:1;">${rows || `<div style="font-size:22px;color:${C.textMuted};text-align:center;padding:80px;">Sin influenciadores destacados en el periodo.</div>`}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideMediaOutlets(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const media = (report.mediaOutlets || []).slice(0, 6);
  const rows = media
    .map((m: MediaOutletInfo, i) => {
      return `<div style="display:flex;align-items:center;gap:24px;padding:22px 28px;background:${i === 0 ? "#fef3c7" : C.lightBg2};border-radius:14px;border:2px solid ${i === 0 ? C.warning : "transparent"};">
        <div style="width:60px;height:60px;border-radius:14px;background:${C.text};color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0;">${i + 1}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:24px;font-weight:800;color:${C.text};line-height:1.2;">${esc(truncate(m.name, 40))}</div>
          <div style="font-size:16px;color:${C.textMuted};margin-top:4px;">${esc(m.domain)}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:32px;font-weight:800;color:${C.text};">${m.articles}</div>
          <div style="font-size:13px;color:${C.textMuted};text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">artículos</div>
        </div>
        <span style="background:${sentColor(m.sentiment)};color:#fff;padding:6px 14px;border-radius:6px;font-size:13px;font-weight:700;text-transform:uppercase;">${sentLabel(m.sentiment)}</span>
      </div>`;
    })
    .join("");
  const body = `
    <div style="padding:80px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:14px;">Medios de Amplio Alcance</div>
      <h2 style="font-size:44px;font-weight:800;margin:0 0 32px 0;color:${C.text};">Cobertura editorial dominante</h2>
      <div style="display:flex;flex-direction:column;gap:14px;flex:1;">${rows || `<div style="font-size:22px;color:${C.textMuted};text-align:center;padding:80px;">Sin medios digitales destacados en el periodo.</div>`}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideSourceMix(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const sources = report.sourceBreakdown.slice(0, 8);
  const data = sources.map((s) => ({ label: s.source, value: s.count, color: C.primary }));
  const body = `
    <div style="padding:80px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:14px;">Distribución por Plataforma</div>
      <h2 style="font-size:44px;font-weight:800;margin:0 0 36px 0;color:${C.text};">¿Dónde sucede la conversación?</h2>
      <div style="background:${C.lightBg2};border-radius:16px;padding:40px;flex:1;display:flex;align-items:center;justify-content:center;">
        ${data.length ? svgHorizontalBars(data, 1700, 64) : `<div style="font-size:22px;color:${C.textMuted};">Sin datos de plataforma.</div>`}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideKeyFindings(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const findings = report.keyFindings.slice(0, 4);
  const items = findings
    .map(
      (f, i) => `<div style="display:flex;gap:24px;align-items:flex-start;padding:24px 28px;background:${C.lightBg2};border-radius:14px;border-left:6px solid ${C.primary};">
      <div style="width:56px;height:56px;border-radius:50%;background:${C.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0;">${i + 1}</div>
      <div style="font-size:22px;line-height:1.5;color:${C.text};">${esc(truncate(f, 280))}</div>
    </div>`,
    )
    .join("");
  const body = `
    <div style="padding:80px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:14px;">Hallazgos Clave</div>
      <h2 style="font-size:44px;font-weight:800;margin:0 0 36px 0;color:${C.text};">Lo más importante del periodo</h2>
      <div style="display:flex;flex-direction:column;gap:18px;flex:1;">${items}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideRecommendations(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const recs = report.recommendations.slice(0, 4);
  const items = recs
    .map(
      (r, i) => `<div style="display:flex;gap:24px;align-items:flex-start;padding:24px 28px;background:${C.primarySoft};border-radius:14px;border-left:6px solid ${C.primary};">
      <div style="width:56px;height:56px;border-radius:14px;background:${C.text};color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;flex-shrink:0;">${i + 1}</div>
      <div style="font-size:22px;line-height:1.5;color:${C.text};">${esc(truncate(r, 280))}</div>
    </div>`,
    )
    .join("");
  const body = `
    <div style="padding:80px 96px 120px 96px;height:100%;display:flex;flex-direction:column;">
      <div style="font-size:18px;letter-spacing:0.2em;color:${C.primary};font-weight:700;text-transform:uppercase;margin-bottom:14px;">Recomendaciones</div>
      <h2 style="font-size:44px;font-weight:800;margin:0 0 36px 0;color:${C.text};">Acciones priorizadas</h2>
      <div style="display:flex;flex-direction:column;gap:18px;flex:1;">${items}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, projectName, body });
}

function slideClosing(report: SmartReportContent, projectName: string, page: number, total: number): string {
  const conclusion =
    report.conclusions?.[0] ||
    `Reporte generado a partir de ${report.metrics.totalMentions} menciones del periodo. Para análisis detallado revisa el reporte completo en el dashboard.`;
  const body = `
    <div style="position:absolute;top:80px;left:80px;display:flex;align-items:center;gap:18px;">
      <img src="${LOGO_WHITE_B64}" alt="Wizr" style="height:48px;"/>
    </div>
    <div style="position:absolute;top:50%;left:80px;right:80px;transform:translateY(-50%);">
      <div style="font-size:24px;color:${C.darkAccent};letter-spacing:0.15em;text-transform:uppercase;font-weight:600;margin-bottom:32px;">Conclusión</div>
      <p style="font-size:48px;font-weight:600;line-height:1.3;margin:0 0 56px 0;color:#fff;max-width:1500px;">${esc(truncate(conclusion, 360))}</p>
      <div style="height:1px;background:rgba(255,255,255,0.2);margin:48px 0;"></div>
      <div style="font-size:22px;color:${C.darkAccent};">Wizr Inteligencia de Medios · ${esc(projectName)}</div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: page, total, projectName, body });
}

// ---------- Public API ----------

export interface BuiltSlides {
  /** Each slide as standalone HTML body for browser viewer */
  slides: string[];
  /** Full HTML document for PDFShift */
  fullHtml: string;
  count: number;
}

export function buildSlidesReport(
  report: SmartReportContent,
  projectName: string,
  dateRange: DateRange,
): BuiltSlides {
  // Estimate total upfront (refined below)
  const slidesArr: string[] = [];
  const totalEstimate = 11; // cover + summary + sentiment + timeline + narratives + influencers + media + sources + findings + recs + closing

  let p = 1;
  slidesArr.push(slideCover(report, projectName, dateRange, totalEstimate));
  p++;
  slidesArr.push(slideSummary(report, projectName, p, totalEstimate));
  p++;
  slidesArr.push(slideSentiment(report, projectName, p, totalEstimate));
  p++;
  if (report.timeline.length > 0) {
    slidesArr.push(slideTimeline(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.narratives.length > 0) {
    slidesArr.push(slideNarratives(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.influencers.length > 0) {
    slidesArr.push(slideInfluencers(report, projectName, p, totalEstimate));
    p++;
  }
  if ((report.mediaOutlets || []).length > 0) {
    slidesArr.push(slideMediaOutlets(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.sourceBreakdown.length > 0) {
    slidesArr.push(slideSourceMix(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.keyFindings.length > 0) {
    slidesArr.push(slideKeyFindings(report, projectName, p, totalEstimate));
    p++;
  }
  if (report.recommendations.length > 0) {
    slidesArr.push(slideRecommendations(report, projectName, p, totalEstimate));
    p++;
  }
  slidesArr.push(slideClosing(report, projectName, p, totalEstimate));

  // Renumber footers with real total
  const realTotal = slidesArr.length;
  const renumbered = slidesArr.map((html, i) =>
    html.replace(/(\d+)\s*\/\s*\d+(<\/span>\s*<\/footer>)/, `${i + 1} / ${realTotal}$2`),
  );

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${esc(projectName)} — Reporte Visual</title>
    <style>
      @page { size: 1920px 1080px; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; background:#fff; }
      body { font-family: 'Inter', 'Segoe UI', sans-serif; }
      .slide { page-break-after: always; break-after: page; }
      .slide:last-child { page-break-after: auto; break-after: auto; }
    </style>
    </head><body>${renumbered.join("")}</body></html>`;

  return { slides: renumbered, fullHtml, count: realTotal };
}
