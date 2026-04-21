import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { WIZR_LOGO_COLOR_B64 } from "./wizrLogoColor";

interface DateRange {
  start: string;
  end: string;
  label: string;
}

const C = {
  ink: "#0B0A1F",
  inkSoft: "#1A1638",
  paper: "#FAFAFC",
  paperAlt: "#F2F1F8",
  border: "#E5E3EE",
  // Editorial indigo palette (paridad con PerformanceReportView)
  indigoDeep: "#1e1b4b",
  indigoMid: "#312e81",
  indigoBright: "#4338ca",
  indigoGlow: "#6366f1",
  indigoSoft: "#EEF2FF",
  indigoText: "#c7d2fe",
  violet: "#4338ca", // alias para charts
  violetSoft: "#EEF2FF",
  violetGlow: "#6366f1",
  orange: "#FF6B2C",
  orangeSoft: "#FFE9DD",
  text: "#0B0A1F",
  textMid: "#4A4760",
  textMuted: "#8E8BA3",
  positive: "#22C55E",
  negative: "#EF4444",
  neutral: "#9CA3AF",
};

const INDIGO_GRADIENT = "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)";
const INDIGO_GRADIENT_RADIAL = "radial-gradient(ellipse at top right, #312e81 0%, #1e1b4b 60%)";

function esc(t: string | null | undefined): string {
  if (!t) return "";
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString("es-MX");
}

function networkLabel(n: string): string {
  const m: Record<string, string> = {
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "X",
    x: "X",
    youtube: "YouTube",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
  };
  return m[n.toLowerCase()] || n;
}

function truncate(s: string, n: number): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

function sparkles(color: string, opacity = 1): string {
  return `<svg width="180" height="180" viewBox="0 0 180 180" style="opacity:${opacity};">
    <path d="M90 20 L96 50 L126 56 L96 62 L90 92 L84 62 L54 56 L84 50 Z" fill="${color}"/>
    <path d="M150 90 L154 110 L174 114 L154 118 L150 138 L146 118 L126 114 L146 110 Z" fill="${color}"/>
    <path d="M40 110 L43 124 L57 127 L43 130 L40 144 L37 130 L23 127 L37 124 Z" fill="${color}"/>
  </svg>`;
}

function slideShell(opts: {
  bg: "dark" | "light" | "accent";
  pageNumber: number;
  total: number;
  clientName: string;
  modeLabel: string;
  body: string;
  showHeader?: boolean;
  sectionLabel?: string;
}): string {
  const isDark = opts.bg === "dark";
  const isAccent = opts.bg === "accent";
  let bg: string;
  let fg: string;
  let subtle: string;
  if (isDark) {
    bg = `background: ${INDIGO_GRADIENT_RADIAL};`;
    fg = "#FFFFFF";
    subtle = C.indigoText;
  } else if (isAccent) {
    bg = `background: linear-gradient(135deg, ${C.indigoSoft} 0%, ${C.paper} 100%);`;
    fg = C.text;
    subtle = C.textMuted;
  } else {
    bg = `background: ${C.paper};`;
    fg = C.text;
    subtle = C.textMuted;
  }

  const header = opts.showHeader === false ? "" : `
    <header style="position:absolute;top:44px;left:80px;right:80px;display:flex;justify-content:space-between;align-items:center;z-index:5;">
      <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:54px;${isDark ? "filter:brightness(0) invert(1);" : ""}"/>
      ${opts.sectionLabel ? `<div style="font-size:13px;letter-spacing:0.25em;color:${isDark ? "rgba(255,255,255,0.6)" : C.textMuted};font-weight:700;text-transform:uppercase;">${esc(opts.sectionLabel)}</div>` : ""}
    </header>`;

  return `<section class="slide" style="position:relative;width:1920px;height:1080px;${bg}color:${fg};font-family:'Inter','Segoe UI',sans-serif;overflow:hidden;page-break-after:always;break-after:page;">
    ${header}
    ${opts.body}
    <footer style="position:absolute;left:80px;right:80px;bottom:36px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:${subtle};letter-spacing:0.08em;z-index:5;">
      <span style="font-weight:600;text-transform:uppercase;">${esc(opts.clientName)} · ${esc(opts.modeLabel)}</span>
      <span style="font-variant-numeric:tabular-nums;">${String(opts.pageNumber).padStart(2, "0")} / ${String(opts.total).padStart(2, "0")}</span>
    </footer>
  </section>`;
}

