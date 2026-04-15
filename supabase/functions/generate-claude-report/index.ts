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
  dateRange: { start: string; end: string; label: string };
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
  const topAuthors = Object.values(authorMap).sort((a, b) => b.engagement - a.engagement).slice(0, 15);

  const byDate: Record<string, number> = {};
  mentions.forEach(m => {
    const date = (m.published_at || m.created_at || "").split("T")[0];
    if (date) byDate[date] = (byDate[date] || 0) + 1;
  });
  const sortedDates = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));

  let analysis = "DISTRIBUCIÓN DE SENTIMIENTO:\n";
  analysis += `- Positivas: ${positive.length} (${(positive.length / mentions.length * 100).toFixed(1)}%)\n`;
  analysis += `- Negativas: ${negative.length} (${(negative.length / mentions.length * 100).toFixed(1)}%)\n`;
  analysis += `- Neutrales: ${neutral.length} (${(neutral.length / mentions.length * 100).toFixed(1)}%)\n\n`;

  const sortedSources = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length);
  analysis += "TOP FUENTES/MEDIOS:\n";
  sortedSources.slice(0, 10).forEach(([source, items]) => {
    const posCount = items.filter(i => i.sentiment === "positivo").length;
    const negCount = items.filter(i => i.sentiment === "negativo").length;
    const totalEng = items.reduce((sum, i) => {
      const meta = i.raw_metadata;
      return sum + ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0);
    }, 0);
    analysis += `- ${source}: ${items.length} menciones (${posCount} pos, ${negCount} neg, ${totalEng} interacciones)\n`;
  });
  analysis += "\n";

  if (topAuthors.length > 0) {
    analysis += "INFLUENCIADORES / AUTORES PRINCIPALES (por engagement):\n";
    topAuthors.forEach((a, i) => {
      const negCount = a.sentiment.filter(s => s === "negativo").length;
      const posCount = a.sentiment.filter(s => s === "positivo").length;
      analysis += `${i + 1}. ${a.name}${a.username ? ` (@${a.username})` : ""} [${a.platform}]: ${a.count} menciones, ${a.engagement.toLocaleString()} interacciones, sentimiento ${negCount > posCount ? "mayormente negativo" : posCount > negCount ? "mayormente positivo" : "mixto"}\n`;
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
    negative.slice(0, 10).forEach((m, i) => {
      const meta = m.raw_metadata;
      const author = (meta?.author || meta?.author_name || meta?.author_username || "") as string;
      const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0);
      analysis += `${i + 1}. [${m.source_domain}]${author ? " por " + author : ""} "${m.title || ''}": ${(m.description || '').substring(0, 250)}${eng ? ` (${eng} interacciones)` : ""}\n`;
    });
    analysis += "\n";
  }

  if (positive.length > 0) {
    analysis += "MUESTRA DE MENCIONES POSITIVAS:\n";
    positive.slice(0, 5).forEach((m, i) => {
      analysis += `${i + 1}. [${m.source_domain}] ${m.title || ''}: ${(m.description || '').substring(0, 200)}\n`;
    });
  }

  return analysis;
}

