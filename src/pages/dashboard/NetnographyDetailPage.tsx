import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Presentation,
  Upload,
  Plus,
  CheckCircle2,
  ShieldAlert,
  BookOpen,
  Sparkles,
  ExternalLink,
  Save,
  Loader2,
  Download,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useNetnographyStudy, useValidationQueue } from "@/hooks/useNetnography";
import api from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function NetnographyDetailPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: study, isLoading } = useNetnographyStudy(studyId);
  const { data: validationData, refetch: refetchValidation } = useValidationQueue(studyId);

  const [newUrl, setNewUrl] = useState("");
  const [organicOnly, setOrganicOnly] = useState(false);
  const [diaryText, setDiaryText] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const latestAnalysis = study?.analyses?.[0];
  const completedAnalysis = study?.analyses?.find((a) => a.status === "completado");

  useEffect(() => {
    if (completedAnalysis?.field_diary) {
      setDiaryText(completedAnalysis.field_diary);
    }
  }, [completedAnalysis?.id]);

  // Polling secuencial si hay fuentes extrayendo
  useEffect(() => {
    if (!studyId || !study?.sources.some((s) => s.status === "extrayendo" || s.status === "iniciando")) return;
    const timer = setTimeout(async () => {
      await api.post(`/netnography/studies/${studyId}/extract`, { action: "sync" }).catch(() => null);
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
    }, 4500);
    return () => clearTimeout(timer);
  }, [study, studyId, qc]);

  // Polling secuencial si el análisis está procesando
  useEffect(() => {
    if (!studyId || latestAnalysis?.status !== "procesando") return;
    const timer = setTimeout(async () => {
      await api
        .post(`/netnography/studies/${studyId}/analyze`, { analysisId: latestAnalysis.id })
        .catch(() => null);
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
    }, 3000);
    return () => clearTimeout(timer);
  }, [latestAnalysis, studyId, qc]);

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || !studyId) return;
    setIsBusy(true);
    try {
      await api.post(`/netnography/studies/${studyId}/sources`, { url: newUrl.trim() });
      setNewUrl("");
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
      toast({ title: "Fuente agregada" });
    } catch (err: any) {
      toast({ title: "URL inválida", description: err?.response?.data?.error, variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !studyId) return;
    setIsBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);
      const mapped = rawRows.slice(0, 5000).map((r, i) => ({
        id: r.id || r.ID || `row-${i}`,
        author: r.Author || r.author || r.Profile || r.Perfil || r.Usuario || "anonimo",
        text: r.Message || r.Text || r.Contenido || r.Texto || r.Description || r.Comment || "",
        platform: r.Network || r.Platform || r.Red || "fanpage_karma",
        published_at: r.Date || r.Fecha || r.Created || null,
        likes: Number(r.Likes || r.Reacciones || 0) || 0,
        replies: Number(r.Comments || r.Comentarios || 0) || 0,
        shares: Number(r.Shares || r.Compartidos || 0) || 0,
        url: r.Link || r.URL || r.Url || null,
      }));
      const { data } = await api.post(`/netnography/studies/${studyId}/import`, {
        sourceLabel: file.name,
        rows: mapped,
      });
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
      toast({ title: "Corpus importado", description: `${data.imported} registros cargados y seudonimizados.` });
    } catch (err: any) {
      toast({ title: "Error al importar archivo", description: err?.message, variant: "destructive" });
    } finally {
      setIsBusy(false);
      e.target.value = "";
    }
  };

  const handleStartExtraction = async () => {
    if (!studyId) return;
    setIsBusy(true);
    try {
      await api.post(`/netnography/studies/${studyId}/extract`, { action: "start" });
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
      toast({ title: "Extracción iniciada" });
    } catch (err: any) {
      toast({ title: "Error al iniciar extracción", description: err?.response?.data?.error, variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!studyId) return;
    setIsBusy(true);
    try {
      await api.post(`/netnography/studies/${studyId}/analyze`, { startNew: true });
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
      toast({ title: "Análisis netnográfico iniciado", description: "Ejecutando etapas en segundo plano..." });
    } catch (err: any) {
      toast({ title: "No se pudo iniciar análisis", description: err?.response?.data?.error, variant: "destructive" });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveManualLabel = async (labelId: string, patch: Record<string, string>) => {
    try {
      await api.patch(`/netnography/labels/${labelId}`, patch);
      refetchValidation();
      toast({ title: "Etiqueta validada" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  };

  const handleRecompute = async () => {
    if (!completedAnalysis?.id) return;
    setIsBusy(true);
    try {
      await api.post(`/netnography/analyses/${completedAnalysis.id}/recompute`);
      qc.invalidateQueries({ queryKey: ["netnography-study", studyId] });
      refetchValidation();
      toast({ title: "Informe recalculado con validación humana" });
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveDiary = async () => {
    if (!completedAnalysis?.id) return;
    await api.patch(`/netnography/analyses/${completedAnalysis.id}/diary`, { field_diary: diaryText });
    toast({ title: "Diario de campo guardado" });
  };

  const handleDownloadInfographic = async () => {
    if (!studyId) return;
    try {
      const { data: svgText } = await api.get<string>(`/netnography/studies/${studyId}/infographic.svg`, {
        responseType: "text",
      });
      const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${study?.folio || "infografia-netnografia"}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error al descargar infografía", variant: "destructive" });
    }
  };

  if (isLoading || !study) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Cargando estudio...</div>;
  }

  const totalComments = study.sources.reduce((acc, s) => acc + (s.comment_count || 0), 0);
  const res = completedAnalysis?.result;
  const activeSentiment = organicOnly && res?.organicOnly ? res.organicOnly.sentiment : res?.sentiment;
  const activeNarratives = organicOnly && res?.organicOnly ? res.organicOnly.narratives : res?.narratives;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/netnografia")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {study.folio && (
                <Badge variant="outline" className="font-mono text-xs">
                  {study.folio}
                </Badge>
              )}
              <Badge variant={study.kind === "quick" ? "secondary" : "default"}>
                {study.kind === "quick" ? "Pulso Rápido" : "Estudio Profundo"}
              </Badge>
              <Badge variant="outline">Riesgo ético: {study.ethical_risk}</Badge>
            </div>
            <h1 className="mt-1 text-2xl font-bold">{study.title}</h1>
            {study.central_question && <p className="text-sm text-muted-foreground">{study.central_question}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleStartExtraction} disabled={isBusy}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Extraer URLs ({totalComments})
          </Button>
          <Button
            size="sm"
            onClick={handleRunAnalysis}
            disabled={isBusy || totalComments === 0 || latestAnalysis?.status === "procesando"}
          >
            {latestAnalysis?.status === "procesando" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-4 w-4" />
            )}
            {latestAnalysis?.status === "procesando"
              ? `Etapa: ${latestAnalysis.stage}`
              : completedAnalysis
              ? "Re-analizar"
              : "Ejecutar Análisis IA"}
          </Button>
          {completedAnalysis && (
            <>
              <Button variant="outline" size="sm" onClick={handleDownloadInfographic}>
                <Download className="mr-1.5 h-4 w-4" />
                Infografía SVG
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/dashboard/netnografia/${study.id}/presentacion`)}
              >
                <Presentation className="mr-1.5 h-4 w-4" />
                Deck 16:9 / PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue={completedAnalysis ? "report" : "sources"}>
        <TabsList>
          <TabsTrigger value="report">Informe Netnográfico v2.1</TabsTrigger>
          <TabsTrigger value="sources">Fuentes & Muestreo ({study.sources.length})</TabsTrigger>
          <TabsTrigger value="validation">
            Revisión Manual ({validationData?.metrics?.reviewedCount || 0}/{validationData?.items?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="diary">Diario de Campo</TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: INFORME */}
        <TabsContent value="report" className="space-y-6 pt-4">
          {!res ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {latestAnalysis?.status === "procesando"
                  ? `Procesando etapa "${latestAnalysis.stage}" (${latestAnalysis.batches_done}/${latestAnalysis.batches_total} lotes)...`
                  : "Extrae o importa comentarios y presiona 'Ejecutar Análisis IA' para generar el informe."}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Control Con/Sin Cuentas Marcadas */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 text-sm">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  <span>
                    Autenticidad: <strong>{res.authenticity?.organic || 0}</strong> orgánicos ·{" "}
                    <strong>{res.authenticity?.suspicious || 0}</strong> sospechosas ·{" "}
                    <strong>{res.authenticity?.coordinated || 0}</strong> copias coordinadas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="organic-only" checked={organicOnly} onCheckedChange={setOrganicOnly} />
                  <Label htmlFor="organic-only" className="text-xs font-medium">
                    Excluir cuentas marcadas
                  </Label>
                </div>
              </div>

              {/* Hallazgo Principal */}
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {res.headline}
                  </CardTitle>
                  <CardDescription>{res.executive_summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-md bg-background p-3">
                    <p className="text-xs text-muted-foreground">Temperatura</p>
                    <p className="text-xl font-bold">
                      {res.temperature.score}/100 · {res.temperature.label}
                    </p>
                  </div>
                  <div className="rounded-md bg-background p-3">
                    <p className="text-xs text-muted-foreground">Sentimiento</p>
                    <p className="text-sm font-semibold">
                      +{activeSentiment?.positive}% / ={activeSentiment?.neutral}% / -{activeSentiment?.negative}%
                    </p>
                  </div>
                  <div className="rounded-md bg-background p-3">
                    <p className="text-xs text-muted-foreground">Postura ({res.stance?.target || "Tema"})</p>
                    <p className="text-sm font-semibold">
                      Favor {res.stance?.favor.share}% (±{res.stance?.favor.moe}%) · Contra {res.stance?.contra.share}%
                    </p>
                  </div>
                  <div className="rounded-md bg-background p-3">
                    <p className="text-xs text-muted-foreground">Muestra / n_ef</p>
                    <p className="text-xl font-bold">
                      {res.analyzed_comments} <span className="text-xs font-normal">(n_ef={res.effective_sample_size})</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Narrativas */}
              <div className="grid gap-4 md:grid-cols-2">
                {(activeNarratives || []).map((n) => (
                  <Card key={n.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{n.id}</Badge>
                        <span className="text-sm font-bold text-primary">
                          {n.share}% ± {n.moe}%
                        </span>
                      </div>
                      <CardTitle className="text-base">{n.title}</CardTitle>
                      <CardDescription>{n.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {n.framing && (
                        <div className="rounded bg-muted/40 p-2">
                          <strong>Encuadre:</strong> {n.framing.problema} → {n.framing.causa} → {n.framing.juicio}
                        </div>
                      )}
                      {n.examples.slice(0, 1).map((ex, i) => (
                        <blockquote key={i} className="border-l-2 border-primary/40 pl-2 italic text-muted-foreground">
                          “{ex.text.slice(0, 160)}” — {ex.author || "U-0001"} ({ex.platform})
                        </blockquote>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Lenguaje Émico & Contexto de Prensa (Newsloom) */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Lenguaje Nativo / Émico</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {res.emic_terms.length === 0 ? (
                      <p className="text-muted-foreground">Sin términos émicos registrados.</p>
                    ) : (
                      res.emic_terms.map((t, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 border-b pb-1.5">
                          <div>
                            <span className="font-semibold">“{t.term}”</span>: {t.meaning}
                          </div>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {t.recommendation}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detonantes de Prensa (Contexto Newsloom)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {(res.news_context || []).length === 0 ? (
                      <p className="text-muted-foreground">Sin noticias asociadas en el periodo.</p>
                    ) : (
                      res.news_context!.map((nc, i) => (
                        <a
                          key={i}
                          href={nc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            <strong>{nc.outlet}:</strong> {nc.title}
                          </span>
                        </a>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* PESTAÑA 2: FUENTES Y MUESTREO */}
        <TabsContent value="sources" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Agregar URL de publicación</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddUrl} className="flex gap-2">
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.instagram.com/p/..."
                  />
                  <Button type="submit" size="sm" disabled={isBusy}>
                    <Plus className="mr-1 h-4 w-4" />
                    Agregar
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Importar Excel/CSV (Fanpage Karma)</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-2.5 text-xs hover:bg-muted/40">
                  <Upload className="h-4 w-4" />
                  <span>Seleccionar archivo .xlsx o .csv</span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
                </label>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="divide-y p-0">
              {study.sources.map((src) => (
                <div key={src.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase text-[10px]">
                        {src.platform}
                      </Badge>
                      <Badge variant={src.status === "extraida" ? "default" : "secondary"} className="text-[10px]">
                        {src.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{src.url}</p>
                  </div>
                  <div className="text-right text-xs font-semibold">
                    {src.comment_count} / {src.max_comments} registros
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA 3: REVISIÓN MANUAL CIEGA */}
        <TabsContent value="validation" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">Validación Humana Ciega (Paso 9 v2.1)</CardTitle>
                <CardDescription>
                  Etiqueta sin ver la predicción de la IA. Umbrales: Kappa ≥ 0.70, Alfa de Krippendorff ≥ 0.80.
                </CardDescription>
              </div>
              <Button size="sm" onClick={handleRecompute} disabled={isBusy || !completedAnalysis}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Recalcular Kappa e Informe
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <div className="rounded border p-3 text-xs">
                <span className="text-muted-foreground">Revisados</span>
                <p className="text-lg font-bold">{validationData?.metrics?.reviewedCount ?? 0}</p>
              </div>
              <div className="rounded border p-3 text-xs">
                <span className="text-muted-foreground">Acuerdo %</span>
                <p className="text-lg font-bold">{validationData?.metrics?.sentimentAgreement ?? "—"}%</p>
              </div>
              <div className="rounded border p-3 text-xs">
                <span className="text-muted-foreground">Kappa de Cohen</span>
                <p className="text-lg font-bold">{validationData?.metrics?.sentimentKappa ?? "—"}</p>
              </div>
              <div className="rounded border p-3 text-xs">
                <span className="text-muted-foreground">Alfa de Krippendorff</span>
                <p className="text-lg font-bold">{validationData?.metrics?.sentimentAlpha ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {(validationData?.items || []).slice(0, 30).map((item: any) => (
              <Card key={item.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {item.comment.author_alias} · {item.comment.source.platform}
                    </span>
                    {item.reviewed_at && (
                      <Badge variant="outline" className="gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Validado (IA: {item.ai_sentiment} / {item.ai_stance})
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{item.comment.text}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={item.human_sentiment || ""}
                      onValueChange={(v) => handleSaveManualLabel(item.id, { human_sentiment: v })}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Sentimiento..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="positive">Positivo</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="negative">Negativo</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={item.human_stance || ""}
                      onValueChange={(v) => handleSaveManualLabel(item.id, { human_stance: v })}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs">
                        <SelectValue placeholder="Postura..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="favor">A favor</SelectItem>
                        <SelectItem value="contra">En contra</SelectItem>
                        <SelectItem value="ambigua">Ambigua</SelectItem>
                        <SelectItem value="no_aplica">No aplica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* PESTAÑA 4: DIARIO DE CAMPO */}
        <TabsContent value="diary" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Diario de Campo & Saturación Teórica
              </CardTitle>
              <CardDescription>
                Registra observaciones de lectura profunda de hilos y el lote donde se alcanzó la saturación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={8}
                value={diaryText}
                onChange={(e) => setDiaryText(e.target.value)}
                placeholder="Notas etnográficas de inmersión..."
              />
              <Button size="sm" onClick={handleSaveDiary} disabled={!completedAnalysis}>
                <Save className="mr-1.5 h-4 w-4" />
                Guardar Diario
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
