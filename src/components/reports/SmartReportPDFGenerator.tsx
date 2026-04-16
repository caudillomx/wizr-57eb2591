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
  useClaudeHTML?: boolean;
  rawMentions?: Mention[];
  projectAudience?: string;
  projectObjective?: string;
  strategicContext?: string;
  strategicFocus?: string;
  entityNames?: string[];
}

export function SmartReportPDFGenerator({
  report, projectName, dateRange, selectedTemplate, editedTemplate,
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
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false,
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
            sectionBounds.push({ top: (r.top - parentRect.top) * 2, bottom: (r.bottom - parentRect.top) * 2 });
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
              if (adjusted > currentPos + pageHeightPx * 0.3) sliceEnd = adjusted;
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
      toast({ title: "Error al generar PDF", description: "No se pudo generar el reporte. Intenta nuevamente.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePDFWithClaude = async () => {
    setIsGenerating(true);
    let iframe: HTMLIFrameElement | null = null;

    try {
      const result = await Promise.race([
        supabase.functions.invoke("generate-claude-report", {
          body: {
            precomputedReport: {
              title: report.title,
              summary: report.summary,
              keyFindings: report.keyFindings.slice(0, 4),
              recommendations: report.recommendations.slice(0, 4),
              conclusions: report.conclusions?.slice(0, 3),
              metrics: report.metrics,
              sourceBreakdown: report.sourceBreakdown.slice(0, 4),
              influencers: report.influencers.slice(0, 4).map((item) => ({
                name: item.name, username: item.username, platform: item.platform,
                mentions: item.mentions, sentiment: item.sentiment, reach: item.reach,
              })),
              timeline: report.timeline.slice(0, 5),
              narratives: report.narratives.slice(0, 3),
              totalUniqueAuthors: report.totalUniqueAuthors,
            },
            reportType: "unified",
            extension: "medium",
            projectName,
            dateRange,
            projectAudience: projectAudience || "",
            projectObjective: projectObjective || "",
            strategicContext,
            strategicFocus,
            entityNames,
          },
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Tiempo de espera agotado al diseñar el reporte con Claude")), 80000);
        }),
      ]);

      const invokeResult = result as { data: { html?: string } | null; error: { message?: string } | null };
      if (invokeResult.error) throw new Error(invokeResult.error.message || "Error al invocar generate-claude-report");

      const html = typeof invokeResult.data?.html === "string" ? invokeResult.data.html.trim() : "";
      if (!html) throw new Error("Claude no devolvió HTML válido");

      iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;height:auto;border:none;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);
      iframe.contentDocument?.open();
      iframe.contentDocument?.write(html);
      iframe.contentDocument?.close();

      await new Promise(r => setTimeout(r, 300));
      const scrollHeight = iframe.contentDocument?.body?.scrollHeight || 2000;
      iframe.style.height = scrollHeight + "px";
      await new Promise(r => setTimeout(r, 1600));

      const canvas = await html2canvas(iframe.contentDocument!.body, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false, width: 794,
      });

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
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, currentPos, imgW, sliceH, 0, 0, imgW, sliceH);
          const pageImg = pageCanvas.toDataURL("image/png");
          doc.addImage(pageImg, "PNG", 0, 0, pdfW, sliceH * ratio);
        }
        currentPos += sliceH;
        pageNum++;
      }

      const fileName = `reporte_claude_${projectName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      doc.save(fileName);
      toast({ title: "PDF generado", description: fileName });
    } catch (error) {
      console.error("Claude PDF error:", error);
      toast({
        title: "Error al generar PDF",
        description: error instanceof Error ? error.message : "No se pudo generar el reporte con Claude.",
        variant: "destructive"
      });
    } finally {
      if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe);
      setIsGenerating(false);
    }
  };

  const handleGenerate = useClaudeHTML ? generatePDFWithClaude : generatePDFDefault;
  const loadingText = useClaudeHTML ? "Diseñando reporte con Claude..." : "Generando PDF...";

  return (
    <>
      {!useClaudeHTML && (
        <div className="fixed left-[-9999px] top-0" aria-hidden="true">
          <SmartReportPDFPreview
            ref={previewRef}
            report={report}
            projectName={projectName}
            dateRange={dateRange}
            editedTemplate={editedTemplate}
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
