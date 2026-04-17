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
  reportFormat: "summary" | "full";
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
  conclusions?: string[];
  impactAssessment?: string;
  sentimentAnalysis?: string;
  narratives?: NarrativeItem[];
  entityComparison?: string;
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

// Always generate full report; PDF trimming happens client-side
const MAX_TOKENS = 6000;

// Detect if entity names are semantically the same (different capitalizations/variations of the same name)
function areEntitiesDistinct(names: string[]): boolean {
  if (!names || names.length < 2) return false;
  
  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const normalized = names.map(normalize);
  
  // Check pairwise Jaccard similarity on character trigrams
  const trigrams = (s: string): Set<string> => {
    const t = new Set<string>();
    for (let i = 0; i <= s.length - 3; i++) t.add(s.substring(i, i + 3));
    return t;
  };
  
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = trigrams(normalized[i]);
      const b = trigrams(normalized[j]);
      if (a.size === 0 || b.size === 0) continue;
      const intersection = new Set([...a].filter(x => b.has(x)));
      const union = new Set([...a, ...b]);
      const similarity = intersection.size / union.size;
      // If any pair is very similar (>0.6), they're likely the same entity
      if (similarity > 0.6) return false;
    }
  }
  return true;
}

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

  const authorMap: Record<string, { name: string; platform: string; count: number; engagement: number; sentiment: string[] }> = {};
  mentions.forEach(m => {
    const meta = m.raw_metadata;
    const authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
    if (!authorName) return;
    const key = `${authorName}@${m.source_domain || "unknown"}`;
    if (!authorMap[key]) {
      authorMap[key] = { name: authorName, platform: m.source_domain || "unknown", count: 0, engagement: 0, sentiment: [] };
    }
    authorMap[key].count++;
    if (m.sentiment) authorMap[key].sentiment.push(m.sentiment);
    const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0) + ((meta?.views as number) || 0);
    authorMap[key].engagement += eng;
  });
  const topAuthors = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 10);

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
    analysis += `- ${source}: ${items.length} menciones (${posCount} pos, ${negCount} neg)\n`;
  });
  analysis += "\n";

  if (topAuthors.length > 0) {
    analysis += "INFLUENCIADORES / AUTORES PRINCIPALES:\n";
    topAuthors.forEach((a, i) => {
      const negCount = a.sentiment.filter(s => s === "negativo").length;
      const posCount = a.sentiment.filter(s => s === "positivo").length;
      analysis += `${i+1}. ${a.name} [${a.platform}]: ${a.count} menciones, ${a.engagement > 0 ? a.engagement.toLocaleString() + " interacciones, " : ""}${negCount > posCount ? "negativo" : posCount > negCount ? "positivo" : "mixto"}\n`;
    });
    analysis += "\n";
  }

  if (topKeywords.length > 0) {
    analysis += "KEYWORDS: " + topKeywords.map(([k, c]) => `"${k}"(${c})`).join(", ") + "\n\n";
  }

  if (sortedDates.length > 0) {
    analysis += "ACTIVIDAD POR DÍA:\n";
    sortedDates.forEach(([date, count]) => {
      analysis += `- ${date}: ${count}\n`;
    });
    analysis += "\n";
  }

  if (negative.length > 0) {
    analysis += "MUESTRA DE MENCIONES NEGATIVAS:\n";
    negative.slice(0, 8).forEach((m, i) => {
      const meta = m.raw_metadata;
      const author = (meta?.author || meta?.author_name || meta?.author_username || "") as string;
      analysis += `${i+1}. [${m.source_domain}]${author ? " " + author : ""}: ${(m.title || "").substring(0, 80)} — ${(m.description || "").substring(0, 200)}\n`;
    });
    analysis += "\n";
  }

  if (positive.length > 0) {
    analysis += "MUESTRA DE MENCIONES POSITIVAS:\n";
    positive.slice(0, 5).forEach((m, i) => {
      analysis += `${i+1}. [${m.source_domain}] ${(m.title || "").substring(0, 80)}: ${(m.description || "").substring(0, 150)}\n`;
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
    const { mentions, reportFormat = "full", projectName, projectAudience, projectObjective, strategicContext, strategicFocus, entityNames, dateRange } = body;

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

    // Always generate full report
    const hasDistinctEntities = entityNames && entityNames.length >= 2 && areEntitiesDistinct(entityNames);

    // ===== PRE-EXTRACCIÓN DE CASOS/HECHOS CONOCIDOS DEL ENFOQUE ESTRATÉGICO =====
    const extractKnownCases = (text: string): string[] => {
      if (!text) return [];
      const cases: string[] = [];
      const patterns = [
        /litigio[s]?\s+(?:con|contra|de|entre)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /caso\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /disputa[s]?\s+(?:con|contra|de)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /demanda[s]?\s+(?:de|contra|por)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /controversia[s]?\s+(?:con|sobre|de)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /investigaci[oó]n(?:es)?\s+(?:sobre|contra|de)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /acusaci[oó]n(?:es)?\s+(?:de|contra|por)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
        /fraude[s]?\s+(?:al|contra|a|de|por)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ\s\.&-]{2,40})/gi,
      ];
      for (const re of patterns) {
        let m;
        while ((m = re.exec(text)) !== null) {
          const clean = m[0].trim().replace(/\s+/g, ' ');
          if (clean.length < 120) cases.push(clean);
        }
      }
      const properNouns = text.match(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,3}\b/g) || [];
      const filtered = [...new Set(properNouns)].filter(n => n.length > 4).slice(0, 15);
      return [...new Set([...cases, ...filtered])];
    };

    const knownCases = extractKnownCases(`${strategicContext || ''} ${strategicFocus || ''}`);

    // ===== PRE-CONTEO DETERMINÍSTICO DE TÉRMINOS CANÓNICOS =====
    // Contamos sobre TODO el universo de menciones cuántas contienen cada término clave
    // (casos conocidos + entidades). Este conteo es la VERDAD AUDITABLE; la IA no puede inventar números.
    const extractCanonicalTerms = (cases: string[], entities: string[] | undefined): string[] => {
      const terms = new Set<string>();
      // De cada "caso conocido" extraer el sustantivo propio principal (parte después de la preposición)
      for (const c of cases) {
        // Tomar la última secuencia capitalizada significativa
        const propers = c.match(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,2}\b/g) || [];
        propers.forEach(p => { if (p.length >= 4) terms.add(p.trim()); });
      }
      (entities || []).forEach(e => { if (e && e.length >= 3) terms.add(e.trim()); });
      return [...terms];
    };

    const normalizeForMatch = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const countMentionsForTerm = (term: string): number => {
      const needle = normalizeForMatch(term);
      // Escapar regex y construir matcher con límite de palabra cuando aplique
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      let count = 0;
      for (const m of mentions) {
        const haystack = normalizeForMatch(`${m.title || ""} ${m.description || ""} ${(m.matched_keywords || []).join(" ")}`);
        if (re.test(haystack)) count++;
      }
      return count;
    };

    const canonicalTerms = extractCanonicalTerms(knownCases, entityNames);
    const verifiedCounts: Array<{ term: string; count: number }> = canonicalTerms
      .map(t => ({ term: t, count: countMentionsForTerm(t) }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);

    let strategicBlock = "";
    if (strategicContext || strategicFocus) {
      strategicBlock = "\n=== CONTEXTO ESTRATÉGICO (FUENTE CANÓNICA DE VERDAD) ===\n";
      if (strategicContext) strategicBlock += `CONTEXTO DEL PROYECTO: ${strategicContext}\n`;
      if (strategicFocus) strategicBlock += `ENFOQUE ESPECÍFICO: ${strategicFocus}\n`;
      if (knownCases.length > 0) {
        strategicBlock += `\nCASOS/HECHOS/ENTIDADES CONOCIDOS YA DESCRITOS EN EL ENFOQUE (NO recategorizar como "nuevos"):\n${knownCases.map(c => `  - ${c}`).join('\n')}\n`;
      }
      if (verifiedCounts.length > 0) {
        strategicBlock += `\n=== CONTEOS VERIFICADOS (HECHOS AUDITABLES — USAR LITERALMENTE) ===\n`;
        strategicBlock += `Estos conteos provienen de un escaneo determinístico sobre las ${mentions.length} menciones del universo (no muestra). Son la ÚNICA fuente válida de cifras de cobertura por término:\n`;
        verifiedCounts.forEach(v => {
          strategicBlock += `  - "${v.term}": ${v.count} mención(es) en el universo total\n`;
        });
        strategicBlock += `\nREGLAS DE USO DE CONTEOS:\n`;
        strategicBlock += `  1. Si una narrativa se refiere a un término listado, DEBES usar EXACTAMENTE el conteo verificado correspondiente — no estimes ni redondees a partir de la muestra.\n`;
        strategicBlock += `  2. Si un término NO aparece en esta lista, NO inventes un número específico: usa lenguaje cualitativo ("varias menciones", "presencia recurrente", "porción minoritaria de la conversación").\n`;
        strategicBlock += `  3. PROHIBIDO afirmar "una sola mención", "solo X menciones" o cualquier cifra exacta para términos no listados aquí.\n`;
      } else {
        strategicBlock += `\n=== SIN CONTEOS VERIFICADOS DISPONIBLES ===\nNO uses cifras exactas para casos del Enfoque Estratégico. Usa lenguaje cualitativo: "varias menciones", "presencia recurrente", "porción minoritaria".\n`;
      }
      strategicBlock += `\nIMPORTANTE: Usa este contexto para INTERPRETAR el sentimiento. Lo negativo hacia un actor externo puede ser positivo para el cliente. Evalúa cada hallazgo según cómo impacta a la marca/entidad principal en este contexto.\n`;
    }

    const formatInstructions = `FORMATO: Reporte COMPLETO (4-6 páginas A4). Sé exhaustivo y detallado.
- summary: 5-8 oraciones
- keyFindings: 5-8
- recommendations: 4-6 (2-3 oraciones detalladas cada una, con plataforma, mensaje y plazo)
- narratives: 4-8
- conclusions: 3-5`;

    const entityComparisonInstruction = hasDistinctEntities
      ? `\n"entityComparison": "string - Párrafo comparando volumen, sentimiento y cobertura entre las entidades: ${entityNames!.join(', ')}. Incluye share of voice y diferenciadores."`
      : "";

    const systemPrompt = `Eres un ANALISTA SENIOR de inteligencia estratégica y monitoreo de medios.

TU AUDIENCIA: ${projectAudience}
OBJETIVO DEL MONITOREO: ${projectObjective}

PRINCIPIOS:
1. ESPECIFICIDAD: Usa nombres de fuentes, autores, fechas. Nunca "varias fuentes" o "algunos medios".
2. CUANTIFICACIÓN: Incluye números, porcentajes, comparaciones.
3. CONTEXTO ESTRATÉGICO: Usa el enfoque estratégico para INTERPRETAR el sentimiento — lo negativo hacia un actor externo puede ser positivo para el cliente.
4. ACCIONABILIDAD: Cada insight debe poder convertirse en una decisión concreta.

=== REGLA CRÍTICA #1: LENGUAJE CAUTELOSO Y CIFRAS AUDITABLES ===
NUNCA hagas afirmaciones absolutas sobre la ausencia o presencia de información. Los datos que recibes son UNA MUESTRA textual, pero los CONTEOS VERIFICADOS abarcan el universo completo.
- PROHIBIDO: "No se identificaron menciones que...", "No existe evidencia de...", "No hay menciones que vinculen..."
- PROHIBIDO inventar cifras exactas ("una sola mención", "solo 3 menciones", "apenas 2 referencias") para temas/términos que NO aparezcan en CONTEOS VERIFICADOS. Para esos casos usa lenguaje cualitativo: "varias menciones", "presencia recurrente", "porción minoritaria de la conversación", "cobertura puntual".
- OBLIGATORIO cuando exista CONTEO VERIFICADO: usa el número EXACTO listado, ni más ni menos. Ej: si "Actinver: 14" → escribe "14 menciones vinculadas a Actinver", nunca "1 mención" ni "varias decenas".
- OBLIGATORIO en general: "En la muestra analizada...", "Con base en los datos disponibles...", "De las ${metrics.totalMentions} menciones recopiladas...", "En el periodo y fuentes monitoreadas..."
- Si hay pocas menciones sobre un tema sin conteo verificado, di "se detectó baja presencia de este tema en la muestra" — NUNCA "no existe" ni cifres exacto.
- Cada hallazgo debe estar respaldado por datos concretos. No inventes ni extrapoles más allá de lo observable.

=== REGLA CRÍTICA #2: NO INVENTAR EVENTOS NUEVOS — ANCLAR AL ENFOQUE ESTRATÉGICO ===
El CONTEXTO ESTRATÉGICO y los CASOS/HECHOS CONOCIDOS listados arriba son la VERDAD CANÓNICA. Si una mención coincide temáticamente con un caso ya descrito, DEBES tratarla como parte de ese caso, NO como un evento independiente.
- PROHIBIDO usar adjetivos como "nuevo", "otro", "adicional", "segundo", "distinto", "emergente" o "separado" para describir hechos, fraudes, litigios, demandas, casos, controversias o investigaciones que ya estén mencionados o sean razonablemente subsumibles en el Enfoque Estratégico.
- PROHIBIDO inferir la existencia de eventos no documentados en las menciones (ej: "un nuevo fraude", "otra acusación") a partir de cobertura mediática que pueda referirse al mismo hecho ya conocido.
- OBLIGATORIO cuando una narrativa coincida con un caso conocido: referenciarla explícitamente con frases como "vinculada al [litigio/caso/disputa] descrito en el Enfoque Estratégico", "en el marco del caso ya documentado", "como parte de la cobertura del litigio referido en el contexto del proyecto".
- Ante AMBIGÜEDAD entre "es el mismo caso" vs "es un caso nuevo": SIEMPRE asume que es el mismo caso ya descrito en el Enfoque Estratégico, salvo que las menciones aporten evidencia explícita e inequívoca de un evento distinto (fechas, contrapartes y hechos diferentes claramente nombrados).
- Antes de calificar algo como "nuevo" o "adicional", verifica que NO esté listado en CASOS/HECHOS CONOCIDOS y que las menciones lo describan como un evento factualmente distinto.

=== ALCANCE ESTRICTO DE RECOMENDACIONES ===
Las recomendaciones deben limitarse EXCLUSIVAMENTE al ámbito de monitoreo digital y escucha social:
- SÍ: Ajustar keywords de monitoreo, agregar fuentes, configurar alertas, ampliar cobertura de plataformas, crear dashboards, segmentar análisis por entidad/plataforma, rastrear influenciadores específicos, ajustar frecuencia de monitoreo.
- NO: Comunicados de prensa, estrategia de contenido, campañas de marketing, relaciones públicas, asesoría legal, decisiones operativas o de negocio, comunicación reactiva/proactiva con medios.
- Si detectas una situación que requiera acción fuera del ámbito digital, limítate a SEÑALARLO como hallazgo ("Se detecta riesgo reputacional que podría requerir atención del área de comunicación") sin prescribir la acción.

FORMATO: Español profesional, sin markdown ni asteriscos. Cita fuentes y autores específicos.`;

    const userPrompt = `${formatInstructions}
${strategicBlock}
=== PROYECTO ===
PROYECTO: ${projectName}
PERIODO: ${dateRange.label} (${dateRange.start} a ${dateRange.end})
${entityNames?.length ? `ENTIDADES: ${entityNames.join(", ")}` : ""}

=== MÉTRICAS ===
Total: ${metrics.totalMentions} | Positivas: ${metrics.positiveCount} (${Math.round(metrics.positiveCount/metrics.totalMentions*100)}%) | Negativas: ${metrics.negativeCount} (${Math.round(metrics.negativeCount/metrics.totalMentions*100)}%) | Neutrales: ${metrics.neutralCount} (${Math.round(metrics.neutralCount/metrics.totalMentions*100)}%)
Fuentes: ${metrics.topSources.join(", ")}

${detailedAnalysis}

=== MUESTRA (${mentionsSummary.length} de ${mentions.length}) ===
${JSON.stringify(mentionsSummary, null, 2)}

=== RESPONDE EN JSON ===
{
  "title": "string - título profesional",
  "summary": "string - brief ejecutivo con hallazgos críticos, fuentes y números",
  "impactAssessment": "string - cómo los eventos afectan a la marca/entidad en el contexto estratégico",
  "sentimentAnalysis": "string - distribución de sentimiento y sus drivers, interpretado según el contexto estratégico",
  "narratives": [
    {
      "narrative": "string - nombre de la narrativa temática (ej: 'Cuestionamiento de transparencia')",
      "description": "string - qué dice, quién la promueve, en qué medios",
      "mentions": number,
      "sentiment": "positivo | negativo | mixto",
      "trend": "creciente | decreciente | estable"
    }
  ],${entityComparisonInstruction}
  "keyFindings": ["string - hallazgo específico citando fuentes y datos"],
  "conclusions": ["string - conclusión ESTRATÉGICA integrando múltiples datos"],
  "recommendations": ["string - recomendación detallada: qué, dónde, cómo, cuándo"],
  "templates": {
    "executive": "string - 3-4 párrafos para directivos",
    "technical": "string - 3-4 párrafos para analistas",
    "public": "string - 2-3 párrafos con emojis para WhatsApp"
  }
}

SOBRE "narratives": Identifica NARRATIVAS TEMÁTICAS (ideas/argumentos recurrentes, NO keywords ni nombres propios). Ordénalas por frecuencia.`;

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
        max_tokens: MAX_TOKENS + 1000,
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
              title: titleMatch?.[1] || "Reporte Inteligente",
              summary: summaryMatch?.[1] || "Resumen generado parcialmente.",
              keyFindings: keyFindings.length > 0 ? keyFindings : ["Reporte generado con información parcial"],
              recommendations: ["Reintentar generación para obtener análisis completo"],
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
        title: titleMatch?.[1] || "Reporte Inteligente",
        summary: summaryMatch?.[1] || cleanText.substring(0, 500),
        keyFindings: ["Reporte generado con información parcial — se recomienda reintentar"],
        recommendations: ["Reintentar generación para obtener análisis completo"],
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
      conclusions: reportContent.conclusions || [],
      impactAssessment: reportContent.impactAssessment || undefined,
      sentimentAnalysis: reportContent.sentimentAnalysis || undefined,
      narratives: reportContent.narratives || [],
      entityComparison: reportContent.entityComparison || undefined,
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