// ---------- SVG charts ----------

function svgRankingBars(
  data: { label: string; value: number; isOwn: boolean }[],
  width = 1620,
  rowH = 70,
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => d.value), 0.01);
  const labelW = 380;
  const valueW = 160;
  const barW = width - labelW - valueW - 60;
  const height = data.length * rowH + 20;
  const rows = data
    .map((d, i) => {
      const y = i * rowH + 10;
      const w = (d.value / max) * barW;
      const color = d.isOwn ? C.violet : C.textMuted;
      return `
        <text x="${labelW - 24}" y="${y + rowH / 2 + 7}" text-anchor="end" font-size="22" font-weight="${d.isOwn ? 800 : 600}" fill="${C.text}">${esc(truncate(d.label, 30))}</text>
        <rect x="${labelW}" y="${y + 16}" width="${barW}" height="${rowH - 32}" rx="6" fill="${C.paperAlt}"/>
        <rect x="${labelW}" y="${y + 16}" width="${w}" height="${rowH - 32}" rx="6" fill="${color}"/>
        <text x="${labelW + barW + 24}" y="${y + rowH / 2 + 7}" font-size="22" font-weight="800" fill="${C.text}">${d.value.toFixed(2)}%</text>
      `;
    })
    .join("");
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rows}</svg>`;
}

function svgSovDonut(
  data: { label: string; value: number; isOwn: boolean }[],
  size = 460,
): string {
  if (!data.length) return "";
  const total = Math.max(data.reduce((s, d) => s + d.value, 0), 0.001);
  const r = size / 2 - 36;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const palette = [C.violet, "#F97316", "#06B6D4", "#8B5CF6", "#EC4899", "#22C55E", "#EAB308", "#EF4444"];
  let offset = 0;
  const arcs = data
    .map((d, i) => {
      const len = (d.value / total) * circ;
      const dash = `${len} ${circ - len}`;
      const color = d.isOwn ? C.violet : palette[(i + 1) % palette.length];
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="62" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return el;
    })
    .join("");
  const own = data.find((d) => d.isOwn);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${arcs}
    ${own ? `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="68" font-weight="800" fill="${C.text}">${own.value.toFixed(1)}%</text>
    <text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="18" fill="${C.textMuted}" letter-spacing="2">SoV PROPIO</text>` : ""}
  </svg>`;
}

// ---------- Slides ----------

