import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MentionInput {
  title?: string | null;
  description?: string | null;
  source_domain?: string | null;
  sentiment?: string | null;
  published_at?: string | null;
  matched_keywords?: string[] | null;
  author?: string | null;
}

interface RequestBody {
  mentions: MentionInput[];
  projectName?: string;
  dateRange?: { from?: string; to?: string };
  filters?: { platform?: string; sentiment?: string; entity?: string; query?: string };
}

const MAX_MENTIONS = 80;

function stratifiedSample(mentions: MentionInput[], target: number): MentionInput[] {
  if (mentions.length <= target) return mentions;
  const buckets: Record<string, MentionInput[]> = {
    positivo: [],
    neutral: [],
    negativo: [],
    unknown: [],
  };
  for (const m of mentions) {
    const key = m.sentiment && buckets[m.sentiment] ? m.sentiment : "unknown";
    buckets[key].push(m);
  }
  const result: MentionInput[] = [];
  const keys = Object.keys(buckets);
  let i = 0;
  while (result.length < target) {
    let added = false;
    for (const k of keys) {
      const idx = Math.floor(i / keys.length);
      if (buckets[k][idx]) {
        result.push(buckets[k][idx]);
        added = true;
        if (result.length >= target) break;
      }
    }
    if (!added) break;
    i += keys.length;
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const mentions = Array.isArray(body.mentions) ? body.mentions : [];

    if (mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay menciones para resumir" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sample = stratifiedSample(mentions, MAX_MENTIONS);

    const positivo = mentions.filter((m) => m.sentiment === "positivo").length;
    const neutral = mentions.filter((m) => m.sentiment === "neutral").length;
    const negativo = mentions.filter((m) => m.sentiment === "negativo").length;
    const sinAnalizar = mentions.filter((m) => !m.sentiment).length;
    const total = mentions.length;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

    const platformCounts: Record<string, number> = {};
    mentions.forEach((m) => {
      const d = (m.source_domain || "desconocido").toLowerCase().replace(/^www\./, "");
      platformCounts[d] = (platformCounts[d] || 0) + 1;
    });
    const topPlatforms = Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([d, c]) => `${d} (${c})`)
      .join(", ");

    const mentionsText = sample
      .map((m, i) => {
        const parts = [
          `[${i + 1}]`,
          `(${m.sentiment ?? "sin analizar"})`,
          m.source_domain ? `${m.source_domain}` : "",
          m.published_at ? `· ${m.published_at.slice(0, 10)}` : "",
          m.author ? `· ${m.author}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        const title = (m.title || "").trim().slice(0, 220);
        const desc = (m.description || "").trim().slice(0, 320);
        return `${parts}\n${title}${desc ? `\n${desc}` : ""}`;
      })
      .join("\n\n");

    const dateRangeStr =
      body.dateRange?.from && body.dateRange?.to
        ? `del ${body.dateRange.from} al ${body.dateRange.to}`
        : "del periodo seleccionado";

    const filtersStr = body.filters
      ? Object.entries(body.filters)
          .filter(([, v]) => v && v !== "__all__")
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ") || "ninguno"
      : "ninguno";

    const systemPrompt = `Eres un analista senior de inteligencia mediática. Produces descripciones ejecutivas en español del entorno de menciones y fuentes, claras, sin markdown ni viñetas, sin emojis, sin frases vacías. Cada párrafo debe estar anclado en datos reales: cifras, nombres de medios, narrativas concretas extraídas de las menciones provistas. Nunca inventes cifras, nombres ni eventos que no aparezcan en el material. NO incluyas recomendaciones, sugerencias ni llamados a la acción: solo describe el entorno observado.`;

    const userPrompt = `Genera una descripción ejecutiva de 3 a 4 párrafos sobre el entorno de menciones del proyecto${
      body.projectName ? ` "${body.projectName}"` : ""
    } ${dateRangeStr}.

Contexto cuantitativo (universo total filtrado: ${total} menciones):
- Sentimiento: ${positivo} positivas (${pct(positivo)}%), ${neutral} neutras (${pct(neutral)}%), ${negativo} negativas (${pct(negativo)}%), ${sinAnalizar} sin analizar (${pct(sinAnalizar)}%).
- Principales fuentes: ${topPlatforms || "n/d"}.
- Filtros activos: ${filtersStr}.

Muestra de hasta ${sample.length} menciones representativas:

${mentionsText}

Estructura los párrafos así:
1. Contexto y volumen: qué se está diciendo y dónde, magnitud del flujo de menciones y fuentes activas.
2. Narrativas dominantes: 2-3 hilos temáticos concretos con ejemplos breves de medios o autores reales que aparezcan en la muestra.
3. Tono del entorno: lectura del balance de sentimiento y, si aparecen, señales de riesgo reputacional observadas (descriptivo, no prescriptivo).
4. Voces o medios destacados: quiénes están moviendo más conversación dentro del periodo.

Reglas estrictas: prosa fluida, sin listas, sin asteriscos, sin encabezados, sin "en conclusión". PROHIBIDO incluir recomendaciones, sugerencias, "se recomienda", "convendría", "deberían", próximos pasos o cualquier llamado a la acción. Máximo 320 palabras. No inventes nada que no esté en la muestra o el contexto.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error", aiResponse.status, errText.slice(0, 400));
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de uso alcanzado, intenta de nuevo en un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Sin créditos disponibles en Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResponse.json();
    const summary: string = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!summary) {
      return new Response(
        JSON.stringify({ error: "La IA no devolvió contenido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        meta: {
          totalMentions: total,
          sampleSize: sample.length,
          sentiment: { positivo, neutral, negativo, sinAnalizar },
          generatedAt: new Date().toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("summarize-mentions error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