function buildPrompt(body: ReportRequest): string {
  const { mentions, reportType, projectName, projectAudience, projectObjective, strategicContext, strategicFocus, entityNames, dateRange } = body;

  const detailedAnalysis = buildDetailedMentionAnalysis(mentions);

  const mentionsSample = mentions.slice(0, 40).map(m => {
    const meta = m.raw_metadata;
    return {
      title: m.title,
      description: m.description?.substring(0, 300),
      source: m.source_domain,
      sentiment: m.sentiment,
      keywords: m.matched_keywords?.join(", "),
      date: (m.published_at || m.created_at)?.split("T")[0],
      author: (meta?.author || meta?.author_name || meta?.authorUsername || null) as string | null,
      likes: (meta?.likes as number) || 0,
      comments: (meta?.comments as number) || 0,
      shares: (meta?.shares as number) || 0,
    };
  });

  return `You are an expert information designer, data journalist, and strategic communications analyst specializing in digital monitoring reports for institutional clients in Mexico and Latin America (government, financial sector, business associations).

Your task in ONE response: analyze the raw mention data provided, draw intelligence conclusions, and return a complete self-contained HTML document that IS the report — no JSON intermediate, no templates. You write the analysis AND design the layout simultaneously, adapting the visual density and structure to what the data actually says.

REPORT CONTEXT
- Project: ${projectName}
- Period: ${dateRange.label} (${dateRange.start} to ${dateRange.end})
- Report type: ${reportType}
- Client audience: ${projectAudience}
- Monitoring objective: ${projectObjective}
${strategicContext ? `- Strategic context: ${strategicContext}` : ""}
${strategicFocus ? `- Specific focus: ${strategicFocus}` : ""}
${entityNames?.length ? `- Monitored entities: ${entityNames.join(", ")}` : ""}

RAW MENTION DATA
${detailedAnalysis}

SAMPLE MENTIONS (${mentionsSample.length} of ${mentions.length})
${JSON.stringify(mentionsSample, null, 2)}

YOUR ANALYSIS TASK
Before writing HTML, reason through:
1. What is the dominant story in this data?
2. What is the most urgent finding for this specific client?
3. What 3-5 narratives are driving the conversation?
4. Which recommendations are genuinely actionable vs generic?
5. How does the timeline shape the story (spike? sustained? declining)?
6. What conclusions SYNTHESIZE the situation — not repeat findings?

Then produce the HTML report incorporating that reasoning.

HTML DOCUMENT REQUIREMENTS
Return ONLY a complete HTML document starting with <!DOCTYPE html>. No explanations, no markdown fences, no backticks wrapping the output.

Dimensions & rendering:
- Body width: 794px fixed (A4 at 96dpi)
- All CSS inline or in one <style> block in <head>
- Only allowed external resource: https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap
- No JavaScript
- No SVG charts, no canvas, no external chart libraries
- All charts: pure HTML/CSS horizontal or vertical bars

Color system by report type:
- Crisis: #dc2626 headers, #fef2f2 alert bg, red left borders on key items
- Brief: #6366f1 headers, clean neutral
- Thematic: #7c3aed headers
- Comparative: #0f766e headers
- Always use: Dark text #111827, Body text #374151 (NEVER #64748b for substantive content — only metadata), Surface #f8fafc, Border #e2e8f0, Positive #22c55e, Negative #ef4444, Neutral #94a3b8

Typography — 3 mandatory levels, never flat:
- Section headers: 10px uppercase, letter-spacing 0.08em, white on accent bg, bold
- Item titles: 13px, font-weight 500, #111827
- Body/descriptions: 12px, font-weight 400, #374151
- Metadata only: 11px, #6b7280

Numbered circles — CRITICAL (html2canvas breaks flexbox centering):
ALWAYS use this exact pattern:
<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:ACCENT;color:#fff;text-align:center;line-height:22px;font-size:11px;font-weight:700;flex-shrink:0;">1</span>
NEVER use display:flex + alignItems:center for circles.

Chart labels — CRITICAL:
- Label column: exactly 140px wide, font-size 10px, overflow:hidden, text-overflow:ellipsis, white-space:nowrap
- Timeline: show MAX 7 data points. If timeline has more, sample evenly.
- Bar values: show inside bar if bar > 25% width (white text 9px), otherwise show to the right (dark text 9px)

Page break handling:
- Main content wrapper: padding: 24px 24px 20px
- Gap between sections: 14px
- Every section div: page-break-inside:avoid; break-inside:avoid
- Every individual list item (finding, recommendation, narrative): page-break-inside:avoid; break-inside:avoid
- Add page-break-before:always on the Recommendations section if there are 5+ recommendations

Mandatory report sections (in order):
1. HEADER — dark bg (#0f172a), logo text "WIZR" left (font-weight:700, letter-spacing:0.15em, font-size:18px, color:white), report type badge + title + period right
2. METRICS ROW — 5 KPI cards: Estimated Impressions, Total Mentions, Estimated Reach, % Negative, % Positive. Use impressions formula: (likes+comments+shares) * platform_multiplier (twitter=80, facebook=60, instagram=100, tiktok=120, youtube=150, news=40, other=30). Reach = 65% of impressions.
3. SENTIMENT BAR — full-width stacked bar (positive/neutral/negative with % labels), legend below
4. CRISIS BANNER — only for reportType=crisis: red left border card with urgency message
5. EXECUTIVE SUMMARY — your written analysis paragraph (not a template — write it based on what the data shows)
6. DATA VISUALIZATION — 2-column grid: (a) mentions by platform horizontal bars, (b) daily timeline vertical bars, (c) sentiment by platform stacked bars, (d) top influencers by interactions horizontal bars
7. KEY FINDINGS — numbered list with circles, 5-7 findings, each citing specific sources/authors/numbers
8. INFLUENCERS TABLE — styled table with #, profile, network, mentions, sentiment (colored), interactions
9. MAIN NARRATIVES — cards with narrative title, sentiment badge, mention count, trend indicator, description
10. STRATEGIC RECOMMENDATIONS — numbered list with circles, 5-7 recommendations, each 2-3 sentences with specific platform/timeframe/action
11. CONCLUSIONS — 3-4 paragraphs that SYNTHESIZE (not repeat findings). Cover: overall situation assessment, trajectory, key decision point for client, next 72 hours outlook.
12. FOOTER — dark bar: "WIZR" left, "${projectName} · Generado con Wizr" center, generation date right

Fill empty space intelligently:
If a section is short and would leave a page with whitespace, add a highlighted insight card between sections:
<div style="background:#f0f9ff;border-left:3px solid #3b82f6;padding:10px 14px;margin:10px 0;border-radius:4px;">
  <span style="font-weight:600;font-size:11px;color:#1e40af;">Dato destacado</span>
  <p style="font-size:12px;color:#374151;margin:4px 0 0;">{{a specific data insight you choose}}</p>
</div>

Quality bar:
- Every finding must cite a specific source, author, or number from the data
- Recommendations must name specific platforms, timelines, and actions — never "monitor the situation"
- Conclusions must be a genuine synthesis — if any conclusion sentence could also appear in Key Findings verbatim, rewrite it
- The report must read as if written by a senior analyst who reviewed the data, not as a template filled with variables
- Write the ENTIRE report in Spanish (es-MX)`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const body: ReportRequest = await req.json();

    if (!body.mentions || body.mentions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No mentions provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating Claude report: ${body.reportType}, ${body.mentions.length} mentions, project: ${body.projectName}`);

    const prompt = buildPrompt(body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 12000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let html = data.content?.[0]?.text || "";

    // Strip markdown fences if Claude wrapped it
    if (html.startsWith("```html")) {
      html = html.replace(/^```html\s*/, "").replace(/\s*```$/, "");
    } else if (html.startsWith("```")) {
      html = html.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    console.log(`Claude report generated successfully, HTML length: ${html.length}`);

    return new Response(
      JSON.stringify({ html }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-claude-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
