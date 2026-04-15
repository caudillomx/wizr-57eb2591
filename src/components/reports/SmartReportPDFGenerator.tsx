import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { SmartReportContent } from "@/hooks/useSmartReport";
import { SmartReportPDFPreview } from "./SmartReportPDFPreview";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
  reportType?: "brief" | "crisis" | "thematic" | "comparative";
}

export function SmartReportPDFGenerator({
  report, projectName, dateRange, selectedTemplate, editedTemplate, reportType,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const generatePDF = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const element = previewRef.current;

      // Wait for fonts & images to settle
      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgW = canvas.width;
      const imgH = canvas.height;

      // A4 dimensions in mm
      const pdfW = 210;
      const pdfH = 297;
      const ratio = pdfW / imgW;
      const scaledH = imgH * ratio;

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      if (scaledH <= pdfH) {
        /* FIX 2 — PNG instead of JPEG */
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", 0, 0, pdfW, scaledH);
      } else {
        // Section-aware page breaking: find section boundaries
        const sections = element.querySelectorAll("[data-pdf-section]");
        const sectionBounds: { top: number; bottom: number }[] = [];

        if (sections.length > 0) {
          const parentRect = element.getBoundingClientRect();
          sections.forEach(sec => {
            const r = sec.getBoundingClientRect();
            // Convert to canvas-pixel coordinates (scale 2x)
            sectionBounds.push({
              top: (r.top - parentRect.top) * 2,
              bottom: (r.bottom - parentRect.top) * 2,
            });
          });
        }

        const pageHeightPx = pdfH / ratio;
        let currentPos = 0;
        let pageNum = 0;

        while (currentPos < imgH) {
          if (pageNum > 0) doc.addPage();

          let sliceEnd = currentPos + pageHeightPx;

          // If sections exist, try not to cut through them
          if (sectionBounds.length > 0 && sliceEnd < imgH) {
            const cuttingSection = sectionBounds.find(
              s => s.top < sliceEnd && s.bottom > sliceEnd && s.top > currentPos
            );
            if (cuttingSection) {
              const adjusted = cuttingSection.top - 4;
              if (adjusted > currentPos + pageHeightPx * 0.3) {
                sliceEnd = adjusted;
              }
            }
          }

          const sliceH = Math.min(sliceEnd - currentPos, imgH - currentPos);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = imgW;
          pageCanvas.height = sliceH;
          const ctx = pageCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, currentPos, imgW, sliceH, 0, 0, imgW, sliceH);
            /* FIX 2 — PNG instead of JPEG */
            const pageImg = pageCanvas.toDataURL("image/png");
            const pageScaledH = sliceH * ratio;
            doc.addImage(pageImg, "PNG", 0, 0, pdfW, pageScaledH);
          }

          currentPos += sliceH;
          pageNum++;
        }
      }

      const fileName = `reporte_inteligente_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error generating PDF:", error);
      /* FIX 9 — toast error feedback */
      toast({
        title: "Error al generar PDF",
        description: "No se pudo generar el reporte. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      {/* Hidden preview for html2canvas capture */}
      <div className="fixed left-[-9999px] top-0" aria-hidden="true">
        <SmartReportPDFPreview
          ref={previewRef}
          report={report}
          projectName={projectName}
          dateRange={dateRange}
          editedTemplate={editedTemplate}
          reportType={reportType}
        />
      </div>

      <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        PDF
      </Button>
    </>
  );
}
