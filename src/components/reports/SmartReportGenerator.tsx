import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles,
  FileText,
  AlertTriangle,
  BarChart3,
  GitCompare,
  Loader2,
  Copy,
  MessageCircle,
  Globe,
  CheckCircle2,
  Filter,
  Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSmartReport, ReportType, ReportExtension, SmartReportContent, SmartReportConfig } from "@/hooks/useSmartReport";
import type { Mention } from "@/hooks/useMentions";
import { SmartReportPDFGenerator } from "./SmartReportPDFGenerator";
import { ReportAnalyticsCharts } from "./ReportAnalyticsCharts";

interface Entity {
  id: string;
  nombre: string;
}

interface SmartReportGeneratorProps {
  mentions: Mention[];
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  strategicContext?: string;
  entityNames?: string[];
  entities?: Entity[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof FileText; description: string }[] = [
  { value: "brief", label: "Brief Diario/Semanal", icon: FileText, description: "Resumen ejecutivo del periodo" },
  { value: "crisis", label: "Alerta de Crisis", icon: AlertTriangle, description: "Documento urgente sobre eventos críticos" },
  { value: "thematic", label: "Análisis Temático", icon: BarChart3, description: "Profundización en un tema detectado" },
  { value: "comparative", label: "Reporte Comparativo", icon: GitCompare, description: "Benchmark entre entidades" },
];

const EXTENSIONS: { value: ReportExtension; label: string; description: string }[] = [
  { value: "micro", label: "Micro", description: "1-2 párrafos • WhatsApp, tweets" },
  { value: "short", label: "Corto", description: "1 página • Executive summary" },
  { value: "medium", label: "Medio", description: "2-3 páginas • Análisis detallado" },
];

const SOURCE_TYPES = [
  { value: "__all__", label: "Todas las fuentes" },
  { value: "twitter", label: "Twitter/X" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "reddit", label: "Reddit" },
  { value: "news", label: "Medios Digitales" },
];

function getSourceType(domain: string | null | undefined): string {
  if (!domain) return "other";
  const d = domain.toLowerCase();
  if (d.includes("twitter") || d.includes("x.com")) return "twitter";
  if (d.includes("facebook") || d.includes("fb.com")) return "facebook";
  if (d.includes("instagram")) return "instagram";
  if (d.includes("tiktok")) return "tiktok";
  if (d.includes("youtube") || d.includes("youtu.be")) return "youtube";
  if (d.includes("linkedin")) return "linkedin";
  if (d.includes("reddit")) return "reddit";
  return "news";
}

export function SmartReportGenerator({
  mentions,
  projectName,
  projectAudience,
  projectObjective,
  strategicContext,
  entityNames,
  entities = [],
  dateRange,
}: SmartReportGeneratorProps) {
  const { toast } = useToast();
  const { generateReport, isGenerating, report, clearReport } = useSmartReport();
  
  const [reportType, setReportType] = useState<ReportType>("brief");
  const [extension, setExtension] = useState<ReportExtension>("short");
  const [selectedTemplate, setSelectedTemplate] = useState<"executive" | "technical" | "public">("executive");
  const [editedTemplates, setEditedTemplates] = useState<SmartReportContent["templates"] | null>(null);
  const [strategicFocus, setStrategicFocus] = useState("");
  
  const [sourceFilter, setSourceFilter] = useState<string>("__all__");
  const [entityFilter, setEntityFilter] = useState<string>("__all__");

  const filteredMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (sourceFilter !== "__all__") {
        const mentionSource = getSourceType(m.source_domain);
        if (mentionSource !== sourceFilter) return false;
      }
      if (entityFilter !== "__all__") {
        if (m.entity_id !== entityFilter) return false;
      }
      return true;
    });
  }, [mentions, sourceFilter, entityFilter]);

  const filteredEntityNames = useMemo(() => {
    if (entityFilter === "__all__") return entityNames;
    const entity = entities.find(e => e.id === entityFilter);
    return entity ? [entity.nombre] : entityNames;
  }, [entityFilter, entities, entityNames]);

  // Sentiment data for charts
  const sentimentData = useMemo(() => {
    const breakdown = { positivo: 0, negativo: 0, neutral: 0, sinAnalizar: 0 };
    filteredMentions.forEach(m => {
      if (m.sentiment === "positivo") breakdown.positivo++;
      else if (m.sentiment === "negativo") breakdown.negativo++;
      else if (m.sentiment === "neutral") breakdown.neutral++;
      else breakdown.sinAnalizar++;
    });
    return breakdown;
  }, [filteredMentions]);

  const handleGenerate = async () => {
    const config: SmartReportConfig = {
      reportType,
      extension,
      projectName,
      projectAudience,
      projectObjective,
      strategicContext: strategicContext || undefined,
      strategicFocus: strategicFocus.trim() || undefined,
      entityNames: filteredEntityNames,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        label: dateRange.label,
      },
    };

    const result = await generateReport(filteredMentions, config);
    if (result) {
      setEditedTemplates(result.templates);
    }
  };

  const handleCopyToClipboard = () => {
    const template = editedTemplates?.[selectedTemplate] || report?.templates[selectedTemplate];
    if (template) {
      navigator.clipboard.writeText(template);
      toast({ title: "Copiado", description: "Texto copiado al portapapeles" });
    }
  };

  const handleWhatsAppShare = () => {
    const template = editedTemplates?.[selectedTemplate] || report?.templates[selectedTemplate];
    if (template) {
      const encodedText = encodeURIComponent(template);
      window.open(`https://wa.me/?text=${encodedText}`, "_blank");
    }
  };

  const handleTemplateEdit = (value: string) => {
    if (editedTemplates) {
      setEditedTemplates({ ...editedTemplates, [selectedTemplate]: value });
    }
  };

  const currentTemplate = editedTemplates?.[selectedTemplate] || report?.templates[selectedTemplate] || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Reportes Inteligentes
        </CardTitle>
        <CardDescription>
          Genera productos de inteligencia listos para publicar en múltiples formatos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Configuration */}
        {!report && (
          <div className="space-y-4">
            {/* Report Type Selection */}
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = reportType === type.value;
                  return (
                    <button
                      key={type.value}
                      onClick={() => setReportType(type.value)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className={`font-medium text-sm ${isSelected ? "text-primary" : ""}`}>{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extension Selection */}
            <div className="space-y-2">
              <Label>Extensión</Label>
              <Select value={extension} onValueChange={(v) => setExtension(v as ReportExtension)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTENSIONS.map((ext) => (
                    <SelectItem key={ext.value} value={ext.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{ext.label}</span>
                        <span className="text-xs text-muted-foreground">{ext.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Strategic Focus */}
            <div className="space-y-2 p-4 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <Label className="font-medium">Enfoque Estratégico del Reporte</Label>
              </div>
              {strategicContext && (
                <p className="text-xs text-muted-foreground">
                  <strong>Contexto del proyecto:</strong> {strategicContext}
                </p>
              )}
              <Textarea
                value={strategicFocus}
                onChange={(e) => setStrategicFocus(e.target.value)}
                placeholder="Ej: Analizar cómo la detención de Rafael Zaga impacta la reputación de Actinver dado el litigio activo entre ambos. Evaluar si los medios vinculan directamente a Actinver con el caso."
                className="text-sm min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Define el ángulo específico del análisis. La IA enfocará el reporte en este contexto.
              </p>
            </div>

            {/* Filters Section */}
            <div className="space-y-3 p-4 rounded-lg border border-dashed bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Filtrar Menciones
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fuente / Plataforma</Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_TYPES.map((source) => (
                        <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Entidad</Label>
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas las entidades</SelectItem>
                      {entities.map((entity) => (
                        <SelectItem key={entity.id} value={entity.id}>{entity.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Data Summary */}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={filteredMentions.length < mentions.length ? "default" : "outline"}>
                {filteredMentions.length} menciones
                {filteredMentions.length < mentions.length && ` (de ${mentions.length})`}
              </Badge>
              <Badge variant="outline">{dateRange.label}</Badge>
              {sourceFilter !== "__all__" && (
                <Badge variant="secondary">
                  {SOURCE_TYPES.find(s => s.value === sourceFilter)?.label}
                </Badge>
              )}
              {entityFilter !== "__all__" && (
                <Badge variant="secondary">
                  {entities.find(e => e.id === entityFilter)?.nombre}
                </Badge>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={isGenerating || filteredMentions.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando reporte inteligente...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generar Reporte ({filteredMentions.length} menciones)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Generated Report */}
        {report && (
          <div className="space-y-6">
            {/* Report Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{report.title}</h3>
                <Button variant="ghost" size="sm" onClick={clearReport}>Nuevo reporte</Button>
              </div>
              <p className="text-muted-foreground">{report.summary}</p>
            </div>

            {/* Visual Analytics */}
            <ReportAnalyticsCharts
              sourceBreakdown={report.sourceBreakdown}
              influencers={report.influencers}
              timeline={report.timeline}
              sentimentData={sentimentData}
              impactAssessment={report.impactAssessment}
              sentimentAnalysis={report.sentimentAnalysis}
              dateLabel={dateRange.label}
              estimatedImpressions={report.metrics.estimatedImpressions}
              estimatedReach={report.metrics.estimatedReach}
              totalUniqueAuthors={report.totalUniqueAuthors}
            />

            {/* Key Findings & Recommendations */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Hallazgos Clave
                </h4>
                <ul className="space-y-1 text-sm">
                  {report.keyFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Recomendaciones
                </h4>
                <ul className="space-y-1 text-sm">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            {/* Download */}
            <div className="space-y-3">
              <h4 className="font-medium">Descargar Reporte</h4>
              <div className="flex flex-wrap gap-2">
                <SmartReportPDFGenerator
                  report={report}
                  projectName={projectName}
                  dateRange={dateRange}
                  selectedTemplate="executive"
                  editedTemplate={report.templates?.executive || ""}
                />
              </div>
            </div>

            {/* Metrics Summary */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Métricas: {report.metrics.totalMentions} menciones</span>
              <span>•</span>
              <span className="text-green-600">+{report.metrics.positiveCount}</span>
              <span className="text-gray-500">{report.metrics.neutralCount}</span>
              <span className="text-red-600">-{report.metrics.negativeCount}</span>
              {report.metrics.estimatedImpressions > 0 && (
                <>
                  <span>•</span>
                  <span>~{(report.metrics.estimatedImpressions / 1000).toFixed(1)}K impresiones</span>
                  <span>~{(report.metrics.estimatedReach / 1000).toFixed(1)}K alcance</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}