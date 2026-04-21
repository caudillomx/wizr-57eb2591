import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { format } from "date-fns";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { useToast } from "@/hooks/use-toast";
import { PerformanceReportView } from "./PerformanceReportView";
import wizrLogo from "@/assets/wizr-logo-full.png";

interface PerformanceReportPDFGeneratorProps {
  report: PerformanceReportContent;
  clientName: string;
  dateRange: { start: string; end: string; label: string };
}

/**
 * Renders the EXACT same `PerformanceReportView` component used in the dashboard
 * into an off-screen container at fixed A4 width and converts it page-by-page
 * to a PDF using html2canvas + jsPDF.
 *
 * This guarantees 1:1 visual parity between web view and PDF — same Recharts,
 * same numbers, same narrative — and eliminates the legacy header overlap and
 * empty-space issues that came from rebuilding the layout in raw HTML.
 */
export function PerformanceReportPDFGenerator({
  report, clientName, dateRange,
}: PerformanceReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const hiddenContainerRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);

    // 1) Off-screen container at A4 width (794px @ 96dpi ≈ 210mm)
    const PDF_WIDTH_PX = 1180; // wider canvas = sharper text once scaled to A4
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "-99999px";
    host.style.width = `${PDF_WIDTH_PX}px`;
    host.style.background = "#ffffff";
    host.style.zIndex = "-1";
    document.body.appendChild(host);
    hiddenContainerRef.current = host;

    const root = createRoot(host);

    try {
      // 2) Render the same view used in the dashboard
      await new Promise<void>((resolve) => {
        root.render(
          <div style={{ padding: "32px 36px", background: "#ffffff" }}>
            {/* Branded header with Wizr logo */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
                color: "#fff",
                padding: "22px 28px",
                borderRadius: 12,
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 10,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <img src={wizrLogo} alt="Wizr" style={{ height: 36, display: "block" }} crossOrigin="anonymous" />
                </div>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: "0.22em", opacity: 0.75, fontWeight: 600, textTransform: "uppercase" }}>
                    Inteligencia de medios
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                    {clientName} · {report.reportMode === "brand" ? "Reporte de marca" : "Reporte de benchmark"}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{dateRange.label}</div>
            </div>

            <PerformanceReportView
              report={report}
              editing={false}
              dateLabel={dateRange.label}
            />

            <div
              style={{
                marginTop: 28,
                paddingTop: 14,
                borderTop: "1px solid #e5e7eb",
                fontSize: 10,
                color: "#6b7280",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Generado el {format(new Date(), "d 'de' MMMM yyyy")} · {dateRange.start} → {dateRange.end}</span>
              <span style={{ color: "#374151", fontWeight: 600 }}>Wizr · wizr.mx</span>
            </div>
          </div>
        );
        // Wait for Recharts/ResponsiveContainer to layout
        setTimeout(resolve, 1200);
      });

      // 3) Detect natural break points (top of each top-level block) BEFORE capture
      // We collect Y positions of every direct child Card / wrapper inside the report
      // so the slicer never cuts a card in half.
      const breakpointsPx: number[] = [];
      const hostRect = host.getBoundingClientRect();
      const blocks = host.querySelectorAll<HTMLElement>(
        '[data-pdf-block], .rounded-xl, [class*="rounded-lg"][class*="border"], .recharts-wrapper'
      );
      // We actually want top-level cards: target direct children of the report's root grid/space-y container
      const reportRoot = host.querySelector<HTMLElement>(".space-y-8") ?? host;
      Array.from(reportRoot.children).forEach((child) => {
        const rect = (child as HTMLElement).getBoundingClientRect();
        breakpointsPx.push(rect.top - hostRect.top);
        breakpointsPx.push(rect.bottom - hostRect.top);
      });
      // Suppress unused-var warning for the broader query (kept for future granular needs)
      void blocks;

      // 4) Capture
      const canvas = await html2canvas(host, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: PDF_WIDTH_PX,
      });

      // 5) Slice into A4 pages — snap each page break to the nearest natural breakpoint above it
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidthMm = pdf.internal.pageSize.getWidth();
      const pageHeightMm = pdf.internal.pageSize.getHeight();
      const imgWidthMm = pageWidthMm;
      // canvas is at scale=2 of the host CSS px; convert CSS px breakpoints to canvas px
      const cssToCanvas = canvas.width / PDF_WIDTH_PX;
      const breakpointsCanvasPx = Array.from(
        new Set(breakpointsPx.map((p) => Math.round(p * cssToCanvas)))
      ).sort((a, b) => a - b);

      const pxPerMm = canvas.width / imgWidthMm;
      const pageHeightPx = Math.floor(pageHeightMm * pxPerMm);
      const MIN_PAGE_FILL = 0.55; // never produce pages emptier than 55%

      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvas.height) {
        let sliceEnd = Math.min(renderedPx + pageHeightPx, canvas.height);

        // If we still have content after this slice, snap the cut to the closest
        // natural breakpoint (Card boundary) that fits within the page.
        if (sliceEnd < canvas.height) {
          const minAcceptable = renderedPx + Math.floor(pageHeightPx * MIN_PAGE_FILL);
          const candidate = [...breakpointsCanvasPx]
            .reverse()
            .find((bp) => bp <= sliceEnd && bp >= minAcceptable);
          if (candidate && candidate > renderedPx) {
            sliceEnd = candidate;
          }
        }

        const sliceHeight = sliceEnd - renderedPx;
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0, renderedPx, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight,
        );

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        const sliceHeightMm = sliceHeight / pxPerMm;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidthMm, sliceHeightMm);

        renderedPx = sliceEnd;
        pageIndex += 1;
      }

      const modeSlug = report.reportMode === "brand" ? "marca" : "benchmark";
      const filename = `performance_${modeSlug}_${clientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
      pdf.save(filename);

      toast({ title: "PDF generado", description: filename });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({
        title: "Error al generar PDF",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      try { root.unmount(); } catch { /* noop */ }
      if (hiddenContainerRef.current?.parentNode) {
        hiddenContainerRef.current.parentNode.removeChild(hiddenContainerRef.current);
      }
      hiddenContainerRef.current = null;
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownloadPDF}
      disabled={isGenerating}
      className="gap-2"
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Descargar PDF
    </Button>
  );
}
