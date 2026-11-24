import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NetnographyMethodologyPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/netnografia")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-5 w-5 text-primary" />
            Metodología Híbrida de Netnografía v2.1
          </h1>
          <p className="text-sm text-muted-foreground">
            Marco científico y operativo integrado en Wizr (Muestreo representativo, codificación por capas y validación humana).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Las 7 Fases del Método</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p><strong>1. Diseño:</strong> Ficha del caso con pregunta central, universo de inferencia en una frase, hipótesis refutable y nivel de riesgo ético.</p>
          <p><strong>2. Mapeo de campo:</strong> Inventario de comunidades evaluadas por relevancia, actividad, interactividad, sustancia, heterogeneidad y riqueza.</p>
          <p><strong>3. Captura:</strong> Extracción directa vía conectores nativos por URL o importación estandarizada desde Fanpage Karma (Excel/CSV).</p>
          <p><strong>4. Limpieza y autenticidad:</strong> Seudonimización automática (<code className="text-foreground">U-0001</code>), marcado de cuentas sospechosas y copias coordinadas con cálculo dual (con y sin ellas).</p>
          <p><strong>5. Motor de análisis por capas:</strong> Muestreo estratificado (censo &lt;20,000 o fórmula finita con pesos <code className="text-foreground">w_h</code> y <code className="text-foreground">n_ef</code>), codebook versionado, encuadre, actores, emoción (1–5) y términos émicos.</p>
          <p><strong>6. Validación humana ciega:</strong> Submuestra aleatoria de 150–200 registros evaluada sin ver la predicción de IA, midiendo <strong>Kappa de Cohen (≥0.70)</strong> y <strong>Alfa de Krippendorff (≥0.80)</strong>.</p>
          <p><strong>7. Entregable v2.1:</strong> Informe con matriz conjunta, contraste con fuentes públicas, verbatims seudonimizados, anexo metodológico y Deck 16:9 exportable a PDF.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Alcance y Garantías Estadísticas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Margen de error al 95% de confianza calculado sobre el tamaño efectivo <code className="text-foreground">n_ef</code>.</p>
          <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Las cifras aplican exclusivamente a la conversación digital pública del universo definido, no a la población general.</p>
        </CardContent>
      </Card>
    </div>
  );
}