function slideCover(report: PerformanceReportContent, clientName: string, dateRange: DateRange, total: number): string {
  const isBrand = report.reportMode === "brand";
  const modeLabel = isBrand ? "Reporte de Marca" : "Reporte de Benchmark";
  const dateLabel = (() => {
    try {
      return `${format(new Date(dateRange.start), "d MMM", { locale: es })} — ${format(new Date(dateRange.end), "d MMM yyyy", { locale: es })}`;
    } catch {
      return dateRange.label;
    }
  })();

  const body = `
    <div style="position:absolute;inset:0;display:grid;grid-template-columns:1.35fr 1fr;">
      <div style="position:relative;overflow:hidden;padding:96px 88px;display:flex;flex-direction:column;justify-content:space-between;">
        <div style="position:absolute;bottom:-260px;left:-260px;width:780px;height:780px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 70%);opacity:0.45;pointer-events:none;"></div>
        <div style="position:absolute;top:-180px;right:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, rgba(255,107,44,0.18) 0%, transparent 70%);pointer-events:none;"></div>
        <div style="position:absolute;top:60px;right:40px;transform:scale(1.6);opacity:0.85;pointer-events:none;">${sparkles(C.orange, 0.9)}</div>

        <div style="position:relative;z-index:5;">
          <div style="display:inline-flex;align-items:center;gap:12px;padding:11px 24px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:100px;backdrop-filter:blur(8px);">
            <span style="width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 6px rgba(255,107,44,0.18);"></span>
            <span style="font-size:13px;letter-spacing:0.28em;color:#fff;font-weight:700;text-transform:uppercase;">Wizr · Performance · ${esc(modeLabel)}</span>
          </div>
        </div>

        <div style="position:relative;z-index:5;display:flex;flex-direction:column;gap:36px;">
          <div style="display:flex;align-items:center;gap:20px;">
            <span style="width:64px;height:3px;background:${C.orange};"></span>
            <span style="font-size:14px;letter-spacing:0.32em;color:rgba(255,255,255,0.55);font-weight:700;text-transform:uppercase;">Periodo</span>
            <span style="font-size:18px;color:rgba(255,255,255,0.85);font-weight:500;">${esc(dateLabel)}</span>
          </div>
          <h1 style="font-size:128px;font-weight:800;line-height:0.92;margin:0;letter-spacing:-0.045em;color:#fff;">${esc(clientName)}</h1>
          <p style="font-size:24px;line-height:1.45;color:rgba(255,255,255,0.7);font-weight:400;max-width:780px;margin:0;">
            ${esc(report.title || (isBrand ? "Síntesis del desempeño en redes sociales del período." : "Análisis competitivo: marca propia vs competencia."))}
          </p>
        </div>

        <div style="position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,0.12);padding-top:28px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="font-size:11px;letter-spacing:0.32em;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;">Elaborado por</span>
            <span style="font-size:14px;color:rgba(255,255,255,0.85);font-weight:600;">Wizr · Performance Intelligence</span>
          </div>
          <div style="font-size:11px;letter-spacing:0.32em;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;">Confidencial</div>
        </div>
      </div>

      <div style="position:relative;background:#FFFFFF;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;">
        <div style="position:absolute;top:-120px;right:-120px;width:360px;height:360px;border-radius:50%;background:${C.violetSoft};opacity:0.6;"></div>
        <div style="position:absolute;bottom:-160px;left:-160px;width:420px;height:420px;border-radius:50%;background:${C.violetSoft};opacity:0.45;"></div>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:${C.orange};box-shadow:0 0 0 14px rgba(255,107,44,0.12);"></div>

        <div style="position:relative;z-index:5;display:flex;flex-direction:column;align-items:center;gap:48px;padding:40px;">
          <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="width:78%;max-width:520px;height:auto;display:block;"/>
          <div style="display:flex;align-items:center;gap:14px;">
            <span style="width:36px;height:2px;background:${C.violet};"></span>
            <span style="font-size:13px;letter-spacing:0.32em;color:${C.violet};font-weight:800;text-transform:uppercase;">Performance Intelligence</span>
            <span style="width:36px;height:2px;background:${C.violet};"></span>
          </div>
        </div>

        <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;font-size:12px;letter-spacing:0.28em;color:${C.textMid};text-transform:uppercase;font-weight:700;z-index:5;">wizr.mx</div>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: 1, total, clientName, modeLabel, body, showHeader: false });
}

function slideExecutiveSummary(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const summary = report.summary || "";
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:grid;grid-template-columns:1.2fr 1fr;gap:80px;">
      <div style="display:flex;flex-direction:column;gap:36px;">
        <div>
          <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:18px;">Resumen Ejecutivo</div>
          <h2 style="font-size:74px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Síntesis del<br/>período</h2>
        </div>
        <p style="font-size:24px;line-height:1.55;color:${C.textMid};margin:0;font-weight:400;">${esc(truncate(summary, 720))}</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:18px;justify-content:center;">
        ${report.highlights.slice(0, 4).map((h) => `
          <div style="background:linear-gradient(135deg, ${C.violetSoft} 0%, ${C.paper} 100%);border:1px solid ${C.border};border-radius:14px;padding:22px 26px;">
            <div style="font-size:12px;letter-spacing:0.25em;color:${C.textMuted};font-weight:700;text-transform:uppercase;">${esc(h.label)}</div>
            <div style="font-size:42px;font-weight:800;color:${C.violet};margin:6px 0;letter-spacing:-0.02em;">${esc(h.value)}</div>
            <div style="font-size:15px;color:${C.textMid};line-height:1.45;">${esc(h.context)}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Resumen" });
}

