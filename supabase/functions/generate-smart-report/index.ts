import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Mention {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  sentiment: string | null;
  created_at: string;
  published_at: string | null;
  matched_keywords: string[];
  raw_metadata: Record<string, unknown> | null;
}

interface ReportRequest {
  mentions: Mention[];
  reportType: "brief" | "crisis" | "thematic" | "comparative";
  extension: "micro" | "short" | "medium";
  projectName: string;
  projectAudience: string;
  projectObjective: string;
  strategicContext?: string;
  strategicFocus?: string;
  entityNames?: string[];
  dateRange: {
    start: string;
    end: string;
    label: string;
  };
}

interface NarrativeItem {
  narrative: string;
  description: string;
  mentions: number;
  sentiment: "positivo" | "negativo" | "mixto";
  trend: "creciente" | "decreciente" | "estable";
}

interface ReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  impactAssessment?: string;
  sentimentAnalysis?: string;
  narratives?: NarrativeItem[];
  metrics: {
    totalMentions: number;
    positiveCount: number;
    negativeCount: number;
    neutralCount: number;
    topSources: string[];
  };
  templates: {
    executive: string;
    technical: string;
    public: string;
  };
}

const EXTENSION_TOKENS = {
  micro: 1500,
  short: 3000,
  medium: 5000,
};

const REPORT_TYPE_PROMPTS = {
  brief: `Genera un BRIEF EJECUTIVO DE MONITOREO detallado y accionable.

ESTRUCTURA:
1. RESUMEN DEL PERÍODO - menciones totales, sentimiento cuantificado, eventos dominantes
2. ANÁLISIS DE FUENTES - fuentes más relevantes, cuáles generan contenido negativo vs positivo
3. TEMAS Y NARRATIVAS - 3-5 temas principales, narrativas a amplificar vs responder
4. INFLUENCIADORES - quién habla, con qué alcance, tono
5. ANÁLISIS DE SENTIMIENTO - distribución, tendencia, drivers de negatividad/positividad
6. ALERTAS Y SEÑALES - atención inmediata, cambios significativos, oportunidades`,

  crisis: `Genera una ALERTA DE CRISIS profunda y operativa con URGENCIA y PRECISIÓN.

ESTRUCTURA:
1. DESCRIPCIÓN DEL EVENTO CRÍTICO - qué pasó, detonante, plataformas/fuentes
2. MAGNITUD E IMPACTO - menciones negativas, % del total, tendencia, alcance
3. IMPACTO EN LA MARCA/ENTIDAD - cómo afecta directamente, riesgos reputacionales concretos
4. ACTORES E INFLUENCIADORES - detractores, amplificadores, defensores (nombres y plataformas)
5. NARRATIVA DE LA CRISIS - mensaje central, argumentos, desinformación
6. ANÁLISIS DE MEDIOS - qué medios cubren, qué ángulo toman, cuáles son los más dañinos
7. PLAN DE CONTENCIÓN (24h) - acciones inmediatas, mensajes de respuesta, canales prioritarios
8. PLAN DE RECUPERACIÓN - estrategia, narrativas positivas, aliados`,

  thematic: `Genera un ANÁLISIS TEMÁTICO PROFUNDO.

ESTRUCTURA:
1. TEMA PRINCIPAL - definición, relevancia, estado
2. SUBTEMAS Y NARRATIVAS - frecuencia, sentimiento, fuentes por cada uno
3. EVOLUCIÓN TEMPORAL - origen, picos, tendencia
4. ACTORES Y VOCES - influenciadores, líderes de opinión, medios
5. IMPACTO EN LA MARCA/ENTIDAD - cómo afecta, oportunidades, riesgos
6. PREDICCIÓN Y RECOMENDACIONES - hacia dónde va, qué hacer`,

  comparative: `Genera un ANÁLISIS COMPARATIVO entre entidades.

ESTRUCTURA:
1. COMPARACIÓN DE VOLUMEN - ranking por menciones, %
2. COMPARACIÓN DE SENTIMIENTO - ratio positivo/negativo por entidad
3. ANÁLISIS DE FUENTES - cobertura por entidad, fortalezas de canal
4. INFLUENCIADORES POR ENTIDAD - quién habla de cada uno
5. SHARE OF VOICE - quién domina, brechas, oportunidades
6. BENCHMARK - líder, diferenciadores, recomendaciones`,
};

