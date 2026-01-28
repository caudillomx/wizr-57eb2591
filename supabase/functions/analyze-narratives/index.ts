import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface PostInput {
  message: string;
  contentType: string;
  engagement: number;
  date?: string;
}

interface ProfileInput {
  profileName: string;
  network: string;
  posts: PostInput[];
}

interface NarrativeAnalysis {
  dominantNarratives: Array<{
    theme: string;
    description: string;
    frequency: number;
    sentiment: "positive" | "neutral" | "negative";
    examplePosts: string[];
  }>;
  toneAnalysis: {
    overall: "formal" | "informal" | "mixed";
    emotionalTone: string;
    callToAction: boolean;
  };
  topHashtags: Array<{
    tag: string;
    count: number;
  }>;
  contentStrategy: {
    primaryFocus: string;
    strengths: string[];
    opportunities: string[];
  };
  summary: string;
}

interface ComparativeAnalysis {
  profiles: Array<{
    profileId: string;
    profileName: string;
    network: string;
    analysis: NarrativeAnalysis;
  }>;
  comparison?: {
    commonThemes: string[];
    differentiators: Array<{
      profileName: string;
      uniqueAspect: string;
    }>;
    leaderInEngagement?: string;
    mostFormalTone?: string;
    overallInsight: string;
  };
}

