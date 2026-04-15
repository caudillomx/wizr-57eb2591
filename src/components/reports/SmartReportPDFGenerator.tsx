import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SmartReportContent, InfluencerInfo, SourceBreakdown, TimelinePoint } from "@/hooks/useSmartReport";
import {
  PDF_COLORS, loadLogo, drawHeader, drawPageHeader, drawFooters,
  drawMetricsRow, drawSentimentBar, drawSectionTitle, drawParagraph,
  drawNumberedItem, needPage, formatBigNumber, normalizePlatform, sentimentLabel,
} from "@/lib/reports/pdfHelpers";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
}

function safeFormatDate(isoStr: string): string {
  try { return format(new Date(isoStr), "d MMM yyyy", { locale: es }); }
  catch { return isoStr.split("T")[0]; }
}

export function SmartReportPDFGenerator({
  report, projectName, dateRange, selectedTemplate, editedTemplate,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const logoBase64 = await loadLogo();
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const m = 16;
      const cw = pw - m * 2;

      const startFormatted = safeFormatDate(dateRange.start);
      const endFormatted = safeFormatDate(dateRange.end);
      const periodLabel = `${startFormatted} - ${endFormatted}`;
      const generatedDate = format(new Date(), "d MMM yyyy, HH:mm", { locale: es });

      // ── HEADER ──
      let y = drawHeader(doc, logoBase64, report.title, `${periodLabel}  ·  Generado: ${generatedDate}`, pw, m);

      // ── METRICS ROW ──
      const total = report.metrics.totalMentions || 1;
      const negPct = Math.round(report.metrics.negativeCount / total * 100);
      const posPct = Math.round(report.metrics.positiveCount / total * 100);

      y = drawMetricsRow(doc, [
        { value: report.metrics.totalMentions.toString(), label: "Total Menciones" },
        { value: formatBigNumber(report.metrics.estimatedReach || 0), label: "Alcance Estimado" },
        { value: `${negPct}%`, label: "% Negativo" },
        { value: `${posPct}%`, label: "% Positivo" },
      ], m, y, cw);

      // ── SENTIMENT BAR ──
      y = drawSentimentBar(doc, report.metrics.positiveCount, report.metrics.neutralCount, report.metrics.negativeCount, m, y, cw);
      y += 2;

      // ── RESUMEN EJECUTIVO ──
      y = drawSectionTitle(doc, "Resumen Ejecutivo", m, y, cw);
      y = drawParagraph(doc, report.summary, m, y, cw, ph, logoBase64, projectName);
      y += 2;

      // ── ANALISIS DE SENTIMIENTO ──
      if (report.sentimentAnalysis) {
        y = needPage(doc, y, 40, ph, logoBase64, projectName, m);
        y = drawSectionTitle(doc, "Analisis de Sentimiento", m, y, cw);
        y = drawParagraph(doc, report.sentimentAnalysis, m, y, cw, ph, logoBase64, projectName);
        y += 2;
      }

      // ── EVALUACION DE IMPACTO ──
      if (report.impactAssessment) {
        y = needPage(doc, y, 35, ph, logoBase64, projectName, m);
        y = drawSectionTitle(doc, "Evaluacion de Impacto", m, y, cw);
        y = drawParagraph(doc, report.impactAssessment, m, y, cw, ph, logoBase64, projectName);
        y += 2;
      }

      // ── TIMELINE CHART ──
      if (report.timeline.length > 1) {
        y = needPage(doc, y, 60, ph, logoBase64, projectName, m);
        y = drawSectionTitle(doc, "Evolucion Temporal", m, y, cw);
        y = drawTimelineChart(doc, report.timeline, m, y, cw, 40, ph, logoBase64, projectName);
        y += 4;
      }

      // ── HALLAZGOS CLAVE ──
      y = needPage(doc, y, 30, ph, logoBase64, projectName, m);
      y = drawSectionTitle(doc, "Hallazgos Clave", m, y, cw);
      report.keyFindings.forEach((f, i) => {
        y = drawNumberedItem(doc, f, i + 1, m, y, cw, ph, logoBase64, projectName);
      });
      y += 2;

      // ── INFLUENCIADORES TABLE ──
      if (report.influencers.length > 0) {
        y = needPage(doc, y, 40, ph, logoBase64, projectName, m);
        y = drawSectionTitle(doc, "Influenciadores de la Conversacion", m, y, cw);

        autoTable(doc, {
          startY: y,
          head: [["#", "Perfil", "Red", "Menciones", "Sentimiento", "Interacciones"]],
          body: report.influencers.map((inf: InfluencerInfo, i: number) => [
            `${i + 1}`,
            inf.username ? `@${inf.username}` : inf.name,
            normalizePlatform(inf.platform),
            `${inf.mentions}`,
            sentimentLabel(inf.sentiment),
            inf.reach,
          ]),
          theme: "plain",
          headStyles: {
            fillColor: [...PDF_COLORS.dark],
            textColor: [...PDF_COLORS.white],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
            cellPadding: 2.5,
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [...PDF_COLORS.textDark],
            cellPadding: 2,
          },
          alternateRowStyles: { fillColor: [...PDF_COLORS.cardBg] },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { cellWidth: 42 },
            2: { halign: "center", cellWidth: 24 },
            3: { halign: "center", cellWidth: 18 },
            4: { halign: "center", cellWidth: 22 },
            5: { halign: "right", cellWidth: "auto" },
          },
          margin: { left: m, right: m },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
              const val = data.cell.raw as string;
              if (val === "Negativo") data.cell.styles.textColor = [...PDF_COLORS.negative];
              else if (val === "Positivo") data.cell.styles.textColor = [...PDF_COLORS.positive];
              else data.cell.styles.textColor = [...PDF_COLORS.neutral];
            }
          },
        });
        y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
      }

      // ── DISTRIBUCION POR FUENTES ──
      if (report.sourceBreakdown.length > 0) {
        y = needPage(doc, y, 35, ph, logoBase64, projectName, m);
        y = drawSectionTitle(doc, "Distribucion por Medios y Plataformas", m, y, cw);

        autoTable(doc, {
          startY: y,
          head: [["Fuente", "Total", "Pos", "Neu", "Neg", "% Neg"]],
          body: report.sourceBreakdown.slice(0, 10).map((s: SourceBreakdown) => [
            normalizePlatform(s.source),
            `${s.count}`,
            `${s.positive}`,
            `${s.neutral}`,
            `${s.negative}`,
            `${Math.round(s.negative / (s.count || 1) * 100)}%`,
          ]),
          theme: "plain",
          headStyles: {
            fillColor: [...PDF_COLORS.dark],
            textColor: [...PDF_COLORS.white],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center",
            cellPadding: 2.5,
          },
          bodyStyles: { fontSize: 7.5, textColor: [...PDF_COLORS.textDark], cellPadding: 2 },
          alternateRowStyles: { fillColor: [...PDF_COLORS.cardBg] },
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
              if (pct >= 70) data.cell.styles.textColor = [...PDF_COLORS.negative];
              else if (pct >= 40) data.cell.styles.textColor = [...PDF_COLORS.neutral];
            }
          },
        });
        y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
      }

      // ── RECOMENDACIONES ──
      y = needPage(doc, y, 30, ph, logoBase64, projectName, m);
      y = drawSectionTitle(doc, "Recomendaciones Estrategicas", m, y, cw);
      report.recommendations.forEach((rec, i) => {
        y = drawNumberedItem(doc, rec, i + 1, m, y, cw, ph, logoBase64, projectName);
      });
      y += 2;

      // ── MENSAJE EJECUTIVO ──
      if (editedTemplate) {
        y = needPage(doc, y, 35, ph, logoBase64, projectName, m);
        y = drawSectionTitle(doc, "Mensaje Ejecutivo", m, y, cw);
        y = drawParagraph(doc, editedTemplate, m, y, cw, ph, logoBase64, projectName, 9.5);
      }

      // ── FOOTERS ──
      drawFooters(doc, logoBase64, projectName, pw, ph, m);

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
//  TIMELINE CHART (stacked bar)
// ═══════════════════════════════════════
function drawTimelineChart(
  doc: jsPDF, timeline: TimelinePoint[], m: number, y: number,
  cw: number, chartH: number, ph: number, logoBase64: string, projectName: string,
): number {
  y = needPage(doc, y, chartH + 15, ph, logoBase64, projectName, m);
  const data = timeline.slice(-14);
  if (data.length === 0) return y;

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barW = Math.min((cw - 20) / data.length - 1, 12);
  const chartX = m + 10;
  const barAreaW = data.length * (barW + 1);
  const startX = chartX + (cw - 20 - barAreaW) / 2;

  // Y axis
  doc.setFontSize(6);
  doc.setTextColor(...PDF_COLORS.textGray);
  doc.text(`${maxVal}`, m + 2, y + 2);
  doc.text("0", m + 4, y + chartH - 2);

  // Baseline
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(m + 8, y + chartH, m + cw - 2, y + chartH);

  // Bars
  data.forEach((d, i) => {
    const x = startX + i * (barW + 1);
    const h = (d.count / maxVal) * (chartH - 8);
    const negH = d.count > 0 ? (d.negative / d.count) * h : 0;
    const posH = d.count > 0 ? (d.positive / d.count) * h : 0;
    const neuH = h - negH - posH;
    let bY = y + chartH - h;

    if (posH > 0) { doc.setFillColor(...PDF_COLORS.positive); doc.rect(x, bY, barW, posH, "F"); bY += posH; }
    if (neuH > 0) { doc.setFillColor(...PDF_COLORS.neutral); doc.rect(x, bY, barW, neuH, "F"); bY += neuH; }
    if (negH > 0) { doc.setFillColor(...PDF_COLORS.negative); doc.rect(x, bY, barW, negH, "F"); }

    doc.setFontSize(5.5);
    doc.setTextColor(...PDF_COLORS.textGray);
    doc.text(d.date.slice(5), x + barW / 2, y + chartH + 4, { align: "center" });
  });

  // Legend
  const legendY = y + chartH + 8;
  doc.setFontSize(6);
  [
    { c: PDF_COLORS.positive, l: "Positivo" },
    { c: PDF_COLORS.neutral, l: "Neutral" },
    { c: PDF_COLORS.negative, l: "Negativo" },
  ].forEach(({ c, l }, i) => {
    const lx = m + 10 + i * 25;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.circle(lx, legendY, 1.5, "F");
    doc.setTextColor(...PDF_COLORS.textGray);
    doc.text(l, lx + 3, legendY + 1);
  });

  return legendY + 6;
}
