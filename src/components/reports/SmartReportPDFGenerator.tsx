import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import type { SmartReportContent } from "@/hooks/useSmartReport";
import { SmartReportPDFPreview } from "./SmartReportPDFPreview";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
}

export function SmartReportPDFGenerator({
  report, projectName, dateRange, selectedTemplate, editedTemplate,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const element = previewRef.current;

      // Capture the full rendered HTML as a canvas at 2x resolution
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const imgW = canvas.width;
      const imgH = canvas.height;

      // A4 dimensions in mm
      const pdfW = 210;
      const pdfH = 297;
      const ratio = pdfW / imgW;
      const scaledH = imgH * ratio;

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      // If content fits in one page
      if (scaledH <= pdfH) {
        doc.addImage(imgData, "JPEG", 0, 0, pdfW, scaledH);
      } else {
        // Multi-page: slice the canvas into page-sized chunks
        const pageHeightPx = pdfH / ratio; // height in canvas pixels per page
        let currentPos = 0;
        let pageNum = 0;

        while (currentPos < imgH) {
          if (pageNum > 0) doc.addPage();

          // Create a slice canvas for this page
          const sliceH = Math.min(pageHeightPx, imgH - currentPos);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = imgW;
          pageCanvas.height = sliceH;
          const ctx = pageCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, currentPos, imgW, sliceH, 0, 0, imgW, sliceH);
            const pageImg = pageCanvas.toDataURL("image/jpeg", 0.92);
            const pageScaledH = sliceH * ratio;
            doc.addImage(pageImg, "JPEG", 0, 0, pdfW, pageScaledH);
          }

          currentPos += pageHeightPx;
          pageNum++;
        }
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
    <>
      {/* Hidden preview for html2canvas capture */}
      <div className="fixed left-[-9999px] top-0" aria-hidden="true">
        <SmartReportPDFPreview
          ref={previewRef}
          report={report}
          projectName={projectName}
          dateRange={dateRange}
          editedTemplate={editedTemplate}
        />
      </div>

      <Button variant="outline" size="sm" onClick={generatePDF} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        PDF
      </Button>
    </>
  );
}