function slideKpis(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const a = report.analytics;
  const cards = [
    { label: "Perfiles", value: String(report.profiles.length), sub: a.networks.map(networkLabel).join(" · ") },
    { label: "Engagement Promedio", value: `${a.avgEngagement}%`, sub: a.bestPerformer ? `Mejor: ${a.bestPerformer.name}` : "" },
    { label: "Crecimiento Promedio", value: `${a.avgGrowth}%`, sub: a.fastestGrower ? `Top: ${a.fastestGrower.name}` : "" },
    { label: "Total Seguidores", value: fmtNum(a.totalFollowers), sub: "Suma de audiencia" },
  ];

  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:54px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">KPIs del Período</div>
        <h2 style="font-size:64px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Métricas clave</h2>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:28px;">
        ${cards.map((c) => `
          <div style="background:${C.paperAlt};border:1px solid ${C.border};border-radius:18px;padding:36px 40px;">
            <div style="font-size:14px;letter-spacing:0.25em;color:${C.textMuted};font-weight:700;text-transform:uppercase;">${esc(c.label)}</div>
            <div style="font-size:96px;font-weight:800;color:${C.violet};margin:10px 0;letter-spacing:-0.04em;line-height:1;">${esc(c.value)}</div>
            ${c.sub ? `<div style="font-size:18px;color:${C.textMid};">${esc(c.sub)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "KPIs" });
}

function slideRanking(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const data = report.analytics.rankingByEngagement.slice(0, 8).map((r) => ({
    label: `${r.name} · ${networkLabel(r.network)}`,
    value: r.engagement,
    isOwn: r.isOwn,
  }));
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:36px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Ranking</div>
        <h2 style="font-size:64px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Engagement por perfil</h2>
        <p style="font-size:18px;color:${C.textMid};margin:14px 0 0 0;">${report.reportMode === "brand" ? "Desempeño relativo de los perfiles de la marca." : "Marca propia (violeta) vs competencia (gris)."}</p>
      </div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">${svgRankingBars(data)}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Ranking" });
}

function slideShareOfVoice(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const sov = report.analytics.shareOfVoice.filter((s) => s.engagementShare > 0).slice(0, 8);
  const data = sov.map((s) => ({ label: s.name, value: s.engagementShare, isOwn: s.isOwn }));
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:grid;grid-template-columns:1fr 1.1fr;gap:80px;align-items:center;">
      <div style="display:flex;flex-direction:column;gap:24px;">
        <div>
          <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Share of Voice</div>
          <h2 style="font-size:64px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Distribución del<br/>engagement total</h2>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
          ${data.slice(0, 6).map((d, i) => {
            const palette = [C.violet, "#F97316", "#06B6D4", "#8B5CF6", "#EC4899", "#22C55E"];
            const color = d.isOwn ? C.violet : palette[(i + 1) % palette.length];
            return `<div style="display:flex;align-items:center;gap:14px;font-size:18px;">
              <span style="width:14px;height:14px;border-radius:3px;background:${color};"></span>
              <span style="flex:1;color:${d.isOwn ? C.text : C.textMid};font-weight:${d.isOwn ? 700 : 500};">${esc(d.label)}</span>
              <span style="font-weight:800;color:${C.text};font-variant-numeric:tabular-nums;">${d.value.toFixed(1)}%</span>
            </div>`;
          }).join("")}
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;">${svgSovDonut(data)}</div>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Share of Voice" });
}