// Single profile analysis
async function analyzeProfile(
  profile: ProfileInput,
  dateRange: { from: string; to: string } | null,
  apiKey: string
): Promise<NarrativeAnalysis> {
  const postsContent = profile.posts.slice(0, 15).map((p, i) => 
    `[Post ${i + 1}] (Engagement: ${p.engagement}, Tipo: ${p.contentType})\n${p.message.substring(0, 500)}`
  ).join("\n\n---\n\n");

  const systemPrompt = `Eres un analista experto en comunicación digital y narrativas de redes sociales. Analiza el contenido publicado por el perfil "${profile.profileName}" en ${profile.network}.

Tu tarea es identificar:
1. Narrativas dominantes: Los 3-5 temas/mensajes principales que caracterizan su comunicación
2. Análisis de tono: Si es formal/informal, el tono emocional, y si usa call-to-actions
3. Hashtags principales: Los más frecuentes
4. Estrategia de contenido: Enfoque principal, fortalezas y oportunidades de mejora
5. Resumen ejecutivo: 2-3 oraciones que capturen la esencia de su comunicación

Responde ÚNICAMENTE con JSON válido siguiendo el schema de la función.`;

  const userPrompt = `Analiza estos ${profile.posts.length} posts de @${profile.profileName} en ${profile.network}${dateRange ? ` del período ${dateRange.from} a ${dateRange.to}` : ''}:

${postsContent}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      tools: [
        {
          type: "function",
          function: {
            name: "narrative_analysis",
            description: "Return narrative analysis of social media content",
            parameters: {
              type: "object",
              properties: {
                dominantNarratives: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      theme: { type: "string", description: "Nombre corto del tema/narrativa" },
                      description: { type: "string", description: "Descripción de la narrativa" },
                      frequency: { type: "number", description: "Porcentaje de posts (0-100)" },
                      sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
                      examplePosts: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "1-2 fragmentos de ejemplo"
                      }
                    },
                    required: ["theme", "description", "frequency", "sentiment", "examplePosts"]
                  }
                },
                toneAnalysis: {
                  type: "object",
                  properties: {
                    overall: { type: "string", enum: ["formal", "informal", "mixed"] },
                    emotionalTone: { type: "string", description: "Ej: Inspirador, Informativo, Promocional" },
                    callToAction: { type: "boolean" }
                  },
                  required: ["overall", "emotionalTone", "callToAction"]
                },
                topHashtags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tag: { type: "string" },
                      count: { type: "number" }
                    },
                    required: ["tag", "count"]
                  }
                },
                contentStrategy: {
                  type: "object",
                  properties: {
                    primaryFocus: { type: "string" },
                    strengths: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "3-4 fortalezas"
                    },
                    opportunities: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "2-3 oportunidades de mejora"
                    }
                  },
                  required: ["primaryFocus", "strengths", "opportunities"]
                },
                summary: { type: "string", description: "Resumen ejecutivo de 2-3 oraciones" }
              },
              required: ["dominantNarratives", "toneAnalysis", "topHashtags", "contentStrategy", "summary"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "narrative_analysis" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    if (response.status === 402) {
      throw new Error("PAYMENT_REQUIRED");
    }
    const errorText = await response.text();
    console.error("AI gateway error:", response.status, errorText);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const aiResponse = await response.json();
  
  const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== "narrative_analysis") {
    throw new Error("Invalid AI response structure");
  }

  return JSON.parse(toolCall.function.arguments);
}

// Generate comparative insights
async function generateComparison(
  profilesWithAnalysis: Array<{
    profileId: string;
    profileName: string;
    network: string;
    analysis: NarrativeAnalysis;
  }>,
  apiKey: string
): Promise<ComparativeAnalysis["comparison"]> {
  const profileSummaries = profilesWithAnalysis.map(p => 
    `@${p.profileName} (${p.network}): ${p.analysis.summary}\nNarrativas: ${p.analysis.dominantNarratives.map(n => n.theme).join(", ")}\nTono: ${p.analysis.toneAnalysis.overall}, ${p.analysis.toneAnalysis.emotionalTone}`
  ).join("\n\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { 
          role: "system", 
          content: "Eres un analista experto en comunicación digital. Compara las estrategias de comunicación de los perfiles proporcionados de manera concisa y accionable." 
        },
        { 
          role: "user", 
          content: `Compara estos ${profilesWithAnalysis.length} perfiles:\n\n${profileSummaries}` 
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "comparative_analysis",
            description: "Return comparative analysis of multiple profiles",
            parameters: {
              type: "object",
              properties: {
                commonThemes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Temas que comparten todos o la mayoría"
                },
                differentiators: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      profileName: { type: "string" },
                      uniqueAspect: { type: "string", description: "Lo que lo diferencia" }
                    },
                    required: ["profileName", "uniqueAspect"]
                  }
                },
                leaderInEngagement: { type: "string", description: "Perfil con mejor estrategia de engagement" },
                mostFormalTone: { type: "string", description: "Perfil con tono más formal/institucional" },
                overallInsight: { type: "string", description: "Insight clave de la comparación en 2-3 oraciones" }
              },
              required: ["commonThemes", "differentiators", "overallInsight"]
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "comparative_analysis" } },
    }),
  });

  if (!response.ok) {
    console.error("Comparison error:", response.status);
    return undefined;
  }

  const aiResponse = await response.json();
  const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall || toolCall.function.name !== "comparative_analysis") {
    return undefined;
  }

  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Support both single profile (legacy) and multiple profiles
    const profiles: ProfileInput[] = body.profiles || [{
      profileName: body.profileName,
      network: body.network,
      posts: body.posts
    }];
    
    const dateRange = body.dateRange as { from: string; to: string } | null;

    if (!profiles || profiles.length === 0 || !profiles[0].posts || profiles[0].posts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No profiles or posts provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to 5 profiles max
    const limitedProfiles = profiles.slice(0, 5);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Analyze each profile
    const profilesWithAnalysis: ComparativeAnalysis["profiles"] = [];
    
    for (const profile of limitedProfiles) {
      if (!profile.posts || profile.posts.length === 0) continue;
      
      try {
        const analysis = await analyzeProfile(profile, dateRange, LOVABLE_API_KEY);
        profilesWithAnalysis.push({
          profileId: profile.profileName, // Using name as ID
          profileName: profile.profileName,
          network: profile.network,
          analysis
        });
      } catch (err) {
        if ((err as Error).message === "RATE_LIMIT") {
          return new Response(
            JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if ((err as Error).message === "PAYMENT_REQUIRED") {
          return new Response(
            JSON.stringify({ success: false, error: "Payment required. Please add credits." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        console.error(`Error analyzing ${profile.profileName}:`, err);
        // Continue with other profiles
      }
    }

    if (profilesWithAnalysis.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not analyze any profiles" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate comparison if multiple profiles
    let comparison: ComparativeAnalysis["comparison"] = undefined;
    if (profilesWithAnalysis.length > 1) {
      comparison = await generateComparison(profilesWithAnalysis, LOVABLE_API_KEY);
    }

    // Return result - maintain backwards compatibility for single profile
    if (limitedProfiles.length === 1 && !body.profiles) {
      // Legacy single profile response
      return new Response(
        JSON.stringify({ success: true, analysis: profilesWithAnalysis[0].analysis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Multi-profile response
    const result: ComparativeAnalysis = {
      profiles: profilesWithAnalysis,
      comparison
    };

    return new Response(
      JSON.stringify({ success: true, comparative: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-narratives error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
