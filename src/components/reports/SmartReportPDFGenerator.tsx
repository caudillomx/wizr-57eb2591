import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SmartReportContent, InfluencerInfo, SourceBreakdown, TimelinePoint } from "@/hooks/useSmartReport";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
}

// Brand palette
const V = [90, 47, 186] as const;       // Wizr Violet
const VL = [237, 231, 252] as const;    // Violet Light
const VD = [60, 30, 140] as const;      // Violet Dark
const O = [255, 107, 53] as const;      // Orange
const D = [17, 24, 39] as const;        // Dark text
const G = [107, 114, 128] as const;     // Gray text
const GR = [16, 185, 129] as const;     // Green
const RD = [239, 68, 68] as const;      // Red
const AM = [245, 158, 11] as const;     // Amber
const W = [255, 255, 255] as const;     // White
const BG = [248, 250, 252] as const;    // Light bg
const BGWARM = [254, 252, 247] as const;

type C3 = readonly [number, number, number];

export function SmartReportPDFGenerator({
  report, projectName, dateRange, selectedTemplate, editedTemplate,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const m = 16; // margin
      const cw = pw - m * 2; // content width
      let y = 0;

      // Format dates nicely
      const startFormatted = safeFormatDate(dateRange.start);
      const endFormatted = safeFormatDate(dateRange.end);
      const periodLabel = `${startFormatted} - ${endFormatted}`;

      const needPage = (n: number = 20) => {
        if (y + n > ph - 20) { doc.addPage(); y = 18; addPageHeader(doc, pw, m, projectName); }
      };

      // ══════════════════════════════════════
      //  PAGE 1 — COVER
      // ══════════════════════════════════════

      // Full violet header block
      doc.setFillColor(...V);
      doc.rect(0, 0, pw, 58, "F");

      // Decorative circles (subtle)
      doc.setGState(doc.GState({ opacity: 0.06 }));
      doc.setFillColor(...W);
      doc.circle(pw - 15, 10, 45, "F");
      doc.circle(pw + 5, 45, 30, "F");
      doc.setGState(doc.GState({ opacity: 1 }));

      // Brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...W);
      doc.text("WIZR", m, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Inteligencia Estrategica", m + 18, 12);

      // Thin separator line
      doc.setDrawColor(255, 255, 255);
      doc.setGState(doc.GState({ opacity: 0.3 }));
      doc.setLineWidth(0.3);
      doc.line(m, 17, pw - m, 17);
      doc.setGState(doc.GState({ opacity: 1 }));

      // Title — handle long titles gracefully
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(...W);
      const titleLines = doc.splitTextToSize(report.title, cw - 10);
      const maxTitleLines = Math.min(titleLines.length, 3);
      for (let i = 0; i < maxTitleLines; i++) {
        doc.text(titleLines[i], m, 28 + i * 7);
      }

      // Period + generated date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(220, 210, 255);
      doc.text(periodLabel, m, 52);
      doc.text(
        `Generado: ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        pw - m, 52, { align: "right" }
      );

      y = 66;

      // ── Metrics dashboard row ──
      const total = report.metrics.totalMentions || 1;
      const posPct = Math.round(report.metrics.positiveCount / total * 100);
      const neuPct = Math.round(report.metrics.neutralCount / total * 100);
      const negPct = Math.round(report.metrics.negativeCount / total * 100);

      const mBoxW = (cw - 9) / 4;
      const mData: { label: string; val: string; sub: string; bg: C3; fg: C3 }[] = [
        { label: "Menciones", val: report.metrics.totalMentions.toString(), sub: "Total detectadas", bg: V, fg: W },
        { label: "Positivas", val: report.metrics.positiveCount.toString(), sub: `${posPct}% del total`, bg: [220, 252, 231], fg: [21, 128, 61] },
        { label: "Neutrales", val: report.metrics.neutralCount.toString(), sub: `${neuPct}% del total`, bg: [254, 243, 199], fg: [146, 64, 14] },
        { label: "Negativas", val: report.metrics.negativeCount.toString(), sub: `${negPct}% del total`, bg: [254, 226, 226], fg: [185, 28, 28] },
      ];

      mData.forEach((md, i) => {
        const x = m + i * (mBoxW + 3);
        doc.setFillColor(...md.bg);
        doc.roundedRect(x, y, mBoxW, 24, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(...md.fg);
        doc.text(md.val, x + mBoxW / 2, y + 12, { align: "center" });
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(md.label, x + mBoxW / 2, y + 17.5, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.text(md.sub, x + mBoxW / 2, y + 21.5, { align: "center" });
      });
      y += 30;

      // ── Sentiment bar ──
      const barH = 5;
      const posW = Math.max((report.metrics.positiveCount / total) * cw, 1);
      const neuW = Math.max((report.metrics.neutralCount / total) * cw, 1);
      const negW = Math.max((report.metrics.negativeCount / total) * cw, 1);

      doc.setFillColor(...GR);
      doc.roundedRect(m, y, posW, barH, 1.5, 1.5, "F");
      doc.setFillColor(...AM);
      doc.rect(m + posW, y, neuW, barH, "F");
      doc.setFillColor(...RD);
      doc.roundedRect(m + posW + neuW, y, negW, barH, 1.5, 1.5, "F");
      y += barH + 2;

      // Legend
      doc.setFontSize(6.5);
      ([
        { c: GR as C3, l: `Positivo ${posPct}%`, x: m },
        { c: AM as C3, l: `Neutral ${neuPct}%`, x: m + cw / 2 - 12 },
        { c: RD as C3, l: `Negativo ${negPct}%`, x: m + cw - 28 },
      ] as const).forEach(({ c, l, x }) => {
        doc.setFillColor(c[0], c[1], c[2]);
        doc.circle(x + 1.5, y + 1.2, 1.5, "F");
        doc.setTextColor(...G);
        doc.text(l, x + 5, y + 2.2);
      });
      y += 8;

      // ── Resumen Ejecutivo ──
      sectionTitle(doc, "Resumen Ejecutivo", m, y, cw, V);
      y += 14;
      y = drawParagraph(doc, report.summary, m, y, cw, ph, projectName, 10);
      y += 4;

      // ── Analisis de Sentimiento ──
      if (report.sentimentAnalysis) {
        needPage(40);
        sectionTitle(doc, "Analisis de Sentimiento", m, y, cw, V);
        y += 14;
        y = drawParagraph(doc, report.sentimentAnalysis, m, y, cw, ph, projectName, 9.5);
        y += 4;
      }

      // ── Evaluacion de Impacto (highlight box) ──
      if (report.impactAssessment) {
        needPage(35);
        sectionTitle(doc, "Evaluacion de Impacto", m, y, cw, V);
        y += 14;
        y = drawHighlightBox(doc, report.impactAssessment, m, y, cw, ph, VL, V, projectName);
        y += 6;
      }

      // ══════════════════════════════════════
      //  TIMELINE CHART (if data exists)
      // ══════════════════════════════════════
      if (report.timeline.length > 1) {
        needPage(60);
        sectionTitle(doc, "Evolucion Temporal", m, y, cw, V);
        y += 14;
        y = drawTimelineChart(doc, report.timeline, m, y, cw, 40, ph, projectName);
        y += 6;
      }

      // ══════════════════════════════════════
      //  HALLAZGOS CLAVE
      // ══════════════════════════════════════
      needPage(30);
      sectionTitle(doc, "Hallazgos Clave", m, y, cw, V);
      y += 14;
      report.keyFindings.forEach((f, i) => {
        y = drawNumberedItem(doc, f, i + 1, m, y, cw, ph, V, projectName);
      });
      y += 4;

      // ══════════════════════════════════════
      //  INFLUENCIADORES TABLE
      // ══════════════════════════════════════
      if (report.influencers.length > 0) {
        needPage(40);
        sectionTitle(doc, "Influenciadores de la Conversacion", m, y, cw, V);
        y += 14;

        autoTable(doc, {
          startY: y,
          head: [["#", "Perfil", "Usuario", "Red", "Menciones", "Sentimiento", "Interacciones"]],
          body: report.influencers.map((inf: InfluencerInfo, i: number) => [
            `${i + 1}`,
            inf.name,
            inf.username ? `@${inf.username}` : "-",
            normalizePlatform(inf.platform),
            `${inf.mentions}`,
            sentimentLabel(inf.sentiment),
            inf.reach,
          ]),
          theme: "striped",
          headStyles: {
            fillColor: [...V],
            textColor: [...W],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
            cellPadding: 2.5,
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [...D],
            cellPadding: 2,
          },
          alternateRowStyles: { fillColor: [...VL] },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { cellWidth: 35 },
            2: { cellWidth: 28, fontSize: 7, textColor: [...G] },
            3: { halign: "center", cellWidth: 22 },
            4: { halign: "center", cellWidth: 16 },
            5: { halign: "center", cellWidth: 20 },
            6: { halign: "right", cellWidth: "auto" },
          },
          margin: { left: m, right: m },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 5) {
              const val = data.cell.raw as string;
              if (val === "Negativo") data.cell.styles.textColor = [...RD];
              else if (val === "Positivo") data.cell.styles.textColor = [...GR];
              else data.cell.styles.textColor = [...AM];
            }
          },
        });
        y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
      }

      // ══════════════════════════════════════
      //  DISTRIBUCION POR FUENTES
      // ══════════════════════════════════════
      if (report.sourceBreakdown.length > 0) {
        needPage(35);
        sectionTitle(doc, "Distribucion por Medios y Plataformas", m, y, cw, V);
        y += 14;

        // Mini horizontal bar chart + table hybrid
        const sources = report.sourceBreakdown.slice(0, 10);
        const maxCount = Math.max(...sources.map(s => s.count), 1);

        autoTable(doc, {
          startY: y,
          head: [["Fuente", "Total", "Pos", "Neu", "Neg", "% Neg"]],
          body: sources.map((s: SourceBreakdown) => [
            normalizePlatform(s.source),
            `${s.count}`,
            `${s.positive}`,
            `${s.neutral}`,
            `${s.negative}`,
            `${Math.round(s.negative / (s.count || 1) * 100)}%`,
          ]),
          theme: "striped",
          headStyles: {
            fillColor: [...VD],
            textColor: [...W],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
            cellPadding: 2.5,
          },
          bodyStyles: { fontSize: 7.5, textColor: [...D], cellPadding: 2 },
          alternateRowStyles: { fillColor: [...BG] },
          columnStyles: {
            0: { cellWidth: 42, fontStyle: "bold" },
            1: { halign: "center", cellWidth: 16 },
            2: { halign: "center", cellWidth: 16 },
            3: { halign: "center", cellWidth: 16 },
            4: { halign: "center", cellWidth: 16 },
            5: { halign: "center", cellWidth: 18 },
          },
          margin: { left: m, right: m },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 5) {
              const pct = parseInt(data.cell.raw as string);
              if (pct >= 70) data.cell.styles.textColor = [...RD];
              else if (pct >= 40) data.cell.styles.textColor = [...AM];
            }
          },
        });
        y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
      }

      // ══════════════════════════════════════
      //  RECOMENDACIONES
      // ══════════════════════════════════════
      needPage(30);
      sectionTitle(doc, "Recomendaciones Estrategicas", m, y, cw, O);
      y += 14;
      report.recommendations.forEach((rec, i) => {
        y = drawNumberedItem(doc, rec, i + 1, m, y, cw, ph, O, projectName);
      });
      y += 4;

      // ══════════════════════════════════════
      //  MENSAJE / TEMPLATE
      // ══════════════════════════════════════
      needPage(35);
      const tLabels: Record<string, string> = {
        executive: "Mensaje Ejecutivo",
        technical: "Mensaje Tecnico",
        public: "Mensaje WhatsApp",
      };
      sectionTitle(doc, tLabels[selectedTemplate] || "Mensaje", m, y, cw, V);
      y += 14;
      y = drawHighlightBox(doc, editedTemplate, m, y, cw, ph, BGWARM, AM, projectName);

      // ══════════════════════════════════════
      //  FOOTERS ON ALL PAGES
      // ══════════════════════════════════════
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFillColor(...V);
        doc.rect(0, ph - 10, pw, 10, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(220, 210, 255);
        doc.text(`${projectName}  ·  ${periodLabel}  ·  Generado con Wizr`, m, ph - 4);
        doc.text(`${i} / ${pages}`, pw - m, ph - 4, { align: "right" });
      }

      const fileName = `reporte_inteligente_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
      {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      PDF
    </Button>
  );
}

// ═══════════════════════════════════════
//  HELPER FUNCTIONS
// ═══════════════════════════════════════

function safeFormatDate(isoStr: string): string {
  try {
    return format(new Date(isoStr), "d MMM yyyy", { locale: es });
  } catch {
    return isoStr.split("T")[0];
  }
}

function addPageHeader(doc: jsPDF, pw: number, m: number, projectName: string) {
  doc.setFillColor(...V);
  doc.rect(0, 0, pw, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...W);
  doc.text("WIZR", m, 7.5);
  doc.setFont("helvetica", "normal");
  doc.text(projectName, pw - m, 7.5, { align: "right" });
}

function sectionTitle(doc: jsPDF, title: string, x: number, y: number, cw: number, accent: C3) {
  // Background bar
  doc.setFillColor(...BG);
  doc.roundedRect(x, y, cw, 10, 1.5, 1.5, "F");
  // Left accent
  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 3, 10, 1.5, 1.5, "F");
  doc.rect(x + 1.5, y, 1.5, 10, "F"); // fill the right side of rounded rect
  // Title text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...accent);
  doc.text(title, x + 8, y + 7);
}

function drawParagraph(
  doc: jsPDF, text: string, m: number, y: number, cw: number,
  ph: number, projectName: string, fontSize = 9.5
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...D);
  const lines = doc.splitTextToSize(text, cw - 4);
  const lineH = fontSize * 0.42;
  for (const line of lines) {
    if (y + lineH > ph - 20) {
      doc.addPage();
      y = 18;
      addPageHeader(doc, doc.internal.pageSize.getWidth(), m, projectName);
    }
    doc.text(line, m + 2, y);
    y += lineH;
  }
  return y + 2;
}

function drawHighlightBox(
  doc: jsPDF, text: string, m: number, y: number, cw: number,
  ph: number, bgColor: C3, accentColor: C3, projectName: string
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...D);
  const innerW = cw - 14;
  const lines = doc.splitTextToSize(text, innerW);
  const lineH = 4.2;
  const padding = 6;

  // We need to handle page breaks inside the box
  let boxStartY = y;
  let isFirstChunk = true;

  for (let i = 0; i < lines.length; i++) {
    const lineY = boxStartY + padding + (i - (isFirstChunk ? 0 : 0)) * lineH;
    
    if (lineY + lineH > ph - 20) {
      // Draw the box for current chunk
      const chunkH = lineY - boxStartY;
      doc.setFillColor(...bgColor);
      doc.roundedRect(m, boxStartY, cw, chunkH, 2, 2, "F");
      doc.setFillColor(...accentColor);
      doc.rect(m, boxStartY, 3, chunkH, "F");
      
      // Redraw text on this chunk
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...D);
      
      doc.addPage();
      y = 18;
      addPageHeader(doc, doc.internal.pageSize.getWidth(), m, projectName);
      boxStartY = y;
      isFirstChunk = false;
    }
  }

  // Draw final box
  const totalH = padding * 2 + lines.length * lineH;
  // Recalculate: draw box then text
  const boxH = Math.min(totalH, ph - boxStartY - 20);
  doc.setFillColor(...bgColor);
  doc.roundedRect(m, y, cw, boxH, 2, 2, "F");
  doc.setFillColor(...accentColor);
  doc.rect(m, y, 3, boxH, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...D);
  let ty = y + padding;
  for (const line of lines) {
    if (ty + lineH > ph - 20) {
      doc.addPage();
      ty = 24;
      addPageHeader(doc, doc.internal.pageSize.getWidth(), m, projectName);
    }
    doc.text(line, m + 8, ty);
    ty += lineH;
  }

  return ty + padding;
}

