import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { SmartReportContent } from "@/hooks/useSmartReport";
import type { Mention } from "@/hooks/useMentions";
import { SmartReportPDFPreview } from "./SmartReportPDFPreview";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  selectedTemplate: "executive" | "technical" | "public";
  editedTemplate: string;
  reportType?: "brief" | "crisis" | "thematic" | "comparative";
  useClaudeHTML?: boolean;
  rawMentions?: Mention[];
  projectAudience?: string;
  projectObjective?: string;
  strategicContext?: string;
  strategicFocus?: string;
  entityNames?: string[];
}

export function SmartReportPDFGenerator({
  report, projectName, dateRange, selectedTemplate, editedTemplate, reportType,
  useClaudeHTML, rawMentions, projectAudience, projectObjective, strategicContext, strategicFocus, entityNames,
}: SmartReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const generatePDFDefault = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);
    try {
      const element = previewRef.current;
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
      const pdfW = 210;
      const pdfH = 297;
      const ratio = pdfW / imgW;
      const scaledH = imgH * ratio;

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      if (scaledH <= pdfH) {
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", 0, 0, pdfW, scaledH);
      } else {
        const sections = element.querySelectorAll("[data-pdf-section]");
        const sectionBounds: { top: number; bottom: number }[] = [];

        if (sections.length > 0) {
          const parentRect = element.getBoundingClientRect();
          sections.forEach(sec => {
            const r = sec.getBoundingClientRect();
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
      toast({
        title: "Error al generar PDF",
        description: "No se pudo generar el reporte. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDFWithClaude = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-claude-report", {
        body: {
          mentions: rawMentions || [],
          reportType: reportType || "brief",
          extension: "medium",
          projectName,
          dateRange,
          projectAudience: projectAudience || "",
          projectObjective: projectObjective || "",
          strategicContext,
          strategicFocus,
          entityNames,
        },
      });
      if (error) throw error;
      const html: string = data.html;

      // Write HTML to a hidden iframe
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;height:auto;border:none;";
      document.body.appendChild(iframe);
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();

      // Wait for fonts and layout
      await new Promise(r => setTimeout(r, 2000));

      // Capture with html2canvas
      const canvas = await html2canvas(iframe.contentDocument!.body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
      });

      // Slice into A4 pages
      const pdfW = 210;
      const pdfH = 297;
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = pdfW / imgW;
      const pageHeightPx = pdfH / ratio;

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      let currentPos = 0;
      let pageNum = 0;

      while (currentPos < imgH) {
        if (pageNum > 0) doc.addPage();
        const sliceH = Math.min(pageHeightPx, imgH - currentPos);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = imgW;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, currentPos, imgW, sliceH, 0, 0, imgW, sliceH);
        const pageImg = pageCanvas.toDataURL("image/png");
        doc.addImage(pageImg, "PNG", 0, 0, pdfW, sliceH * ratio);
        currentPos += sliceH;
        pageNum++;
      }

      const fileName = `reporte_claude_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      doc.save(fileName);
      document.body.removeChild(iframe);

      toast({ title: "PDF generado", description: fileName });
    } catch (error) {
      console.error("Claude PDF error:", error);
      toast({ title: "Error al generar PDF", description: "No se pudo generar el reporte con Claude. Intenta nuevamente.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = useClaudeHTML ? generatePDFWithClaude : generatePDFDefault;
  const loadingText = useClaudeHTML ? "Diseñando reporte con Claude..." : "Generando PDF...";

  return (
    <>
      {/* Hidden preview for html2canvas capture (default flow) */}
      {!useClaudeHTML && (
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
      )}

      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {isGenerating ? loadingText : "PDF"}
      </Button>
    </>
  );
}
