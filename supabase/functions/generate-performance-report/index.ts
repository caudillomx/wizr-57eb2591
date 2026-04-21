// Edge function: generate-performance-report
// Genera narrativa IA contextualizada para reportes de Performance (Marca o Benchmark)
// a partir de perfiles, KPIs y top posts. Devuelve estructura editable.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    rankingByEngagement: Array<{ name: string; network: string; engagement: number; isOwn: boolean; hasData?: boolean }>;
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

    // ── Pre-flag automatic findings the AI MUST cover (computed, not invented) ──
    const ownProfiles = profiles.filter((p) => !p.is_competitor);
    const competitorProfiles = profiles.filter((p) => p.is_competitor);
    const ownIds = new Set(ownProfiles.map((p) => p.id));
    const ownInTop5 = top5Posts.length === 0
      ? null
      : [...topPosts]
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 5)
          .filter((p) => {
            const prof = profiles.find((pr) => pr.id === p.fk_profile_id);
            return prof && !prof.is_competitor;
          }).length;

    const profilesWithoutEng = profilesSummary.filter(
      (p) => p.engagement_rate == null || p.engagement_rate <= 0,
    ).length;

    const negativeGrowth = profilesSummary
      .filter((p) => p.growth_percent != null && p.growth_percent < 0)
      .map((p) => `${p.name} (${p.network}): ${p.growth_percent?.toFixed(2)}%`);

    const lowFrequency = profilesSummary
      .filter((p) => p.posts_per_day != null && p.posts_per_day < 0.3)
      .map((p) => `${p.name} (${p.network}): ${p.posts_per_day?.toFixed(2)} posts/día`);

    const autoFlags = {
      own_posts_in_top5: ownInTop5,
      total_top5: top5Posts.length,
      own_profiles_count: ownProfiles.length,
      competitor_profiles_count: competitorProfiles.length,
      profiles_without_engagement: profilesWithoutEng,
      profiles_with_negative_growth: negativeGrowth,
      profiles_with_low_frequency: lowFrequency,
    };

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
      ? `\nENFOQUE ESTRATÉGICO DEL REPORTE (lente con la que debes leer todo, anclar al menos 2 hallazgos y 2 recomendaciones a este enfoque):\n${strategicFocus.trim()}\n`
      : "";

    const autoFlagsBlock = `\nSEÑALES AUTOMÁTICAS DETECTADAS (debes incorporarlas como hallazgos concretos cuando apliquen):
${JSON.stringify(autoFlags, null, 2)}

REGLAS DE INCORPORACIÓN OBLIGATORIA:
${!isBrand && ownInTop5 === 0 && top5Posts.length > 0
  ? `- HALLAZGO CRÍTICO: ningún post de la marca propia aparece en el Top 5 del período. Debe ser uno de los primeros 2 hallazgos.\n`
  : ""}
${profilesWithoutEng > 0
  ? `- ${profilesWithoutEng} perfil(es) sin datos de engagement en el período. Debes mencionarlo explícitamente como limitación o hallazgo de cobertura.\n`
  : ""}
${negativeGrowth.length > 0
  ? `- ${negativeGrowth.length} perfil(es) con crecimiento negativo. Debe haber al menos 1 hallazgo y 1 recomendación al respecto.\n`
  : ""}
${lowFrequency.length > 0
  ? `- ${lowFrequency.length} perfil(es) con frecuencia <0.3 posts/día. Debe haber 1 recomendación específica de cadencia.\n`
  : ""}`;

    const systemPrompt = `Eres el analista senior de performance en redes sociales de Wizr. Escribes con voz editorial: cada frase aporta una decisión, una cifra o una implicación. Nada decorativo, nada genérico.

${modeBlock}
${focusBlock}
${autoFlagsBlock}
REGLAS DURAS DE DATOS:
- USA SOLO los nombres de perfiles, redes y cifras que aparecen en los datos. NUNCA inventes nombres, métricas, porcentajes ni perfiles.
- TODA cifra debe llevar UNIDAD explícita: engagement como "X.XX%", crecimiento como "+X.XX%" o "-X.XX%", followers como "X,XXX seguidores" o "X.XK", posts como "X.X posts/día", interacciones absolutas como "X likes" o "X comentarios".
- NUNCA escribas paréntesis al estilo "(BBVA México, instagram)". En su lugar usa: "BBVA México en Instagram" o "Banamex (TikTok)" SOLO con la red en mayúscula correcta.
- El "summary" debe abrir citando la cifra más relevante del período (ej. "X% de engagement", "Y nuevos seguidores", "Z posts") y nombrar al perfil/red protagonista, además de explicitar qué significa para ${clientName}.
- La "conclusion" debe cerrar con una lectura accionable para ${clientName}, citando al menos 1 cifra y 1 perfil/red concretos.
- Cada hallazgo cita al menos UNA cifra concreta + UNIDAD + nombra el perfil/red donde ocurre + termina con la IMPLICACIÓN PARA ${clientName} (qué significa para la marca, no descripción genérica).
- Cada hallazgo sigue la estructura QUÉ pasó + DÓNDE (perfil/red) + IMPLICACIÓN PARA ${clientName}, redactado como prosa fluida (sin viñetas internas, sin números entre paréntesis sin unidad).
- Cada recomendación sigue DECISIÓN concreta + PLAZO sugerido + RIESGO u OPORTUNIDAD asociada PARA ${clientName}.
- Longitud: cada hallazgo 2-4 oraciones; cada recomendación 2-3 oraciones; nada por debajo de 2 oraciones.

REGLAS PARA HIGHLIGHTS (4 KPI cards de cabecera, las más visibles del reporte):
- "label": 2-4 palabras MÁXIMO, totalmente claras (ej. "Engagement líder del período", "Brecha vs líder", "Cuota de voz", "Posts del Top 5").
- "value": LA CIFRA con UNIDAD COMPLETA (ej. "600 interacciones", "0.02% engagement", "13× por debajo", "0 de 5"). NUNCA solo "600" o "0.02".
- "context": 1 oración explicativa que conecte la cifra con ${clientName} (ej. "BBVA México en Instagram lidera el período; ningún post de ${clientName} alcanzó este nivel.").
- Los 4 highlights deben cubrir ángulos COMPLEMENTARIOS y útiles: NUNCA repitas engagement medio, audiencia total ni métricas que sumadas dan 0 o son redundantes. Mezcla ej: (1) Pico de engagement del período + dueño, (2) Posición/brecha de ${clientName} vs líder, (3) Mayor crecimiento del período + red, (4) Frecuencia o cobertura de ${clientName}.

REGLAS NUEVAS DE CONTEXTUALIZACIÓN POR GRÁFICA (obligatorias):
- "rankingInsight": 2-3 oraciones que lean el Top 10 perfiles desde la óptica de ${clientName}: dónde aparece, qué brecha tiene vs líder, qué red propia destaca o se queda atrás. Cifras concretas obligatorias.
- "sovInsight" (solo BENCHMARK): 2-3 oraciones que lean el share of voice por marca: qué % concentra ${clientName} vs líder, qué implica esa concentración para visibilidad y prioridad de inversión.
- "profilesInsight": 2-3 oraciones que sinteticen la tabla de perfiles desde la óptica de ${clientName}: qué red propia tiene mejor engagement, qué red propia muestra peor cadencia/crecimiento, contraste con competidor más cercano.

REGLAS EDITORIALES (estilo Wizr · CRÍTICAS):
- Tono ejecutivo pero LEGIBLE: directo, analítico. Prohibido "es importante", "cabe destacar", "vale la pena mencionar".
- PROHIBIDO usar nombres técnicos crudos de variables: NUNCA escribas "engagement_rate", "posts_per_day", "follower_growth_percent", "page_performance_index". Tradúcelos siempre a lenguaje natural: "tasa de engagement", "frecuencia de publicación", "crecimiento de seguidores", "índice de desempeño".
- PROHIBIDO escribir cifras decimales crudas sin contexto humano: "0.0016 de engagement_rate" → "una tasa de engagement de 0.16% (extremadamente baja)". "21,700 seguidores y 21" → reescribe sin números colgando.
- Cifras pequeñas siempre en porcentaje legible (ej. 0.0016 → 0.16%). Cifras grandes con separador de miles (21,700) o abreviadas (21.7K).
- Cuando una cifra es atípicamente baja o alta, califícala con UNA palabra ("muy baja", "marginal", "líder", "atípica") en lugar de dejar el número solo.
- Cada hallazgo debe leerse como una frase de analista a director, no como dump de variables. Si necesitas decir "0.6 posts por día" agrega "(menos de un post cada dos días)" o "(cadencia muy baja)".
- Prohibido el lenguaje genérico: "buen desempeño", "tendencia positiva", "área de oportunidad" sin cifra concreta detrás.
- Prohibido el "happy talk": si los números son malos, dilo con claridad y proponer qué hacer.
- Cada recomendación es ESTRICTAMENTE de comunicación digital (publicar, ajustar formato, cadencia, plataforma, mensaje, creatividad, partnership de contenido). Prohibido recomendar producto, RH, legal, presupuesto o procesos internos.
- AUDIENCIA del reporte: equipo de marketing/comunicación digital de ${clientName} y dirección. Habla en su lenguaje, no para el consumidor final ni para un data scientist.
- No uses símbolos de markdown (asteriscos, almohadillas, guiones de viñeta). Texto plano limpio.
- En modo MARCA: PROHIBIDO mencionar competidores, "el sector", "la industria", "frente a otras marcas", "líder del set". Tampoco hagas observaciones obvias del tipo "los 5 contenidos top son de la marca propia" cuando es la única marca analizada.
- En modo BENCHMARK: nombra a los competidores tal cual aparecen en los datos.
- Cuando referas a una pieza de contenido específica, NO digas "el adelanto del webinar" sin explicar de qué webinar; si no tienes el dato, di "una pieza de adelanto de evento" o describe el formato sin inventar el tema.

Devuelve EXCLUSIVAMENTE un JSON válido con esta forma:
{
  "title": "Título corto y específico del reporte",
  "summary": "Resumen ejecutivo de 4-6 oraciones que abre con la cifra/hallazgo más relevante e implicación para ${clientName}",
  "highlights": [
    { "label": "Etiqueta corta 2-4 palabras", "value": "Cifra + UNIDAD COMPLETA", "context": "Una oración conectando con ${clientName}" }
  ],
  "keyFindings": [
    "Hallazgo 1 (QUÉ + DÓNDE + IMPLICACIÓN PARA ${clientName}, con cifra concreta y unidad)",
    "Hallazgo 2..."
  ],
  "recommendations": [
    "Recomendación 1 (DECISIÓN + PLAZO + RIESGO/OPORTUNIDAD para ${clientName})",
    "Recomendación 2..."
  ],
  "topContentInsight": "Análisis de 3-4 oraciones sobre el patrón del contenido top y qué brecha de creatividad/formato implica para ${clientName}",
  "competitiveInsight": "Solo en BENCHMARK: análisis de 3-4 oraciones sobre posicionamiento competitivo de ${clientName}. En MARCA: cadena vacía.",
  "rankingInsight": "2-3 oraciones leyendo el ranking desde la óptica de ${clientName}",
  "sovInsight": "Solo en BENCHMARK: 2-3 oraciones leyendo el share of voice desde ${clientName}. En MARCA: cadena vacía.",
  "profilesInsight": "2-3 oraciones sintetizando la tabla de perfiles desde ${clientName}",
  "conclusion": "Cierre ejecutivo de 2-3 oraciones con una decisión clara para ${clientName}"
}

Mínimos OBLIGATORIOS: 4 highlights, 6 keyFindings (idealmente 7-8), 5 recommendations (idealmente 6-7), rankingInsight + profilesInsight siempre, sovInsight solo benchmark.`;

    const userPrompt = `Cliente: ${clientName}
Período: ${dateRange.label} (${dateRange.start} → ${dateRange.end})

ANALYTICS PRECOMPUTADOS (úsalos como verdad de cifras):
${JSON.stringify(analytics, null, 2)}

PERFILES Y KPIS DEL PERÍODO:
${JSON.stringify(profilesSummary, null, 2)}

TOP 5 CONTENIDOS POR ENGAGEMENT EN EL PERÍODO:
${JSON.stringify(top5Posts, null, 2)}

Genera el reporte siguiendo el JSON especificado, respetando los mínimos de hallazgos/recomendaciones y la estructura interna QUÉ+DÓNDE+IMPLICACIÓN / DECISIÓN+PLAZO+RIESGO.`;


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
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: `AI Gateway error ${response.status}: ${errText}` }),
        {
          status: response.status === 402 || response.status === 429 ? response.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
      rankingInsight: String(parsed.rankingInsight || ""),
      sovInsight: isBrand ? "" : String(parsed.sovInsight || ""),
      profilesInsight: String(parsed.profilesInsight || ""),
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
