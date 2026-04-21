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
  paper: "#FFFFFF",
  paperAlt: "#F8F7FC",
  border: "#E5E3EE",
  borderLight: "#F1F0F8",
  // Editorial indigo palette (paridad con PerformanceReportView)
  indigoDeep: "#1e1b4b",
  indigoMid: "#312e81",
  indigoBright: "#4338ca",
  indigoSoft: "#EEF2FF",
  indigoText: "#c7d2fe",
  violet: "#4338ca", // alias usado por gráficos/badges
  violetSoft: "#EEF2FF",
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
    twitter: "X (Twitter)",
    x: "X (Twitter)",
    youtube: "YouTube",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
  };
  return m[n.toLowerCase()] || n;
}

function chartHorizontalBars(
  data: { label: string; value: number; isOwn?: boolean; sub?: string }[],
  unit = "%",
): string {
  if (!data.length) return "";
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);
  return `<div style="display:flex;flex-direction:column;gap:6px;">${data
    .map((d) => {
      const w = (Math.abs(d.value) / max) * 100;
      const color = d.isOwn ? C.violet : C.textMuted;
      return `<div style="display:flex;align-items:center;gap:8px;font-size:9px;">
      <span style="min-width:130px;color:${C.textMid};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.label)}${d.sub ? ` <span style="color:${C.textMuted};">· ${esc(d.sub)}</span>` : ""}</span>
      <div style="flex:1;background:${C.borderLight};border-radius:3px;height:12px;overflow:hidden;">
        <div style="width:${w}%;background:${color};height:100%;border-radius:3px;min-width:2px;"></div>
      </div>
      <span style="min-width:46px;text-align:right;font-weight:700;color:${C.text};">${d.value.toFixed(1)}${unit}</span>
    </div>`;
    })
    .join("")}</div>`;
}

function section(title: string, body: string, opts?: { eyebrow?: string; accent?: "indigo" | "orange" }): string {
  const accent = opts?.accent ?? "indigo";
  const accentColor = accent === "orange" ? C.orange : C.indigoBright;
  return `<div style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};background:${C.paper};margin-bottom:14px;break-inside:avoid;page-break-inside:avoid;border-left:4px solid ${accentColor};">
    <div style="padding:12px 18px 4px 18px;">
      <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.22em;color:${accentColor};">${esc(opts?.eyebrow ?? "Sección")}</div>
      <div style="font-size:13px;font-weight:800;color:${C.text};margin-top:3px;letter-spacing:-0.01em;">${esc(title)}</div>
    </div>
    <div style="padding:10px 18px 16px 18px;">${body}</div>
  </div>`;
}

function metricCard(label: string, value: string, sub?: string): string {
  return `<div style="background:${C.paperAlt};border:1px solid ${C.border};border-radius:6px;padding:10px 12px;flex:1;min-width:0;">
    <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.8px;color:${C.textMuted};font-weight:600;">${esc(label)}</div>
    <div style="font-size:18px;font-weight:800;color:${C.violet};margin-top:2px;">${esc(value)}</div>
    ${sub ? `<div style="font-size:8.5px;color:${C.textMid};margin-top:1px;">${esc(sub)}</div>` : ""}
  </div>`;
}

function highlightCard(label: string, value: string, context: string): string {
  return `<div style="background:linear-gradient(135deg, ${C.violetSoft} 0%, ${C.paper} 100%);border:1px solid ${C.border};border-radius:6px;padding:10px 12px;flex:1;min-width:0;">
    <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.8px;color:${C.textMid};font-weight:600;">${esc(label)}</div>
    <div style="font-size:17px;font-weight:800;color:${C.violet};margin:2px 0;">${esc(value)}</div>
    <div style="font-size:9px;color:${C.textMid};line-height:1.4;">${esc(context)}</div>
  </div>`;
}