function drawNumberedItem(
  doc: jsPDF, text: string, num: number, m: number, y: number,
  cw: number, ph: number, color: C3, projectName: string
): number {
  if (y + 14 > ph - 20) {
    doc.addPage();
    y = 18;
    addPageHeader(doc, doc.internal.pageSize.getWidth(), m, projectName);
  }

  // Number circle
  doc.setFillColor(...color);
  doc.circle(m + 5, y + 1, 3.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...W);
  doc.text(`${num}`, m + 5, y + 2.5, { align: "center" });

  // Text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...D);
  const lines = doc.splitTextToSize(text, cw - 18);
  const lineH = 4.2;
  for (let i = 0; i < lines.length; i++) {
    const ly = y + i * lineH;
    if (ly + lineH > ph - 20) {
      doc.addPage();
      y = 18;
      addPageHeader(doc, doc.internal.pageSize.getWidth(), m, projectName);
    }
    doc.text(lines[i], m + 13, y + i * lineH + 2);
  }

  return y + lines.length * lineH + 5;
}

function drawTimelineChart(
  doc: jsPDF, timeline: TimelinePoint[], m: number, y: number,
  cw: number, chartH: number, ph: number, projectName: string
): number {
  if (y + chartH + 15 > ph - 20) {
    doc.addPage();
    y = 18;
    addPageHeader(doc, doc.internal.pageSize.getWidth(), m, projectName);
  }

  const data = timeline.slice(-14); // Last 14 days max
  if (data.length === 0) return y;

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barW = Math.min((cw - 20) / data.length - 1, 12);
  const chartX = m + 10;
  const barAreaW = data.length * (barW + 1);
  const startX = chartX + (cw - 20 - barAreaW) / 2;

  // Y axis label
  doc.setFontSize(6);
  doc.setTextColor(...G);
  doc.text(`${maxVal}`, m + 2, y + 2);
  doc.text("0", m + 4, y + chartH - 2);

  // Baseline
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.3);
  doc.line(m + 8, y + chartH, m + cw - 2, y + chartH);

  // Bars — stacked (negative = red, neutral = amber, positive = green)
  data.forEach((d, i) => {
    const x = startX + i * (barW + 1);
    const h = (d.count / maxVal) * (chartH - 8);
    
    // Proportional stacked bar
    const negH = d.count > 0 ? (d.negative / d.count) * h : 0;
    const posH = d.count > 0 ? (d.positive / d.count) * h : 0;
    const neuH = h - negH - posH;

    let bY = y + chartH - h;
    
    if (posH > 0) {
      doc.setFillColor(...GR);
      doc.rect(x, bY, barW, posH, "F");
      bY += posH;
    }
    if (neuH > 0) {
      doc.setFillColor(...AM);
      doc.rect(x, bY, barW, neuH, "F");
      bY += neuH;
    }
    if (negH > 0) {
      doc.setFillColor(...RD);
      doc.rect(x, bY, barW, negH, "F");
    }

    // Date label (abbreviated)
    doc.setFontSize(5.5);
    doc.setTextColor(...G);
    const label = d.date.slice(5); // MM-DD
    doc.text(label, x + barW / 2, y + chartH + 4, { align: "center" });
  });

  // Legend
  const legendY = y + chartH + 8;
  doc.setFontSize(6);
  ([
    { c: GR as C3, l: "Positivo" },
    { c: AM as C3, l: "Neutral" },
    { c: RD as C3, l: "Negativo" },
  ] as const).forEach(({ c, l }, i) => {
    const lx = m + 10 + i * 25;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(lx, legendY, 1.5, "F");
    doc.setTextColor(...G);
    doc.text(l, lx + 3, legendY + 1);
  });

  return legendY + 6;
}

function sentimentLabel(s: string): string {
  if (s === "negativo") return "Negativo";
  if (s === "positivo") return "Positivo";
  return "Mixto";
}

function normalizePlatform(domain: string): string {
  const map: Record<string, string> = {
    "twitter": "X/Twitter", "twitter.com": "X/Twitter", "x.com": "X/Twitter",
    "facebook": "Facebook", "facebook.com": "Facebook",
    "instagram": "Instagram", "instagram.com": "Instagram",
    "tiktok": "TikTok", "tiktok.com": "TikTok",
    "youtube": "YouTube", "youtube.com": "YouTube",
    "reddit": "Reddit", "reddit.com": "Reddit",
    "linkedin": "LinkedIn", "linkedin.com": "LinkedIn",
  };
  return map[domain] || domain.replace(/^www\./, "");
}
