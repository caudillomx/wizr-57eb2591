import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface MentionInput {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  sentiment: string | null;
  created_at: string;
  matched_keywords: string[];
}

interface ConversationAnalysisContent {
  volumeByChannel: {
    mediosDigitales: number;
    facebook: number;
    twitter: number;
    instagram: number;
    linkedin: number;
    tiktok: number;
    otros: number;
  };
  totalMentions: number;
  estimatedReach: string;
  sentimentDistribution: {
    positivo: number;
    neutral: number;
    negativo: number;
  };
  mainNarratives: Array<{
    narrative: string;
    volume: number;
    percentage: number;
  }>;
  relevantActors: Array<{
    name: string;
    type: string;
    mentions: number;
    description: string;
  }>;
  risks: string[];
  recommendations: string[];
  executiveSummary: string;
}

interface InformativeContent {
  context: string;
  whatIsHappening: Array<{
    title: string;
    description: string;
  }>;
  localImplications: Array<{
    title: string;
    description: string;
  }>;
  sources: Array<{
    name: string;
    url: string;
    date: string;
  }>;
  executiveSummary: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cardType, mentions, title, additionalContext } = await req.json() as {
      cardType: "conversation_analysis" | "informative";
      mentions: MentionInput[];
      title: string;
      additionalContext?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt: string;
    let userPrompt: string;
    let toolDefinition: any;

    if (cardType === "conversation_analysis") {
      // Prepare mentions content
      const mentionsContent = mentions.map((m, i) => {
        const parts = [`[${i + 1}]`];
        if (m.title) parts.push(`Título: ${m.title.substring(0, 200)}`);
        if (m.description) parts.push(`Descripción: ${m.description.substring(0, 300)}`);
        if (m.source_domain) parts.push(`Fuente: ${m.source_domain}`);
        if (m.sentiment) parts.push(`Sentimiento: ${m.sentiment}`);
        if (m.matched_keywords.length > 0) parts.push(`Keywords: ${m.matched_keywords.join(", ")}`);
        return parts.join(" | ");
      }).join("\n");

      systemPrompt = `Eres un analista de comunicación política y monitoreo de medios experto. Generas "Fichas de Análisis de Conversación Digital" siguiendo el formato profesional de Kimedia.

Tu análisis debe incluir:
1. Volumen de menciones por canal (estima basándote en los dominios)
2. Alcance estimado (usa multiplicadores estándar: 5-10 vistas por interacción)
3. Distribución de sentimiento (basado en los sentimientos de las menciones)
4. Narrativas principales (agrupa por temas similares, máx 5)
5. Actores relevantes (fuentes, medios, personas mencionadas)
6. Riesgos reputacionales identificados
7. Recomendaciones estratégicas
8. Resumen ejecutivo (2-3 oraciones)

Sé específico, usa datos cuantitativos cuando sea posible, y mantén un tono profesional.`;

      userPrompt = `Genera una Ficha de Análisis de Conversación Digital para: "${title}"

${additionalContext ? `Contexto adicional: ${additionalContext}\n\n` : ""}
Se analizaron ${mentions.length} menciones:

${mentionsContent}`;

      toolDefinition = {
        type: "function",
        function: {
          name: "generate_conversation_analysis",
          description: "Generate a conversation analysis thematic card",
          parameters: {
            type: "object",
            properties: {
              volumeByChannel: {
                type: "object",
                properties: {
                  mediosDigitales: { type: "number" },
                  facebook: { type: "number" },
                  twitter: { type: "number" },
                  instagram: { type: "number" },
                  linkedin: { type: "number" },
                  tiktok: { type: "number" },
                  otros: { type: "number" },
                },
                required: ["mediosDigitales", "facebook", "twitter", "instagram", "linkedin", "tiktok", "otros"],
              },
              totalMentions: { type: "number" },
              estimatedReach: { type: "string" },
              sentimentDistribution: {
                type: "object",
                properties: {
                  positivo: { type: "number" },
                  neutral: { type: "number" },
                  negativo: { type: "number" },
                },
                required: ["positivo", "neutral", "negativo"],
              },
              mainNarratives: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    narrative: { type: "string" },
                    volume: { type: "number" },
                    percentage: { type: "number" },
                  },
                  required: ["narrative", "volume", "percentage"],
                },
              },
              relevantActors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    type: { type: "string" },
                    mentions: { type: "number" },
                    description: { type: "string" },
                  },
                  required: ["name", "type", "mentions", "description"],
                },
              },
              risks: {
                type: "array",
                items: { type: "string" },
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              executiveSummary: { type: "string" },
            },
            required: [
              "volumeByChannel",
              "totalMentions",
              "estimatedReach",
              "sentimentDistribution",
              "mainNarratives",
              "relevantActors",
              "risks",
              "recommendations",
              "executiveSummary",
            ],
          },
        },
      };
    } else {
      // Informative card type
      systemPrompt = `Eres un analista de inteligencia estratégica experto. Generas "Fichas Informativas" que explican situaciones complejas de manera clara y estructurada.

Tu análisis debe incluir:
1. Resumen ejecutivo (2-3 oraciones)
2. ¿Qué está pasando? - Puntos clave con título y descripción
3. Implicaciones locales/relevantes - Impactos específicos
4. Fuentes consultadas

Mantén un tono objetivo e informativo. Usa datos específicos cuando estén disponibles.`;

      const mentionsContent = mentions.map((m, i) => {
        const parts = [`[${i + 1}]`];
        if (m.title) parts.push(`${m.title.substring(0, 200)}`);
        if (m.description) parts.push(`${m.description.substring(0, 400)}`);
        if (m.source_domain) parts.push(`(${m.source_domain})`);
        if (m.url) parts.push(`URL: ${m.url}`);
        return parts.join(" - ");
      }).join("\n");

      userPrompt = `Genera una Ficha Informativa para: "${title}"

${additionalContext ? `Contexto adicional del analista: ${additionalContext}\n\n` : ""}
Fuentes disponibles (${mentions.length} menciones):

${mentionsContent}`;

      toolDefinition = {
        type: "function",
        function: {
          name: "generate_informative_card",
          description: "Generate an informative thematic card",
          parameters: {
            type: "object",
            properties: {
              executiveSummary: { type: "string" },
              context: { type: "string" },
              whatIsHappening: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                },
              },
              localImplications: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "description"],
                },
              },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    url: { type: "string" },
                    date: { type: "string" },
                  },
                  required: ["name", "url", "date"],
                },
              },
            },
            required: ["executiveSummary", "context", "whatIsHappening", "localImplications", "sources"],
          },
        },
      };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [toolDefinition],
        tool_choice: {
          type: "function",
          function: {
            name: cardType === "conversation_analysis"
              ? "generate_conversation_analysis"
              : "generate_informative_card",
          },
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("Invalid AI response structure");
    }

    const content = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ success: true, content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-thematic-card error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