function buildDetailedMentionAnalysis(mentions: Mention[]): string {
  const positive = mentions.filter(m => m.sentiment === "positivo");
  const negative = mentions.filter(m => m.sentiment === "negativo");
  const neutral = mentions.filter(m => m.sentiment === "neutral");

  const bySource: Record<string, Mention[]> = {};
  mentions.forEach(m => {
    const source = m.source_domain || "desconocido";
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(m);
  });

  const keywordCount: Record<string, number> = {};
  mentions.forEach(m => {
    m.matched_keywords?.forEach(k => {
      keywordCount[k] = (keywordCount[k] || 0) + 1;
    });
  });
  const topKeywords = Object.entries(keywordCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Extract influencers from raw_metadata
  const authorMap: Record<string, { name: string; username: string; platform: string; count: number; engagement: number; sentiment: string[] }> = {};
  mentions.forEach(m => {
    const meta = m.raw_metadata;
    const authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
    if (!authorName) return;
    const key = `${authorName}@${m.source_domain || "unknown"}`;
    const authorUsername = (meta?.authorUsername || meta?.author_username || "") as string;
    if (!authorMap[key]) {
      authorMap[key] = { name: authorName, username: authorUsername, platform: m.source_domain || "unknown", count: 0, engagement: 0, sentiment: [] };
    }
    authorMap[key].count++;
    if (m.sentiment) authorMap[key].sentiment.push(m.sentiment);
    const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0) + ((meta?.views as number) || 0);
    authorMap[key].engagement += eng;
  });
  const topAuthors = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 10);

  // Timeline analysis
  const byDate: Record<string, number> = {};
  mentions.forEach(m => {
    const date = (m.published_at || m.created_at || "").split("T")[0];
    if (date) byDate[date] = (byDate[date] || 0) + 1;
  });
  const sortedDates = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));

  let analysis = "ANÁLISIS DETALLADO DE MENCIONES:\n\n";

  analysis += "DISTRIBUCIÓN DE SENTIMIENTO:\n";
  analysis += `- Positivas: ${positive.length} (${(positive.length/mentions.length*100).toFixed(1)}%)\n`;
  analysis += `- Negativas: ${negative.length} (${(negative.length/mentions.length*100).toFixed(1)}%)\n`;
  analysis += `- Neutrales: ${neutral.length} (${(neutral.length/mentions.length*100).toFixed(1)}%)\n\n`;

  const sortedSources = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length);
  analysis += "TOP FUENTES/MEDIOS:\n";
  sortedSources.slice(0, 8).forEach(([source, items]) => {
    const posCount = items.filter(i => i.sentiment === "positivo").length;
    const negCount = items.filter(i => i.sentiment === "negativo").length;
    analysis += `- ${source}: ${items.length} menciones (${posCount} positivas, ${negCount} negativas)\n`;
  });
  analysis += "\n";

  if (topAuthors.length > 0) {
    analysis += "INFLUENCIADORES / AUTORES PRINCIPALES:\n";
    topAuthors.forEach((a, i) => {
      const negCount = a.sentiment.filter(s => s === "negativo").length;
      const posCount = a.sentiment.filter(s => s === "positivo").length;
      analysis += `${i+1}. ${a.name} [${a.platform}]: ${a.count} menciones, ${a.engagement > 0 ? a.engagement.toLocaleString() + " interacciones, " : ""}sentimiento ${negCount > posCount ? "mayormente negativo" : posCount > negCount ? "mayormente positivo" : "mixto"}\n`;
    });
    analysis += "\n";
  }

  if (topKeywords.length > 0) {
    analysis += "KEYWORDS MÁS FRECUENTES:\n";
    topKeywords.forEach(([keyword, count]) => {
      analysis += `- "${keyword}": ${count} menciones\n`;
    });
    analysis += "\n";
  }

  if (sortedDates.length > 0) {
    analysis += "ACTIVIDAD POR DÍA:\n";
    sortedDates.forEach(([date, count]) => {
      analysis += `- ${date}: ${count} menciones\n`;
    });
    analysis += "\n";
  }

  if (negative.length > 0) {
    analysis += "MUESTRA DE MENCIONES NEGATIVAS:\n";
    negative.slice(0, 8).forEach((m, i) => {
      const meta = m.raw_metadata;
      const author = (meta?.author || meta?.author_name || meta?.author_username || meta?.authorUsername || "") as string;
      analysis += `${i+1}. [${m.source_domain}]${author ? " por " + author : ""} "${m.title || ''}": ${(m.description || '').substring(0, 200)}\n`;
    });
    analysis += "\n";
  }

  if (positive.length > 0) {
    analysis += "MUESTRA DE MENCIONES POSITIVAS:\n";
    positive.slice(0, 5).forEach((m, i) => {
      analysis += `${i+1}. [${m.source_domain}] ${m.title || ''}: ${(m.description || '').substring(0, 150)}\n`;
    });
  }

  return analysis;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: ReportRequest = await req.json();
    const { mentions, reportType, extension, projectName, projectAudience, projectObjective, strategicContext, strategicFocus, entityNames, dateRange } = body;

    if (!mentions || mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No mentions provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metrics = {
      totalMentions: mentions.length,
      positiveCount: mentions.filter(m => m.sentiment === "positivo").length,
      negativeCount: mentions.filter(m => m.sentiment === "negativo").length,
      neutralCount: mentions.filter(m => m.sentiment === "neutral").length,
      topSources: [...new Set(mentions.map(m => m.source_domain).filter(Boolean))].slice(0, 5) as string[],
    };

    const detailedAnalysis = buildDetailedMentionAnalysis(mentions);

    const mentionsSummary = mentions.slice(0, 50).map(m => ({
      title: m.title,
      description: m.description?.substring(0, 250),
      source: m.source_domain,
      sentiment: m.sentiment,
      keywords: m.matched_keywords?.join(", "),
      date: (m.published_at || m.created_at)?.split('T')[0],
      author: (m.raw_metadata?.author || m.raw_metadata?.author_name || m.raw_metadata?.authorUsername || null) as string | null,
    }));

    const maxTokens = EXTENSION_TOKENS[extension];
    const typePrompt = REPORT_TYPE_PROMPTS[reportType];

    // Build strategic context block
    let strategicBlock = "";
    if (strategicContext || strategicFocus) {
      strategicBlock = "\n=== CONTEXTO ESTRATÉGICO ===\n";
      if (strategicContext) {
        strategicBlock += `CONTEXTO DEL PROYECTO: ${strategicContext}\n`;
      }
      if (strategicFocus) {
        strategicBlock += `ENFOQUE ESPECÍFICO DE ESTE REPORTE: ${strategicFocus}\n`;
      }
      strategicBlock += `\nIMPORTANTE: Todo tu análisis DEBE estar orientado por este contexto estratégico. No analices los datos de forma genérica. Evalúa cada hallazgo en función de cómo impacta a la marca/entidad principal según el contexto descrito. Incluye una sección de "Evaluación de Impacto" que analice específicamente cómo los eventos detectados afectan a la marca/entidad en el contexto estratégico descrito.\n`;
    }

    const systemPrompt = `Eres un ANALISTA SENIOR de inteligencia estratégica con experiencia en monitoreo de medios, gestión de crisis y reputación corporativa.

TU AUDIENCIA: ${projectAudience}
OBJETIVO DEL MONITOREO: ${projectObjective}

PRINCIPIOS:
1. ESPECIFICIDAD: Usa nombres de fuentes, autores, fechas concretas. Nunca "varias fuentes" o "algunos medios".
2. CUANTIFICACIÓN: Incluye números, porcentajes, comparaciones.
3. CONTEXTO ESTRATÉGICO: Cada dato debe conectarse con el impacto en la marca/entidad monitoreada.
4. ACCIONABILIDAD: Cada insight debe poder convertirse en una decisión concreta.
5. INFLUENCIADORES: Identifica quién genera la conversación, con qué alcance y tono.
6. MEDIOS: Detalla qué medios/plataformas cubren el tema y con qué ángulo.

FORMATO:
- Español profesional
- NO uses markdown, asteriscos, ni símbolos especiales (excepto emojis en versión WhatsApp)
- Cita fuentes y autores específicos
- Usa números exactos`;

    const userPrompt = `${typePrompt}
${strategicBlock}
=== CONTEXTO DEL PROYECTO ===
PROYECTO: ${projectName}
PERIODO ANALIZADO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${entityNames?.length ? `ENTIDADES MONITOREADAS: ${entityNames.join(", ")}` : ""}

=== MÉTRICAS DEL PERÍODO ===
- Total de menciones: ${metrics.totalMentions}
- Positivas: ${metrics.positiveCount} (${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%)
- Negativas: ${metrics.negativeCount} (${Math.round(metrics.negativeCount/metrics.totalMentions*100)}%)
- Neutrales: ${metrics.neutralCount} (${Math.round(metrics.neutralCount/metrics.totalMentions*100)}%)
- Fuentes principales: ${metrics.topSources.join(", ")}

${detailedAnalysis}

=== MUESTRA DE MENCIONES (${mentionsSummary.length} de ${mentions.length}) ===
${JSON.stringify(mentionsSummary, null, 2)}

=== TU TAREA ===
Analiza los datos y genera un reporte siguiendo la estructura indicada. Sé ESPECÍFICO, CUANTITATIVO y orientado al CONTEXTO ESTRATÉGICO.

Responde en formato JSON con esta estructura exacta:
{
  "title": "string - título profesional que refleje el contenido y ángulo estratégico del reporte",
  "summary": "string - párrafo ejecutivo de 4-6 oraciones con hallazgos críticos, mencionando fuentes, autores y números específicos",
  "impactAssessment": "string - párrafo evaluando cómo los eventos afectan a la marca/entidad",
  "sentimentAnalysis": "string - párrafo analizando distribución de sentimiento y sus drivers",
  "narratives": [
    {
      "narrative": "string - nombre corto de la narrativa temática (ej: 'Vinculación con fraude financiero')",
      "description": "string - 1-2 oraciones: qué dice esta narrativa, quién la promueve, en qué medios aparece",
      "mentions": "number - cantidad estimada de menciones que contienen esta narrativa",
      "sentiment": "positivo | negativo | mixto",
      "trend": "creciente | decreciente | estable"
    }
  ],
  "keyFindings": ["string - hallazgo específico citando fuentes, autores y datos", ...],
  "recommendations": ["string - acción específica y priorizada", ...],
  "templates": {
    "executive": "string - 3-4 párrafos para directivos",
    "technical": "string - 3-4 párrafos para analistas",
    "public": "string - 2-3 párrafos con emojis para WhatsApp"
  }
}

IMPORTANTE sobre "narratives": Identifica entre 3 y 8 NARRATIVAS TEMÁTICAS principales. Una narrativa NO es un keyword ni un nombre propio — es una IDEA o ARGUMENTO recurrente en la conversación (ej: "Cuestionamiento de transparencia financiera", "Defensa institucional ante acusaciones"). Ordénalas por frecuencia.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens + 1000,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response
    let reportContent: Partial<ReportContent>;
    try {
      let cleanedContent = content;
      cleanedContent = cleanedContent.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
      
      const extractBalancedJSON = (str: string): string | null => {
        const startIndex = str.indexOf('{');
        if (startIndex === -1) return null;
        
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = startIndex; i < str.length; i++) {
          const char = str[i];
          if (escapeNext) { escapeNext = false; continue; }
          if (char === '\\' && inString) { escapeNext = true; continue; }
          if (char === '"' && !escapeNext) { inString = !inString; continue; }
          if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            if (braceCount === 0) return str.substring(startIndex, i + 1);
          }
        }
        return null;
      };
      
      let jsonStr = extractBalancedJSON(cleanedContent);
      
      if (!jsonStr) {
        console.log("Attempting to recover truncated JSON response");
        const startIndex = cleanedContent.indexOf('{');
        if (startIndex !== -1) {
          const partialContent = cleanedContent.substring(startIndex);
          const titleMatch = partialContent.match(/"title"\s*:\s*"([^"]+)"/);
          const summaryMatch = partialContent.match(/"summary"\s*:\s*"([^"]+)"/);
          const impactMatch = partialContent.match(/"impactAssessment"\s*:\s*"([^"]+)"/);
          
          const keyFindingsMatch = partialContent.match(/"keyFindings"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
          let keyFindings: string[] = [];
          if (keyFindingsMatch) {
            const findingMatches = keyFindingsMatch[1].match(/"([^"]+)"/g);
            if (findingMatches) {
              keyFindings = findingMatches.map((f: string) => f.replace(/"/g, '')).filter((f: string) => f.length > 10);
            }
          }
          
          if (titleMatch || summaryMatch) {
            reportContent = {
              title: titleMatch?.[1] || `Reporte de ${reportType}`,
              summary: summaryMatch?.[1] || "Resumen generado parcialmente.",
              impactAssessment: impactMatch?.[1] || undefined,
              keyFindings: keyFindings.length > 0 ? keyFindings : ["Reporte generado con información parcial"],
              recommendations: keyFindings.length > 0 ? ["Monitorear la evolución de los temas identificados", "Evaluar respuesta estratégica basada en los hallazgos"] : ["Reporte generado con información parcial — reintenta con extensión medium"],
              templates: {
                executive: summaryMatch?.[1] || "",
                technical: summaryMatch?.[1] || "",
                public: `📊 ${titleMatch?.[1] || "Reporte"}`,
              },
            };
          } else {
            throw new Error("No valid JSON object found");
          }
        } else {
          throw new Error("No valid JSON object found");
        }
      } else {
        const sanitized = jsonStr.replace(/[\x00-\x1F\x7F]/g, (match) => {
          if (match === '\n' || match === '\r' || match === '\t') return match;
          return '';
        });
        reportContent = JSON.parse(sanitized);
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Content:", content.substring(0, 800));
      const cleanText = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
      const titleMatch = cleanText.match(/"title"\s*:\s*"([^"]+)"/);
      const summaryMatch = cleanText.match(/"summary"\s*:\s*"([^"]+)"/);
      
      reportContent = {
        title: titleMatch?.[1] || `Reporte de ${reportType}`,
        summary: summaryMatch?.[1] || cleanText.substring(0, 500),
        keyFindings: ["Reporte generado con información parcial — se recomienda reintentar"],
        recommendations: ["Reintentar generación con extensión medium para obtener análisis completo"],
        templates: {
          executive: summaryMatch?.[1] || cleanText.substring(0, 400),
          technical: cleanText.substring(0, 500),
          public: `📊 ${titleMatch?.[1] || "Reporte"}`,
        },
      };
    }

    const result: ReportContent = {
      title: reportContent.title || "Reporte Inteligente",
      summary: reportContent.summary || "",
      keyFindings: reportContent.keyFindings || [],
      recommendations: reportContent.recommendations || [],
      impactAssessment: reportContent.impactAssessment || undefined,
      sentimentAnalysis: reportContent.sentimentAnalysis || undefined,
      narratives: reportContent.narratives || [],
      metrics,
      templates: {
        executive: reportContent.templates?.executive || "",
        technical: reportContent.templates?.technical || "",
        public: reportContent.templates?.public || "",
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating smart report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});