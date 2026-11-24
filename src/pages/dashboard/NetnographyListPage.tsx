import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Plus,
  Zap,
  Layers,
  Trash2,
  ArrowRight,
  Radar,
  BookOpen,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateNetnographyStudy,
  useDeleteNetnographyStudy,
  useNetnographyStudies,
} from "@/hooks/useNetnography";
import { useProject } from "@/contexts/ProjectContext";
import api from "@/lib/api";

export default function NetnographyListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { projects } = useProject();
  const { data: studies = [], isLoading } = useNetnographyStudies();
  const createStudy = useCreateNetnographyStudy();
  const deleteStudy = useDeleteNetnographyStudy();

  const [quickUrl, setQuickUrl] = useState("");
  const [quickTopic, setQuickTopic] = useState("");
  const [isLaunchingQuick, setIsLaunchingQuick] = useState(false);

  const [openDeep, setOpenDeep] = useState(false);
  const [deepForm, setDeepForm] = useState({
    title: "",
    topic: "",
    central_question: "",
    requester: "",
    decision_enabled: "",
    universe_definition: "",
    hypothesis: "",
    ethical_risk: "bajo",
    stance_target: "",
    project_id: "none",
    urlsText: "",
    max_comments: 500,
  });

  const handleQuickPulse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setIsLaunchingQuick(true);
    try {
      const res = await createStudy.mutateAsync({
        kind: "quick",
        title: quickTopic.trim() || "Pulso rápido de conversación",
        topic: quickTopic.trim(),
        urls: [quickUrl.trim()],
        max_comments: 500,
        include_replies: true,
      });
      const studyId = res.study?.id;
      if (studyId) {
        await api.post(`/netnography/studies/${studyId}/extract`, { action: "start" }).catch(() => null);
        toast({ title: "Pulso iniciado", description: "Extrayendo comentarios de la publicación..." });
        navigate(`/dashboard/netnografia/${studyId}`);
      }
    } catch (err: any) {
      toast({
        title: "No se pudo iniciar el pulso",
        description: err?.response?.data?.error || err?.message || "Verifica la URL ingresada.",
        variant: "destructive",
      });
    } finally {
      setIsLaunchingQuick(false);
    }
  };

  const handleCreateDeep = async (e: React.FormEvent) => {
    e.preventDefault();
    const urls = deepForm.urlsText
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);

    try {
      const res = await createStudy.mutateAsync({
        kind: "deep",
        title: deepForm.title,
        topic: deepForm.topic,
        central_question: deepForm.central_question,
        requester: deepForm.requester,
        decision_enabled: deepForm.decision_enabled,
        universe_definition: deepForm.universe_definition,
        hypothesis: deepForm.hypothesis,
        ethical_risk: deepForm.ethical_risk,
        stance_target: deepForm.stance_target,
        project_id: deepForm.project_id === "none" ? null : deepForm.project_id,
        urls,
        max_comments: Number(deepForm.max_comments) || 500,
      });
      setOpenDeep(false);
      toast({ title: "Estudio creado", description: `Folio ${res.study?.folio || ""}` });
      if (res.study?.id) navigate(`/dashboard/netnografia/${res.study.id}`);
    } catch (err: any) {
      toast({
        title: "Error al crear estudio",
        description: err?.response?.data?.error || err?.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="section-label flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Netnografía Híbrida v2.1
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Estudios Netnográficos</h1>
          <p className="text-sm text-muted-foreground">
            Estudios independientes o vinculados a proyecto, con muestreo representativo, validación ciega y Deck 16:9.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/netnografia/senales")}>
            <Radar className="mr-1.5 h-4 w-4" />
            Señales Virales
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/netnografia/metodologia")}>
            <BookOpen className="mr-1.5 h-4 w-4" />
            Metodología v2.1
          </Button>

          <Dialog open={openDeep} onOpenChange={setOpenDeep}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nuevo Estudio Profundo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Ficha del Caso · Estudio Netnográfico v2.1</DialogTitle>
                <DialogDescription>
                  Define la pregunta cultural, universo de inferencia y fuentes iniciales (puedes dejarlo independiente o vincularlo a un proyecto).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateDeep} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Título del estudio *</Label>
                    <Input
                      required
                      value={deepForm.title}
                      onChange={(e) => setDeepForm({ ...deepForm, title: e.target.value })}
                      placeholder="Ej. Percepción de movilidad en Puebla"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tema / Target de postura</Label>
                    <Input
                      value={deepForm.stance_target}
                      onChange={(e) => setDeepForm({ ...deepForm, stance_target: e.target.value, topic: e.target.value })}
                      placeholder="Ej. Nuevo sistema de transporte"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Pregunta central (una sola línea)</Label>
                  <Input
                    value={deepForm.central_question}
                    onChange={(e) => setDeepForm({ ...deepForm, central_question: e.target.value })}
                    placeholder="¿Cómo construyen los usuarios la narrativa sobre...?"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Universo de inferencia ([contenido] + [tema] + [territorio] + [redes] + [ventana])</Label>
                  <Input
                    value={deepForm.universe_definition}
                    onChange={(e) => setDeepForm({ ...deepForm, universe_definition: e.target.value })}
                    placeholder="Comentarios públicos en FB, TikTok y X del 1 al 30 de nov..."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Solicitante</Label>
                    <Input
                      value={deepForm.requester}
                      onChange={(e) => setDeepForm({ ...deepForm, requester: e.target.value })}
                      placeholder="Área / cliente"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Riesgo ético</Label>
                    <Select
                      value={deepForm.ethical_risk}
                      onValueChange={(v) => setDeepForm({ ...deepForm, ethical_risk: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bajo">Bajo</SelectItem>
                        <SelectItem value="medio">Medio</SelectItem>
                        <SelectItem value="alto">Alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Proyecto (opcional)</Label>
                    <Select
                      value={deepForm.project_id}
                      onValueChange={(v) => setDeepForm({ ...deepForm, project_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Independiente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Estudio independiente</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Hipótesis de trabajo (para intentar refutar)</Label>
                  <Input
                    value={deepForm.hypothesis}
                    onChange={(e) => setDeepForm({ ...deepForm, hypothesis: e.target.value })}
                    placeholder="Lo que se espera encontrar antes de iniciar..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>URLs de publicaciones (una por línea: IG, TikTok, YouTube, FB o X)</Label>
                  <Textarea
                    rows={4}
                    value={deepForm.urlsText}
                    onChange={(e) => setDeepForm({ ...deepForm, urlsText: e.target.value })}
                    placeholder="https://www.instagram.com/p/...\nhttps://x.com/usuario/status/..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpenDeep(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createStudy.isPending}>
                    {createStudy.isPending ? "Creando..." : "Crear Estudio"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Pulso Rápido */}
      <Card className="border-primary/25 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Pulso Rápido de Conversación
          </CardTitle>
          <CardDescription>
            Pega el enlace de una publicación pública (Instagram, TikTok, YouTube, Facebook o X) para extraer comentarios y generar lectura netnográfica inmediata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuickPulse} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="https://x.com/... o https://www.instagram.com/p/... o https://www.tiktok.com/..."
              className="flex-1"
              disabled={isLaunchingQuick}
            />
            <Input
              value={quickTopic}
              onChange={(e) => setQuickTopic(e.target.value)}
              placeholder="Tema o pregunta (opcional)"
              className="sm:w-64"
              disabled={isLaunchingQuick}
            />
            <Button type="submit" disabled={isLaunchingQuick || !quickUrl.trim()} className="gap-1.5 shrink-0">
              {isLaunchingQuick ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Analizar Pulso
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de Estudios */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Cargando estudios...</div>
      ) : studies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Layers className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium">Aún no tienes estudios netnográficos</p>
            <p className="text-xs text-muted-foreground">
              Lanza un Pulso Rápido arriba o crea un Estudio Profundo con Ficha del Caso v2.1.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {studies.map((s) => {
            const totalComments = s.sources.reduce((acc, src) => acc + (src.comment_count || 0), 0);
            const latestAnalysis = s.analyses[0];
            return (
              <Card
                key={s.id}
                className="group cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
                onClick={() => navigate(`/dashboard/netnografia/${s.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.folio && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {s.folio}
                          </Badge>
                        )}
                        <Badge variant={s.kind === "quick" ? "secondary" : "default"} className="text-[10px]">
                          {s.kind === "quick" ? "Pulso Rápido" : "Estudio Profundo"}
                        </Badge>
                        {!s.project_id && (
                          <Badge variant="outline" className="text-[10px]">
                            Independiente
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-semibold leading-snug">{s.title}</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStudy.mutate(s.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {latestAnalysis?.result?.headline ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {latestAnalysis.result.headline}
                    </p>
                  ) : s.central_question ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.central_question}</p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {totalComments.toLocaleString()} registros · {s.sources.length} fuentes
                    </span>
                    <span className="flex items-center gap-1 font-medium text-primary">
                      {latestAnalysis?.status === "completado"
                        ? "Ver informe"
                        : latestAnalysis?.status === "procesando"
                        ? `Procesando (${latestAnalysis.stage})`
                        : "Abrir"}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
