import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Radar, RefreshCw, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateNetnographyStudy, useViralSignals } from "@/hooks/useNetnography";
import { useToast } from "@/hooks/use-toast";

export default function NetnographySignalsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [geo, setGeo] = useState("MX");
  const { data: signals = [], isLoading, refetch, isFetching } = useViralSignals(geo);
  const createStudy = useCreateNetnographyStudy();

  const handleStartStudyFromSignal = async (title: string) => {
    try {
      const res = await createStudy.mutateAsync({
        kind: "deep",
        title: `Estudio: ${title}`,
        topic: title,
        stance_target: title,
        central_question: `¿Cómo reacciona la conversación digital frente a "${title}"?`,
      });
      toast({ title: "Estudio creado", description: "Agrega las URLs de las publicaciones clave." });
      if (res.study?.id) navigate(`/dashboard/netnografia/${res.study.id}`);
    } catch {
      toast({ title: "Error al crear estudio", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/netnografia")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Radar className="h-5 w-5 text-primary" />
              Señales Virales (Newsloom)
            </h1>
            <p className="text-sm text-muted-foreground">
              Tendencias en tiempo real de Google Trends, Bluesky y YouTube para detectar conversaciones emergentes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={geo} onValueChange={setGeo}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MX">México</SelectItem>
              <SelectItem value="US">Estados Unidos</SelectItem>
              <SelectItem value="ES">España</SelectItem>
              <SelectItem value="CO">Colombia</SelectItem>
              <SelectItem value="AR">Argentina</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Consultando señales virales...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {signals.map((sig) => (
            <Card key={sig.key} className="flex flex-col justify-between">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(sig.signals.map((s) => s.platform))).map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px] uppercase">
                        {p.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-primary">Alcance {Math.round(sig.reach * 100)}%</span>
                </div>
                <CardTitle className="mt-1 text-base leading-snug">{sig.title}</CardTitle>
                {sig.description && <CardDescription className="line-clamp-2 text-xs">{sig.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                {sig.news.length > 0 && (
                  <div className="space-y-1">
                    {sig.news.slice(0, 2).map((n, i) => (
                      <a
                        key={i}
                        href={n.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{n.outlet ? `${n.outlet}: ` : ""}{n.title}</span>
                      </a>
                    ))}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => handleStartStudyFromSignal(sig.title)}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Abrir Estudio Netnográfico
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