function profilesTable(report: PerformanceReportContent, isBrand: boolean): string {
  const rows = report.profiles
    .map((p) => {
      const growth = p.growthPercent;
      const growthColor = growth == null ? C.textMuted : growth > 0 ? C.positive : growth < 0 ? C.negative : C.textMid;
      const growthStr = growth == null ? "—" : `${growth > 0 ? "+" : ""}${growth.toFixed(2)}%`;
      return `<tr style="border-bottom:1px solid ${C.borderLight};">
        <td style="padding:6px 8px;font-weight:600;font-size:9.5px;color:${C.text};">${esc(p.name)}</td>
        <td style="padding:6px 8px;font-size:9px;color:${C.textMid};">${esc(networkLabel(p.network))}</td>
        ${!isBrand ? `<td style="padding:6px 8px;font-size:8.5px;"><span style="display:inline-block;padding:2px 6px;border-radius:10px;background:${p.isCompetitor ? C.borderLight : C.violetSoft};color:${p.isCompetitor ? C.textMid : C.violet};font-weight:600;">${p.isCompetitor ? "Competencia" : "Marca"}</span></td>` : ""}
        <td style="padding:6px 8px;text-align:right;font-size:9px;font-variant-numeric:tabular-nums;">${p.followers != null ? fmtNum(p.followers) : "—"}</td>
        <td style="padding:6px 8px;text-align:right;font-size:9px;font-weight:600;color:${growthColor};font-variant-numeric:tabular-nums;">${growthStr}</td>
        <td style="padding:6px 8px;text-align:right;font-size:9px;font-weight:700;color:${C.text};font-variant-numeric:tabular-nums;">${p.engagementRate != null ? `${p.engagementRate.toFixed(2)}%` : "—"}</td>
        <td style="padding:6px 8px;text-align:right;font-size:9px;color:${C.textMid};font-variant-numeric:tabular-nums;">${p.postsPerDay != null ? p.postsPerDay.toFixed(2) : "—"}</td>
      </tr>`;
    })
    .join("");

  return `<table style="width:100%;border-collapse:collapse;background:${C.paper};">
    <thead>
      <tr style="background:${C.paperAlt};border-bottom:2px solid ${C.border};">
        <th style="padding:7px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Perfil</th>
        <th style="padding:7px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Red</th>
        ${!isBrand ? `<th style="padding:7px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Tipo</th>` : ""}
        <th style="padding:7px 8px;text-align:right;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Seguidores</th>
        <th style="padding:7px 8px;text-align:right;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Crecimiento</th>
        <th style="padding:7px 8px;text-align:right;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Engagement</th>
        <th style="padding:7px 8px;text-align:right;font-size:8px;text-transform:uppercase;letter-spacing:0.6px;color:${C.textMuted};font-weight:700;">Posts/día</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function topPostsList(report: PerformanceReportContent): string {
  if (!report.topPosts.length) return "";
  return `<div style="display:flex;flex-direction:column;gap:8px;">${report.topPosts
    .slice(0, 5)
    .map((p, i) => {
      const stats: string[] = [];
      stats.push(`<strong>${fmtNum(p.engagement)}</strong> engagement`);
      stats.push(`${fmtNum(p.likes)} likes`);
      stats.push(`${fmtNum(p.comments)} comentarios`);
      if (p.shares > 0) stats.push(`${fmtNum(p.shares)} compartidos`);
      if (p.views > 0) stats.push(`${fmtNum(p.views)} vistas`);
      return `<div style="border:1px solid ${C.border};border-radius:6px;padding:10px 12px;background:${C.paper};break-inside:avoid;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:6px;font-size:9px;color:${C.textMid};margin-bottom:4px;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${C.violet};color:#fff;font-weight:700;font-size:8.5px;">${i + 1}</span>
          <strong style="color:${C.text};">${esc(p.authorName)}</strong>
          <span>·</span>
          <span>${esc(networkLabel(p.network))}</span>
          <span>·</span>
          <span>${esc(p.postDate)}</span>
        </div>
        ${p.postContent ? `<div style="font-size:9.5px;line-height:1.5;color:${C.textMid};margin-bottom:4px;">${esc(p.postContent.slice(0, 240))}${p.postContent.length > 240 ? "…" : ""}</div>` : ""}
        <div style="font-size:9px;color:${C.textMid};">${stats.join(" · ")}</div>
      </div>`;
    })
    .join("")}</div>`;
}

function numberedList(items: string[], accent: "indigo" | "orange" = "indigo"): string {
  if (!items.length) return `<div style="font-size:9.5px;color:${C.textMuted};font-style:italic;">Sin elementos.</div>`;
  const accentColor = accent === "orange" ? C.orange : C.indigoBright;
  return `<ol style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:12px;">${items
    .map(
      (it, i) => `<li style="display:flex;gap:14px;align-items:flex-start;break-inside:avoid;page-break-inside:avoid;border-bottom:1px solid ${C.borderLight};padding-bottom:10px;">
        <span style="flex-shrink:0;font-size:22px;font-weight:800;color:${accentColor};line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;min-width:28px;">${String(i + 1).padStart(2, "0")}</span>
        <span style="flex:1;font-size:10.5px;line-height:1.65;color:${C.text};">${esc(it)}</span>
      </li>`,
    )
    .join("")}</ol>`;
}

export function buildPerformanceReportHTML(
  report: PerformanceReportContent,
  clientName: string,
  dateRange: DateRange,
): { html: string; header: string; footer: string } {
  const isBrand = report.reportMode === "brand";
  const generatedDate = format(new Date(), "d 'de' MMMM yyyy", { locale: es });
  const modeLabel = isBrand ? "Reporte de Marca" : "Reporte de Benchmark";
  const periodPretty = (() => {
    try {
      return `${format(new Date(dateRange.start), "d MMM", { locale: es })} — ${format(new Date(dateRange.end), "d MMM yyyy", { locale: es })}`;
    } catch {
      return dateRange.label;
    }
  })();

  // ---------- Cover page ----------
  const cover = `<section style="page-break-after:always;break-after:page;background:${INDIGO_GRADIENT};color:#fff;min-height:1040px;padding:60px 56px 56px 56px;position:relative;overflow:hidden;font-family:'Inter','Segoe UI',sans-serif;">
    <div style="position:absolute;bottom:-200px;left:-200px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, ${C.indigoBright} 0%, transparent 70%);opacity:0.55;"></div>
    <div style="position:absolute;top:-140px;right:-140px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle, ${C.orange} 0%, transparent 70%);opacity:0.22;"></div>

    <div style="position:relative;z-index:5;display:flex;align-items:center;justify-content:space-between;">
      <img src="${WIZR_LOGO_COLOR_B64}" alt="Wizr" style="height:42px;filter:brightness(0) invert(1);"/>
      <div style="font-size:9px;letter-spacing:0.32em;color:${C.indigoText};font-weight:700;text-transform:uppercase;">Confidencial</div>
    </div>

    <div style="position:relative;z-index:5;margin-top:140px;">
      <div style="display:inline-flex;align-items:center;gap:10px;padding:7px 16px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-radius:100px;margin-bottom:32px;">
        <span style="width:6px;height:6px;border-radius:50%;background:${C.orange};"></span>
        <span style="font-size:9px;letter-spacing:0.28em;color:#fff;font-weight:700;text-transform:uppercase;">Wizr · Performance · ${esc(modeLabel)}</span>
      </div>

      <h1 style="font-size:62px;font-weight:800;line-height:1;margin:0 0 16px 0;letter-spacing:-0.025em;">${esc(report.title || clientName)}</h1>

      <div style="display:flex;align-items:center;gap:14px;margin-top:24px;">
        <span style="width:48px;height:2px;background:${C.orange};"></span>
        <span style="font-size:11px;letter-spacing:0.3em;color:${C.indigoText};font-weight:700;text-transform:uppercase;">Cliente</span>
        <span style="font-size:18px;color:#fff;font-weight:600;">${esc(clientName)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:10px;">
        <span style="width:48px;height:2px;background:${C.orange};"></span>
        <span style="font-size:11px;letter-spacing:0.3em;color:${C.indigoText};font-weight:700;text-transform:uppercase;">Período</span>
        <span style="font-size:18px;color:#fff;font-weight:600;">${esc(periodPretty)}</span>
      </div>

      ${report.summary ? `<p style="font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);font-weight:400;max-width:680px;margin:48px 0 0 0;">${esc(report.summary)}</p>` : ""}
    </div>

    <div style="position:absolute;bottom:48px;left:56px;right:56px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:18px;z-index:5;">
      <div style="font-size:9px;letter-spacing:0.3em;color:${C.indigoText};font-weight:700;text-transform:uppercase;">Wizr · Performance Intelligence</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.78);">${esc(generatedDate)}</div>
    </div>
  </section>`;

  // ---------- Highlights ----------
  const highlightsBlock = report.highlights.length
    ? section(
        "Highlights del período",
        `<div style="display:flex;gap:8px;flex-wrap:wrap;">${report.highlights
          .slice(0, 4)
          .map((h) => highlightCard(h.label, h.value, h.context))
          .join("")}</div>`,
        { eyebrow: "Sección 01 · Highlights" },
      )
    : "";

  // ---------- KPIs row ----------
  const kpisBlock = section(
    "KPIs generales",
    `<div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${metricCard("Perfiles", String(report.profiles.length))}
      ${metricCard("Engagement Promedio", `${report.analytics.avgEngagement}%`)}
      ${metricCard("Crecimiento Promedio", `${report.analytics.avgGrowth}%`)}
      ${metricCard("Total Seguidores", fmtNum(report.analytics.totalFollowers))}
      ${report.analytics.bestPerformer ? metricCard("Top Engagement", `${report.analytics.bestPerformer.engagement.toFixed(2)}%`, report.analytics.bestPerformer.name) : ""}
      ${report.analytics.fastestGrower ? metricCard("Mayor Crecimiento", `${report.analytics.fastestGrower.growth > 0 ? "+" : ""}${report.analytics.fastestGrower.growth.toFixed(2)}%`, report.analytics.fastestGrower.name) : ""}
    </div>`,
    { eyebrow: "Sección 02 · KPIs" },
  );

  // ---------- Summary ----------
  const summaryBlock = report.summary
    ? section(
        "Resumen ejecutivo",
        `<p style="font-size:10.5px;line-height:1.7;color:${C.text};margin:0;">${esc(report.summary)}</p>`,
        { eyebrow: "Sección 03 · Síntesis" },
      )
    : "";

  // ---------- Brand-level engagement chart ----------
  const brandEngBlock = report.analytics.brandEngagement?.length
    ? section(
        "Engagement promedio por marca",
        chartHorizontalBars(
          report.analytics.brandEngagement.slice(0, 12).map((b) => ({
            label: b.brand,
            value: b.avgEngagement,
            isOwn: b.isOwn,
            sub: `${b.profiles} perfil(es)`,
          })),
        ),
        { eyebrow: "Sección 04 · Engagement por marca" },
      )
    : "";

  // ---------- Ranking chart (top 10 perfiles) ----------
  const rankingChart = report.analytics.rankingByEngagement.length
    ? section(
        "Top 10 perfiles por engagement",
        chartHorizontalBars(
          report.analytics.rankingByEngagement.slice(0, 10).map((r) => ({
            label: r.name,
            value: r.engagement,
            isOwn: r.isOwn,
            sub: networkLabel(r.network),
          })),
        ) + (report.rankingInsight ? `<div style="margin-top:10px;padding:10px 12px;background:${C.indigoSoft};border-left:3px solid ${C.indigoBright};border-radius:0 4px 4px 0;font-size:9.5px;line-height:1.6;color:${C.text};">${esc(report.rankingInsight)}</div>` : ""),
        { eyebrow: "Sección 05 · Ranking de perfiles" },
      )
    : "";

  // ---------- Share of voice (benchmark) por marca ----------
  const sovBlock = !isBrand && report.analytics.brandEngagement?.length
    ? (() => {
        const total = report.analytics.brandEngagement.reduce((s, b) => s + b.avgEngagement, 0) || 1;
        const data = report.analytics.brandEngagement
          .filter((b) => b.avgEngagement > 0)
          .map((b) => ({
            label: b.brand,
            value: Math.round((b.avgEngagement / total) * 1000) / 10,
            isOwn: b.isOwn,
          }));
        return section(
          "Share of voice por marca",
          chartHorizontalBars(data) + (report.sovInsight ? `<div style="margin-top:10px;padding:10px 12px;background:${C.indigoSoft};border-left:3px solid ${C.indigoBright};border-radius:0 4px 4px 0;font-size:9.5px;line-height:1.6;color:${C.text};">${esc(report.sovInsight)}</div>` : ""),
          { eyebrow: "Sección 06 · Participación" },
        );
      })()
    : "";

  // ---------- Top 10 perfiles table ----------
  const top10ProfilesReport = {
    ...report,
    profiles: [...report.profiles].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0)).slice(0, 10),
  };
  const profilesBlock = section(
    isBrand ? "Top 10 perfiles" : "Top 10 perfiles · marca vs competencia",
    profilesTable(top10ProfilesReport, isBrand) + (report.profilesInsight ? `<div style="margin-top:10px;padding:10px 12px;background:${C.indigoSoft};border-left:3px solid ${C.indigoBright};border-radius:0 4px 4px 0;font-size:9.5px;line-height:1.6;color:${C.text};">${esc(report.profilesInsight)}</div>` : ""),
    { eyebrow: "Sección 07 · Detalle" },
  );

  // ---------- Top content ----------
  const topContentBlock = report.topPosts.length
    ? section(
        "Mejores contenidos del período",
        `${topPostsList(report)}${report.topContentInsight ? `<div style="margin-top:12px;padding:12px 14px;background:${C.indigoSoft};border-left:3px solid ${C.indigoBright};border-radius:0 4px 4px 0;font-size:10px;line-height:1.6;color:${C.text};">${esc(report.topContentInsight)}</div>` : ""}`,
        { eyebrow: "Sección 07 · Top contenidos" },
      )
    : "";

  // ---------- Findings ----------
  const findingsBlock = section(
    "Hallazgos clave",
    numberedList(report.keyFindings, "indigo"),
    { eyebrow: "Sección 08 · Lectura crítica" },
  );

  // ---------- Competitive insight (benchmark) ----------
  const competitiveBlock = !isBrand && report.competitiveInsight
    ? section(
        "Posicionamiento competitivo",
        `<p style="font-size:10.5px;line-height:1.7;color:${C.text};margin:0;white-space:pre-line;">${esc(report.competitiveInsight)}</p>`,
        { eyebrow: "Sección 09 · Posicionamiento" },
      )
    : "";

  // ---------- Recommendations ----------
  const recommendationsBlock = section(
    "Recomendaciones",
    numberedList(report.recommendations, "orange"),
    { eyebrow: "Sección 10 · Próximos pasos", accent: "orange" },
  );

  // ---------- Conclusion (editorial closing band) ----------
  const conclusionBlock = report.conclusion
    ? `<div style="background:${INDIGO_GRADIENT};color:#fff;border-radius:10px;padding:22px 24px;margin-bottom:14px;break-inside:avoid;page-break-inside:avoid;">
        <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.28em;color:${C.indigoText};">Cierre ejecutivo</div>
        <div style="font-size:14px;font-weight:800;color:#fff;margin:4px 0 10px 0;letter-spacing:-0.01em;">Conclusión</div>
        <div style="height:1px;background:rgba(255,255,255,0.18);margin-bottom:12px;"></div>
        <p style="font-size:11px;line-height:1.75;color:rgba(255,255,255,0.92);margin:0;white-space:pre-line;">${esc(report.conclusion)}</p>
      </div>`
    : "";

  const body = `<div style="background:${C.paper};font-family:'Inter','Segoe UI',sans-serif;color:${C.text};padding:18px 16px;">
    ${highlightsBlock}
    ${kpisBlock}
    ${summaryBlock}
    ${brandEngBlock}
    ${rankingChart}
    ${sovBlock}
    ${profilesBlock}
    ${topContentBlock}
    ${findingsBlock}
    ${competitiveBlock}
    ${recommendationsBlock}
    ${conclusionBlock}
  </div>`;

  const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${esc(report.title || clientName)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: ${C.paper}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @page { size: A4; margin: 14mm 12mm 18mm 12mm; }
  ol, ul { margin: 0; padding: 0; }
</style>
</head>
<body>
${cover}
${body}
</body>
</html>`;

  const header = `<div style="font-family:'Inter',sans-serif;font-size:8px;color:${C.textMuted};padding:6px 12mm 0 12mm;display:flex;justify-content:space-between;width:100%;">
    <span style="font-weight:700;text-transform:uppercase;letter-spacing:0.15em;">${esc(clientName)} · ${esc(modeLabel)}</span>
    <span>${esc(periodPretty)}</span>
  </div>`;

  const footer = `<div style="font-family:'Inter',sans-serif;font-size:8px;color:${C.textMuted};padding:0 12mm 6px 12mm;display:flex;justify-content:space-between;width:100%;">
    <span>Wizr · Performance Intelligence</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;

  return { html: fullHtml, header, footer };
}
