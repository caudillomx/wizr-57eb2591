import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { SmartReportContent, InfluencerInfo, SourceBreakdown } from "@/hooks/useSmartReport";

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

// Brand colors
const WIZR_VIOLET = [90, 47, 186] as const;
const WIZR_VIOLET_LIGHT = [237, 231, 252] as const;
const WIZR_ORANGE = [255, 107, 53] as const;
const DARK = [17, 24, 39] as const;
const GRAY = [107, 114, 128] as const;
const LIGHT_BG = [248, 250, 252] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [16, 185, 129] as const;
const RED = [239, 68, 68] as const;
const AMBER = [245, 158, 11] as const;

export function SmartReportPDFGenerator({
  report,
  projectName,
  dateRange,
  selectedTemplate,
  editedTemplate,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pw - margin * 2;
      let y = 0;

      const checkPage = (need: number = 25) => {
        if (y + need > ph - 25) {
          doc.addPage();
          y = 22;
        }
      };

      const drawSectionTitle = (title: string, icon?: string) => {
        checkPage(20);
        // Accent bar
        doc.setFillColor(...WIZR_VIOLET);
        doc.rect(margin, y, 3, 12, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...DARK);
        doc.text(`${icon ? icon + "  " : ""}${title}`, margin + 8, y + 9);
        y += 18;
      };

      const drawParagraph = (text: string, fontSize = 9.5) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...DARK);
        const lines = doc.splitTextToSize(text, contentW - 4);
        lines.forEach((line: string) => {
          checkPage(6);
          doc.text(line, margin + 2, y);
          y += 4.5;
        });
        y += 3;
      };

      // ============= COVER PAGE =============
      // Top gradient bar
      doc.setFillColor(...WIZR_VIOLET);
      doc.rect(0, 0, pw, 65, "F");
      // Subtle pattern overlay
      doc.setFillColor(255, 255, 255);
      doc.setGState(doc.GState({ opacity: 0.08 }));
      for (let i = 0; i < 8; i++) {
        doc.circle(pw - 30 + i * 5, 30 + i * 3, 40, "F");
      }
      doc.setGState(doc.GState({ opacity: 1 }));

      // Logo / Brand
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...WHITE);
      doc.text("WIZR", margin, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Inteligencia Estrategica", margin + 22, 18);

      // Title on cover
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(...WHITE);
      const titleLines = doc.splitTextToSize(report.title, contentW);
      titleLines.forEach((line: string, i: number) => {
        doc.text(line, margin, 38 + i * 9);
      });

      // Date badge
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`${dateRange.label}  |  ${format(new Date(), "d 'de' MMMM yyyy", { locale: es })}`, margin, 55);

      y = 78;

      // Project info bar
      doc.setFillColor(...LIGHT_BG);
      doc.roundedRect(margin, y, contentW, 16, 2, 2, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WIZR_VIOLET);
      doc.text("PROYECTO", margin + 6, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.text(projectName, margin + 36, y + 7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...WIZR_VIOLET);
      doc.text("PERIODO", margin + contentW / 2, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DARK);
      doc.text(`${dateRange.start} al ${dateRange.end}`, margin + contentW / 2 + 28, y + 7);
      y += 24;

      // ============= METRICS DASHBOARD =============
      const metricBoxW = (contentW - 12) / 4;
      const metrics = [
        { label: "Total Menciones", value: report.metrics.totalMentions.toString(), color: WIZR_VIOLET },
        { label: "Positivas", value: report.metrics.positiveCount.toString(), color: GREEN },
        { label: "Neutrales", value: report.metrics.neutralCount.toString(), color: AMBER },
        { label: "Negativas", value: report.metrics.negativeCount.toString(), color: RED },
      ];

      metrics.forEach((m, i) => {
        const x = margin + i * (metricBoxW + 4);
        doc.setFillColor(...(m.color as [number, number, number]));
        doc.roundedRect(x, y, metricBoxW, 22, 2, 2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(...WHITE);
        doc.text(m.value, x + metricBoxW / 2, y + 12, { align: "center" });
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(m.label, x + metricBoxW / 2, y + 18, { align: "center" });
      });
      y += 30;

      // Sentiment percentage bar
      const total = report.metrics.totalMentions || 1;
      const posW = (report.metrics.positiveCount / total) * contentW;
      const neuW = (report.metrics.neutralCount / total) * contentW;
      const negW = (report.metrics.negativeCount / total) * contentW;
      
      doc.setFillColor(...GREEN);
      doc.roundedRect(margin, y, Math.max(posW, 0.5), 6, 1, 1, "F");
      doc.setFillColor(...AMBER);
      doc.rect(margin + posW, y, Math.max(neuW, 0.5), 6, "F");
      doc.setFillColor(...RED);
      doc.roundedRect(margin + posW + neuW, y, Math.max(negW, 0.5), 6, 1, 1, "F");
      
      y += 10;
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      const posPct = Math.round(report.metrics.positiveCount / total * 100);
      const neuPct = Math.round(report.metrics.neutralCount / total * 100);
      const negPct = Math.round(report.metrics.negativeCount / total * 100);
      doc.text(`Positivo ${posPct}%`, margin, y);
      doc.text(`Neutral ${neuPct}%`, pw / 2 - 10, y);
      doc.text(`Negativo ${negPct}%`, pw - margin - 25, y);
      y += 10;

      // ============= RESUMEN EJECUTIVO =============
      drawSectionTitle("Resumen Ejecutivo");
      drawParagraph(report.summary, 10);

      // ============= ANALISIS DE SENTIMIENTO =============
      if (report.sentimentAnalysis) {
        drawSectionTitle("Analisis de Sentimiento");
        drawParagraph(report.sentimentAnalysis);
      }

      // ============= EVALUACION DE IMPACTO =============
      if (report.impactAssessment) {
        drawSectionTitle("Evaluacion de Impacto");
        // Impact box with colored border
        checkPage(30);
        doc.setFillColor(...WIZR_VIOLET_LIGHT);
        const impactLines = doc.splitTextToSize(report.impactAssessment, contentW - 16);
        const impactH = impactLines.length * 4.5 + 10;
        doc.roundedRect(margin, y, contentW, impactH, 2, 2, "F");
        doc.setFillColor(...WIZR_VIOLET);
        doc.rect(margin, y, 3, impactH, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...DARK);
        impactLines.forEach((line: string, i: number) => {
          doc.text(line, margin + 10, y + 8 + i * 4.5);
        });
        y += impactH + 8;
      }

      // ============= HALLAZGOS CLAVE =============
      drawSectionTitle("Hallazgos Clave");
      report.keyFindings.forEach((finding, i) => {
        checkPage(16);
        // Number badge
        doc.setFillColor(...WIZR_VIOLET);
        doc.circle(margin + 6, y - 1, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...WHITE);
        doc.text(`${i + 1}`, margin + 6, y + 1, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...DARK);
        const lines = doc.splitTextToSize(finding, contentW - 20);
        lines.forEach((line: string, li: number) => {
          checkPage(6);
          doc.text(line, margin + 14, y + li * 4.5);
        });
        y += lines.length * 4.5 + 4;
      });
      y += 4;

      // ============= INFLUENCIADORES =============
      if (report.influencers.length > 0) {
        drawSectionTitle("Influenciadores de la Conversacion");
        
        autoTable(doc, {
          startY: y,
          head: [["#", "Perfil", "Usuario", "Plataforma", "Menciones", "Sentimiento", "Alcance"]],
          body: report.influencers.map((inf: InfluencerInfo, i: number) => [
            `${i + 1}`,
            inf.name,
            inf.username ? `@${inf.username}` : "-",
            normalizePlatform(inf.platform),
            `${inf.mentions}`,
            inf.sentiment === "negativo" ? "Negativo" : inf.sentiment === "positivo" ? "Positivo" : "Mixto",
            inf.reach,
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [...WIZR_VIOLET],
            textColor: [...WHITE],
            fontStyle: "bold",
            fontSize: 8,
            halign: "center",
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [...DARK],
          },
          alternateRowStyles: {
            fillColor: [...WIZR_VIOLET_LIGHT],
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 8 },
            1: { cellWidth: 38 },
            2: { cellWidth: 30, fontSize: 7 },
            3: { halign: "center", cellWidth: 24 },
            4: { halign: "center", cellWidth: 18 },
            5: { halign: "center", cellWidth: 20 },
            6: { cellWidth: "auto" },
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY + 10 || y + 40;
      }

      // ============= DISTRIBUCION POR FUENTES =============
      if (report.sourceBreakdown.length > 0) {
        drawSectionTitle("Distribucion por Medios y Plataformas");
        
        const topSources = report.sourceBreakdown.slice(0, 10);
        autoTable(doc, {
          startY: y,
          head: [["Fuente", "Total", "Positivas", "Neutrales", "Negativas", "% Negativo"]],
          body: topSources.map((s: SourceBreakdown) => [
            normalizePlatform(s.source),
            `${s.count}`,
            `${s.positive}`,
            `${s.neutral}`,
            `${s.negative}`,
            `${Math.round(s.negative / (s.count || 1) * 100)}%`,
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [...WIZR_VIOLET],
            textColor: [...WHITE],
            fontStyle: "bold",
            fontSize: 8,
            halign: "center",
          },
          bodyStyles: { fontSize: 8, textColor: [...DARK] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "center", cellWidth: 22 },
            3: { halign: "center", cellWidth: 22 },
            4: { halign: "center", cellWidth: 22 },
            5: { halign: "center", cellWidth: 22 },
          },
          margin: { left: margin, right: margin },
        });
        y = (doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY + 10 || y + 40;
      }

      // ============= RECOMENDACIONES =============
      drawSectionTitle("Recomendaciones Estrategicas");
      report.recommendations.forEach((rec, i) => {
        checkPage(18);
        // Colored number
        doc.setFillColor(...WIZR_ORANGE);
        doc.circle(margin + 6, y - 1, 4, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...WHITE);
        doc.text(`${i + 1}`, margin + 6, y + 1, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...DARK);
        const lines = doc.splitTextToSize(rec, contentW - 20);
        lines.forEach((line: string, li: number) => {
          checkPage(6);
          doc.text(line, margin + 14, y + li * 4.5);
        });
        y += lines.length * 4.5 + 5;
      });
      y += 4;

      // ============= TEMPLATE / MENSAJE =============
      checkPage(40);
      const templateLabels: Record<string, string> = {
        executive: "Mensaje Ejecutivo",
        technical: "Mensaje Tecnico",
        public: "Mensaje Publico (WhatsApp)",
      };
      drawSectionTitle(templateLabels[selectedTemplate] || "Mensaje");
      
      // Template in a styled box
      doc.setFillColor(...LIGHT_BG);
      const templateLines = doc.splitTextToSize(editedTemplate, contentW - 16);
      const templateH = Math.min(templateLines.length * 4.5 + 10, ph - y - 30);
      doc.roundedRect(margin, y, contentW, templateH, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      let tempY = y + 6;
      for (const line of templateLines) {
        if (tempY > y + templateH - 4) {
          doc.addPage();
          y = 22;
          tempY = y;
          doc.setFillColor(...LIGHT_BG);
          const remainingLines = templateLines.slice(templateLines.indexOf(line));
          const remH = remainingLines.length * 4.5 + 10;
          doc.roundedRect(margin, y, contentW, Math.min(remH, ph - 50), 2, 2, "F");
        }
        doc.text(line, margin + 8, tempY);
        tempY += 4.5;
      }
      y = tempY + 8;

      // ============= FOOTER on all pages =============
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        // Bottom bar
        doc.setFillColor(...WIZR_VIOLET);
        doc.rect(0, ph - 12, pw, 12, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...WHITE);
        doc.text(
          `${projectName}  |  ${dateRange.label}  |  Generado con Wizr`,
          margin,
          ph - 5
        );
        doc.text(`${i} / ${pageCount}`, pw - margin, ph - 5, { align: "right" });
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
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      PDF
    </Button>
  );
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
