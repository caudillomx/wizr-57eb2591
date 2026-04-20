import { Button } from "@/components/ui/button";
import { Printer, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { PerformanceReportContent } from "@/hooks/usePerformanceReport";
import { buildPerformanceReportHTML } from "@/lib/reports/performanceReportBuilder";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PerformanceReportPDFGeneratorProps {
  report: PerformanceReportContent;
  clientName: string;
  dateRange: { start: string; end: string; label: string };
}

export function PerformanceReportPDFGenerator({
  report, clientName, dateRange,
}: PerformanceReportPDFGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handlePreview = () => {
    const built = buildPerformanceReportHTML(report, clientName, dateRange);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(built.html);
    win.document.close();
    win.onload = () => setTimeout(() => win.print(), 300);
  };

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const built = buildPerformanceReportHTML(report, clientName, dateRange);
      const modeSlug = report.reportMode === "brand" ? "marca" : "benchmark";
      const filename = `performance_${modeSlug}_${clientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;

      const { data, error } = await supabase.functions.invoke("generate-pdf-pdfshift", {
        body: { html: built.html, filename, header: built.header, footer: built.footer },
      });

      if (error) throw new Error(error.message);
      if (!data?.pdf) throw new Error(data?.error || "No PDF returned");

      const binary = atob(data.pdf);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "PDF generado", description: filename });
    } catch (err) {
      console.error("PDFShift error:", err);
      toast({
        title: "Error al generar PDF",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex gap-2">
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
