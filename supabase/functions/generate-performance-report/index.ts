// Edge function: generate-performance-report
// Genera narrativa IA contextualizada para reportes de Performance (Marca o Benchmark)
// a partir de perfiles, KPIs y top posts. Devuelve estructura editable.

import { corsHeaders } from "@supabase/supabase-js/cors";

interface PerformanceProfile {
  id: string;
  network: string;
  display_name: string | null;
  profile_id: string;
  is_competitor: boolean;
  is_own_profile: boolean;
}

interface PerformanceKPI {
  fk_profile_id: string;
  followers: number | null;
  follower_growth_percent: number | null;
  engagement_rate: number | null;
  posts_per_day: number | null;
  page_performance_index: number | null;
}

interface PerformanceTopPost {
  fk_profile_id: string;
  network: string;
  post_content: string | null;
  post_url: string | null;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  post_date: string;
}

interface RequestBody {
  reportMode: "brand" | "benchmark";
  clientName: string;
  brandName?: string;
  dateRange: { start: string; end: string; label: string };
  strategicFocus?: string;
  profiles: PerformanceProfile[];
  kpis: PerformanceKPI[];
  topPosts: PerformanceTopPost[];
  // Pre-computed analytics (numbers we trust, not invented by IA)
  analytics: {
    networks: string[];
    avgEngagement: number;
    avgGrowth: number;
    totalFollowers: number;
    bestPerformer: { name: string; network: string; engagement: number } | null;
    fastestGrower: { name: string; network: string; growth: number } | null;
    shareOfVoice: Array<{ name: string; isOwn: boolean; engagementShare: number; followersShare: number }>;
    rankingByEngagement: Array<{ name: string; network: string; engagement: number; isOwn: boolean }>;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const {
      reportMode,
      clientName,
      brandName,
      dateRange,
      strategicFocus,
      profiles,
      kpis,
      topPosts,
      analytics,
    } = body;

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: "Sin perfiles" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isBrand = reportMode === "brand";

    // Build a compact, structured payload for the AI to read
    const profilesSummary = profiles.map((p) => {
      const kpi = kpis.find((k) => k.fk_profile_id === p.id);
      return {
        name: p.display_name || p.profile_id,
        network: p.network,
        role: p.is_competitor ? "competidor" : "marca",
        followers: kpi?.followers ?? null,
        growth_percent: kpi?.follower_growth_percent ?? null,
        engagement_rate: kpi?.engagement_rate ?? null,
        posts_per_day: kpi?.posts_per_day ?? null,
      };
    });

    // Top 5 posts overall by engagement (already filtered by date by the hook)
    const top5Posts = [...topPosts]
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5)
      .map((p) => {
        const profile = profiles.find((pr) => pr.id === p.fk_profile_id);
        return {
          author: profile?.display_name || profile?.profile_id || "—",
          network: p.network,
          date: p.post_date,
          content_preview: (p.post_content || "").substring(0, 220),
          engagement: p.engagement,
          likes: p.likes,
          comments: p.comments,
          shares: p.shares,
          views: p.views,
        };
      });

    const modeBlock = isBrand
      ? `MODO: ANÁLISIS DE MARCA PROPIA (${brandName || clientName}).
Estás analizando EXCLUSIVAMENTE el desempeño en redes sociales de la marca propia. NO menciones competidores, NO compares con "el sector", NO uses frases como "se diferencia de competidores" ni "frente a otras marcas". El foco es:
- Cómo evolucionó la marca en cada red durante el período
- Qué contenido funcionó mejor y por qué
- Salud de las métricas (engagement, crecimiento, frecuencia de publicación)
- Recomendaciones concretas para mejorar el desempeño de ESTA marca`
      : `MODO: BENCHMARK COMPETITIVO (${clientName}).
Estás analizando comparativamente la marca propia vs sus competidores. El foco es:
- Quién lidera en qué red y en qué métrica
- Brechas competitivas concretas (con cifras reales)
- Share of voice y posicionamiento relativo
- Qué hace la competencia que la marca propia debería replicar o evitar
- Recomendaciones para cerrar brechas y aprovechar oportunidades`;

    const focusBlock = strategicFocus?.trim()
      ? `\nENFOQUE ESTRATÉGICO DEL REPORTE (lente con la que debes leer todo):\n${strategicFocus.trim()}\n`
      : "";

    const systemPrompt = `Eres un analista senior de performance en redes sociales para Wizr. Generas reportes ejecutivos en español, claros, accionables y SIN inventar datos.

${modeBlock}
${focusBlock}
REGLAS DURAS:
- USA SOLO los nombres de perfiles, redes y cifras que aparecen en los datos. NUNCA inventes nombres ni números.
- Cada hallazgo debe citar al menos una cifra concreta tomada de los datos (engagement, followers, %, etc.).
- Cada recomendación es ESTRICTAMENTE de comunicación digital (publicar, ajustar formato, frecuencia, plataforma, mensaje). NO recomiendes acciones de producto, RH, legal o áreas internas.
- No uses símbolos de markdown (asteriscos, almohadillas). Texto plano.
- En modo MARCA: prohibido mencionar competidores o "el sector".
- En modo BENCHMARK: usa nombres reales de competidores presentes en los datos.

Devuelve EXCLUSIVAMENTE un JSON válido con esta forma:
{
  "title": "Título corto y específico del reporte",
  "summary": "Resumen ejecutivo de 3-5 oraciones con las cifras más relevantes del período",
  "highlights": [
    { "label": "Etiqueta corta", "value": "Cifra o dato", "context": "Una oración explicando" }
  ],
  "keyFindings": [
    "Hallazgo 1 con cifra concreta",
    "Hallazgo 2..."
  ],
  "recommendations": [
    "Recomendación 1 accionable y digital",
    "Recomendación 2..."
  ],
  "topContentInsight": "Análisis de 2-3 oraciones sobre el patrón del contenido top del período",
  "competitiveInsight": "Solo en BENCHMARK: análisis de 2-3 oraciones sobre posicionamiento competitivo. En MARCA: omitir o cadena vacía.",
  "conclusion": "Cierre ejecutivo de 2-3 oraciones"
}

Mínimos: 4 highlights, 5 keyFindings, 4 recommendations.`;

    const userPrompt = `Cliente: ${clientName}
Período: ${dateRange.label} (${dateRange.start} → ${dateRange.end})

ANALYTICS PRECOMPUTADOS (úsalos como verdad de cifras):
${JSON.stringify(analytics, null, 2)}

PERFILES Y KPIS DEL PERÍODO:
${JSON.stringify(profilesSummary, null, 2)}

TOP 5 CONTENIDOS POR ENGAGEMENT EN EL PERÍODO:
${JSON.stringify(top5Posts, null, 2)}

Genera el reporte siguiendo el JSON especificado.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI Gateway error ${response.status}: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await response.json();
    const rawContent = aiData?.choices?.[0]?.message?.content;
    if (!rawContent) {
      return new Response(JSON.stringify({ error: "Respuesta vacía de la IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = typeof rawContent === "string" ? JSON.parse(rawContent) : rawContent;
    } catch (e) {
      console.error("JSON parse failed:", e, rawContent);
      return new Response(JSON.stringify({ error: "La IA no devolvió JSON válido" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = {
      title: String(parsed.title || `Reporte de Performance — ${clientName}`),
      summary: String(parsed.summary || ""),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      topContentInsight: String(parsed.topContentInsight || ""),
      competitiveInsight: isBrand ? "" : String(parsed.competitiveInsight || ""),
      conclusion: String(parsed.conclusion || ""),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-performance-report error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
