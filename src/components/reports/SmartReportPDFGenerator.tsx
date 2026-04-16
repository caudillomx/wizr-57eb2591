import { Button } from "@/components/ui/button";
import { FileText, BookOpen, Printer, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import type { SmartReportContent } from "@/hooks/useSmartReport";
import { buildReportHTML } from "@/lib/reports/printReportBuilder";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type PDFFormat = "summary" | "full";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  pdfFormat?: PDFFormat;
}

function trimReportForSummary(report: SmartReportContent): SmartReportContent {
  return {
    ...report,
    keyFindings: report.keyFindings.slice(0, 3),
    recommendations: report.recommendations.slice(0, 2),
    conclusions: report.conclusions?.slice(0, 2),
    narratives: report.narratives.slice(0, 3),
    influencers: report.influencers.slice(0, 5),
    sourceBreakdown: report.sourceBreakdown.slice(0, 5),
    entityComparison: undefined,
  };
}

// A4 dimensions in mm
const A4_W = 210;
const A4_H = 297;
const MARGIN = 0; // full-bleed, margins are built into the HTML
const CONTENT_W = A4_W - MARGIN * 2;
const SECTION_GAP = 1; // mm between sections

export function SmartReportPDFGenerator({
  report,
  projectName,
  dateRange,
  pdfFormat = "full",
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const isSummary = pdfFormat === "summary";

  /** Open in new tab for print preview (existing behavior) */
  const handlePreview = () => {
    const reportData = isSummary ? trimReportForSummary(report) : report;
    const html = buildReportHTML(reportData, projectName, dateRange, isSummary);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 300);
  };

  /** Generate PDF via html2canvas section-by-section capture */
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const reportData = isSummary ? trimReportForSummary(report) : report;
      const html = buildReportHTML(reportData, projectName, dateRange, isSummary);

      // Create hidden container to render the report
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;z-index:-1;";
      document.body.appendChild(container);

      // Create iframe to isolate styles
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "width:794px;height:5000px;border:none;";
      container.appendChild(iframe);

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.srcdoc = html;
      });

      // Wait for fonts & images
      await new Promise((r) => setTimeout(r, 800));

      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) throw new Error("Cannot access iframe document");

      // Find all sections
      const sectionEls = Array.from(
        iframeDoc.querySelectorAll("[data-pdf-section]")
      ) as HTMLElement[];

      if (sectionEls.length === 0) throw new Error("No sections found");

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      let currentY = MARGIN;
      let isFirstPage = true;

      for (let i = 0; i < sectionEls.length; i++) {
        const el = sectionEls[i];

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: 794,
        });

        const imgWidthPx = canvas.width / 2;
        const imgHeightPx = canvas.height / 2;
        const scaleFactor = CONTENT_W / imgWidthPx;
        const heightMM = imgHeightPx * scaleFactor;

        // Check if section fits on current page
        const remainingSpace = A4_H - currentY - MARGIN;

        if (heightMM > remainingSpace && !isFirstPage) {
          // Doesn't fit — new page
          pdf.addPage();
          currentY = MARGIN;
        }

        // If a single section is taller than one full page, we need to split it
        if (heightMM > A4_H - MARGIN * 2) {
          // Draw as much as fits, then continue on next pages
          const pageContentH = A4_H - MARGIN * 2;
          const totalPages = Math.ceil(heightMM / pageContentH);
          
          for (let p = 0; p < totalPages; p++) {
            if (p > 0) {
              pdf.addPage();
              currentY = MARGIN;
            }
            
            // Calculate source crop in canvas pixels
            const srcY = (p * pageContentH / scaleFactor) * 2;
            const srcH = Math.min(
              (pageContentH / scaleFactor) * 2,
              canvas.height - srcY
            );
            
            if (srcH <= 0) break;

            // Create cropped canvas
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = canvas.width;
            cropCanvas.height = srcH;
            const ctx = cropCanvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
              const cropImg = cropCanvas.toDataURL("image/png");
              const cropHMM = (srcH / 2) * scaleFactor;
              pdf.addImage(cropImg, "PNG", MARGIN, currentY, CONTENT_W, cropHMM);
              currentY += cropHMM;
            }
          }
        } else {
          const imgData = canvas.toDataURL("image/png");
          pdf.addImage(imgData, "PNG", MARGIN, currentY, CONTENT_W, heightMM);
          currentY += heightMM + SECTION_GAP;
        }

        isFirstPage = false;
      }

      // Clean up
      document.body.removeChild(container);

      // Save
      const safeTitle = projectName.replace(/\s+/g, "_").substring(0, 40);
      const suffix = isSummary ? "Resumen" : "Completo";
      pdf.save(`Reporte_${safeTitle}_${suffix}.pdf`);

      toast({ title: "PDF generado", description: "El archivo se descargó exitosamente" });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({
        title: "Error al generar PDF",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const label = isSummary ? "Resumen" : "Completo";

  return (
    <div className="flex gap-2 w-full">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadPDF}
        disabled={isGenerating}
        className="flex-1 gap-2"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        PDF {label}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePreview}
        className="gap-2"
        title="Vista previa para imprimir"
      >
        <Printer className="h-4 w-4" />
      </Button>
    </div>
  );
}