function slideTopContent(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const posts = report.topPosts.slice(0, 4);
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:32px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.violet};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Top Contenidos</div>
        <h2 style="font-size:60px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Mejores publicaciones del período</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:22px;flex:1;">
        ${posts.map((p, i) => `
          <div style="background:${C.paper};border:1px solid ${C.border};border-radius:16px;padding:26px 30px;display:flex;flex-direction:column;gap:14px;box-shadow:0 2px 8px rgba(11,10,31,0.04);">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="width:36px;height:36px;border-radius:50%;background:${C.violet};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;">${i + 1}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:18px;font-weight:700;color:${C.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.authorName)}</div>
                <div style="font-size:14px;color:${C.textMuted};">${esc(networkLabel(p.network))} · ${esc(p.postDate)}</div>
              </div>
            </div>
            ${p.postContent ? `<p style="font-size:15px;line-height:1.5;color:${C.textMid};margin:0;">${esc(truncate(p.postContent, 220))}</p>` : ""}
            <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:14px;color:${C.textMid};margin-top:auto;border-top:1px solid ${C.border};padding-top:12px;">
              <span><strong style="color:${C.violet};font-size:18px;">${fmtNum(p.engagement)}</strong> engagement</span>
              <span>${fmtNum(p.likes)} likes</span>
              <span>${fmtNum(p.comments)} coment.</span>
            </div>
          </div>
        `).join("")}
      </div>
      ${report.topContentInsight ? `<div style="background:${C.violetSoft};border-left:4px solid ${C.violet};border-radius:0 8px 8px 0;padding:18px 24px;font-size:18px;line-height:1.55;color:${C.text};">${esc(truncate(report.topContentInsight, 300))}</div>` : ""}
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Top Contenidos" });
}

function slideFindings(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const items = report.keyFindings.slice(0, 5);
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:36px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.indigoBright};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Sección · Hallazgos Clave</div>
        <h2 style="font-size:64px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Lo más relevante del período</h2>
      </div>
      <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;flex:1;">
        ${items.map((it, i) => `
          <li style="display:flex;gap:32px;align-items:flex-start;background:#FFFFFF;border:1px solid ${C.border};border-left:6px solid ${C.indigoBright};border-radius:14px;padding:26px 32px;">
            <span style="flex-shrink:0;font-size:64px;font-weight:800;color:${C.indigoBright};line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.04em;min-width:80px;">${String(i + 1).padStart(2, "0")}</span>
            <span style="flex:1;font-size:22px;line-height:1.55;color:${C.text};font-weight:500;padding-top:8px;">${esc(truncate(it, 380))}</span>
          </li>
        `).join("")}
      </ol>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Hallazgos" });
}

function slideRecommendations(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const items = report.recommendations.slice(0, 5);
  const body = `
    <div style="position:absolute;inset:0;padding:160px 120px 130px;display:flex;flex-direction:column;gap:36px;">
      <div>
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.orange};font-weight:800;text-transform:uppercase;margin-bottom:14px;">Sección · Recomendaciones</div>
        <h2 style="font-size:64px;font-weight:800;line-height:1;margin:0;letter-spacing:-0.03em;color:${C.text};">Próximos pasos</h2>
      </div>
      <ol style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;flex:1;">
        ${items.map((it, i) => `
          <li style="display:flex;gap:32px;align-items:flex-start;background:#FFFFFF;border:1px solid ${C.border};border-left:6px solid ${C.orange};border-radius:14px;padding:26px 32px;">
            <span style="flex-shrink:0;font-size:64px;font-weight:800;color:${C.orange};line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.04em;min-width:80px;">${String(i + 1).padStart(2, "0")}</span>
            <span style="flex:1;font-size:22px;line-height:1.55;color:${C.text};font-weight:500;padding-top:8px;">${esc(truncate(it, 380))}</span>
          </li>
        `).join("")}
      </ol>
    </div>
  `;
  return slideShell({ bg: "light", pageNumber: page, total, clientName, modeLabel, body, sectionLabel: "Recomendaciones" });
}

