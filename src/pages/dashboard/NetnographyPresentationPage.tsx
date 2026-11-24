import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetnographyStudy } from "@/hooks/useNetnography";

export default function NetnographyPresentationPage() {
  const { studyId } = useParams<{ studyId: string }>();
  const navigate = useNavigate();
  const { data: study, isLoading } = useNetnographyStudy(studyId);
  const completed = study?.analyses?.find((a) => a.status === "completado");
  const res = completed?.result;

  if (isLoading || !study || !res) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {isLoading ? "Cargando presentación..." : "Este estudio aún no tiene un análisis completado."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white print:bg-white print:p-0 print:text-slate-900">
      <style>{`@media print { @page { size: 1920px 1080px; margin: 0; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mx-auto mb-6 flex max-w-6xl items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/netnografia/${study.id}`)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Volver al estudio
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          Exportar PDF (16:9)
        </Button>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 print:max-w-none print:space-y-0">
        {/* Lámina 1: Portada & Hallazgo Principal */}
        <section className="flex min-h-[540px] flex-col justify-between rounded-xl border border-white/10 bg-slate-900 p-10 print:h-[1080px] print:break-after-page print:rounded-none print:border-0 print:bg-white">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
            <span>WIZR · Estudio Netnográfico {study.folio}</span>
            <span>{res.methodology?.generated_at?.slice(0, 10)}</span>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight">{study.title}</h1>
            <p className="text-xl text-sky-400 print:text-sky-700">{res.headline}</p>
            <p className="max-w-3xl text-sm text-slate-300 print:text-slate-600">{res.executive_summary}</p>
          </div>
          <div className="grid grid-cols-4 gap-4 border-t border-white/10 pt-6 print:border-slate-200">
            <div>
              <p className="text-xs text-slate-400">Registros</p>
              <p className="text-2xl font-bold">{res.total_comments.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Muestra efectiva (n_ef)</p>
              <p className="text-2xl font-bold">{res.effective_sample_size}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Temperatura</p>
              <p className="text-2xl font-bold">{res.temperature.score}/100</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Sentimiento (- / = / +)</p>
              <p className="text-2xl font-bold">
                {res.sentiment.negative}% / {res.sentiment.neutral}% / {res.sentiment.positive}%
              </p>
            </div>
          </div>
        </section>

        {/* Lámina 2: Narrativas & Postura */}
        <section className="flex min-h-[540px] flex-col justify-between rounded-xl border border-white/10 bg-slate-900 p-10 print:h-[1080px] print:break-after-page print:rounded-none print:border-0 print:bg-white">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Narrativas Dominantes (±95% MoE)</p>
            <h2 className="mt-1 text-2xl font-bold">Distribución de Encuadres</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {res.narratives.slice(0, 6).map((n) => (
              <div key={n.id} className="rounded-lg border border-white/10 p-4 print:border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{n.title}</span>
                  <span className="font-bold text-sky-400 print:text-sky-700">
                    {n.share}% ± {n.moe}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300 print:text-slate-600">{n.description}</p>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400">
            Postura frente a {res.stance?.target || study.title}: Favor {res.stance?.favor.share}% (±{res.stance?.favor.moe}%) · Contra {res.stance?.contra.share}% (±{res.stance?.contra.moe}%)
          </div>
        </section>

        {/* Lámina 3: Fuentes & Metodología */}
        <section className="flex min-h-[540px] flex-col justify-between rounded-xl border border-white/10 bg-slate-900 p-10 print:h-[1080px] print:rounded-none print:border-0 print:bg-white">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Anexo Metodológico</p>
            <h2 className="mt-1 text-2xl font-bold">Fuentes Analizadas & Alcance</h2>
          </div>
          <div className="space-y-2 text-xs">
            {(res.methodology?.sources || []).map((s, i) => (
              <div key={i} className="flex items-center justify-between border-b border-white/10 py-2 print:border-slate-200">
                <a href={s.url} target="_blank" rel="noreferrer" className="truncate text-sky-400 underline print:text-sky-700">
                  [{s.platform.toUpperCase()}] {s.url}
                </a>
                <span className="shrink-0 font-semibold">{s.collected} registros</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Alcance: cifras válidas para la conversación digital del universo definido (95% de confianza); no representan encuesta poblacional.
          </p>
        </section>
      </div>
    </div>
  );
}
