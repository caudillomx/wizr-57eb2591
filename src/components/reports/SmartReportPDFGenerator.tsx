import { Button } from "@/components/ui/button";
import { FileText, BookOpen, Printer } from "lucide-react";
import type { SmartReportContent } from "@/hooks/useSmartReport";
import { buildReportHTML } from "@/lib/reports/printReportBuilder";

export type PDFFormat = "summary" | "full";

interface SmartReportPDFGeneratorProps {
  report: SmartReportContent;
  projectName: string;
  dateRange: { start: string; end: string; label: string };
  pdfFormat?: PDFFormat;
}

/**
 * Trims a full report to summary-level content for the Resumen PDF.
 */
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

export function SmartReportPDFGenerator({
  report,
  projectName,
  dateRange,
  pdfFormat = "full",
}: SmartReportPDFGeneratorProps) {
  const isSummary = pdfFormat === "summary";

  const generatePrintPDF = () => {
    const reportData = isSummary ? trimReportForSummary(report) : report;
    const html = buildReportHTML(reportData, projectName, dateRange, isSummary);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      setTimeout(() => {
        win.print();
      }, 300);
    };
  };

  const Icon = isSummary ? FileText : BookOpen;
  const label = isSummary ? "Exportar Resumen" : "Exportar Completo";

  return (
    <Button variant="outline" size="sm" onClick={generatePrintPDF} className="w-full gap-2">
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}