function slideClosing(report: PerformanceReportContent, clientName: string, modeLabel: string, page: number, total: number): string {
  const body = `
    <div style="position:absolute;inset:0;padding:140px 120px;display:flex;flex-direction:column;justify-content:center;gap:48px;">
      <div style="position:absolute;bottom:-200px;right:-200px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle, ${C.violetGlow} 0%, transparent 70%);opacity:0.35;pointer-events:none;"></div>
      <div style="position:absolute;top:80px;right:80px;transform:scale(1.4);opacity:0.7;pointer-events:none;">${sparkles(C.orange, 0.85)}</div>

      <div style="position:relative;z-index:5;max-width:1400px;">
        <div style="font-size:14px;letter-spacing:0.3em;color:${C.orange};font-weight:800;text-transform:uppercase;margin-bottom:24px;">Conclusión</div>
        <h2 style="font-size:84px;font-weight:800;line-height:1.05;margin:0 0 32px 0;letter-spacing:-0.035em;color:#fff;">${esc(report.conclusion ? truncate(report.conclusion.split(/[.!?]/)[0] + ".", 180) : "El período cierra con señales claras para la próxima ventana de acción.")}</h2>
        ${report.conclusion ? `<p style="font-size:24px;line-height:1.55;color:rgba(255,255,255,0.75);margin:0;max-width:1100px;">${esc(truncate(report.conclusion, 600))}</p>` : ""}
      </div>

      <div style="position:relative;z-index:5;display:flex;align-items:center;gap:20px;border-top:1px solid rgba(255,255,255,0.15);padding-top:32px;margin-top:32px;">
        <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:40px;filter:brightness(0) invert(1);"/>
        <span style="font-size:14px;letter-spacing:0.3em;color:rgba(255,255,255,0.55);font-weight:700;text-transform:uppercase;">Performance Intelligence · ${esc(clientName)}</span>
      </div>
    </div>
  `;
  return slideShell({ bg: "dark", pageNumber: page, total, clientName, modeLabel, body, showHeader: false });
}

export function buildPerformanceSlidesReport(
  report: PerformanceReportContent,
  clientName: string,
  dateRange: DateRange,
): { slides: string[]; fullHtml: string; count: number } {
  const isBrand = report.reportMode === "brand";
  const modeLabel = isBrand ? "Marca" : "Benchmark";

  // Determine total slides up front
  const hasSov = !isBrand && report.analytics.shareOfVoice.length > 0;
  const hasTopPosts = report.topPosts.length > 0;
  const hasRecs = report.recommendations.length > 0;

  const slides: string[] = [];
  const total =
    1 + // cover
    1 + // exec summary
    1 + // kpis
    1 + // ranking
    (hasSov ? 1 : 0) +
    (hasTopPosts ? 1 : 0) +
    1 + // findings
    (hasRecs ? 1 : 0) +
    1; // closing

  let p = 1;
  slides.push(slideCover(report, clientName, dateRange, total));
  p++;
  slides.push(slideExecutiveSummary(report, clientName, modeLabel, p++, total));
  slides.push(slideKpis(report, clientName, modeLabel, p++, total));
  slides.push(slideRanking(report, clientName, modeLabel, p++, total));
  if (hasSov) slides.push(slideShareOfVoice(report, clientName, modeLabel, p++, total));
  if (hasTopPosts) slides.push(slideTopContent(report, clientName, modeLabel, p++, total));
  slides.push(slideFindings(report, clientName, modeLabel, p++, total));
  if (hasRecs) slides.push(slideRecommendations(report, clientName, modeLabel, p++, total));
  slides.push(slideClosing(report, clientName, modeLabel, p++, total));

  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(report.title || clientName)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: 1920px 1080px; margin: 0; }
  .slide { display: block; }
</style>
</head>
<body>
${slides.join("\n")}
</body>
</html>`;

  return { slides, fullHtml, count: slides.length };
}
