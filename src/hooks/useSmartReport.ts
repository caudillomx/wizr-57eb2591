import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Mention } from "./useMentions";

export type ReportType = "brief" | "crisis" | "thematic" | "comparative";
export type ReportExtension = "micro" | "short" | "medium";

export interface SmartReportMetrics {
  totalMentions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  topSources: string[];
  estimatedImpressions: number;
  estimatedReach: number;
}

export interface SmartReportTemplates {
  executive: string;
  technical: string;
  public: string;
}

export interface SourceBreakdown {
  source: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface InfluencerInfo {
  name: string;
  username: string;
  avatarUrl: string | null;
  platform: string;
  mentions: number;
  sentiment: string;
  reach: string;
}

export interface TimelinePoint {
  date: string;
  count: number;
  negative: number;
  positive: number;
}

export interface NarrativeInfo {
  keyword: string;
  count: number;
  positive: number;
  negative: number;
  neutral: number;
  trend: "up" | "down" | "stable";
}

export interface SmartReportContent {
  title: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: SmartReportMetrics;
  templates: SmartReportTemplates;
  impactAssessment?: string;
  sourceBreakdown: SourceBreakdown[];
  influencers: InfluencerInfo[];
  timeline: TimelinePoint[];
  narratives: NarrativeInfo[];
  sentimentAnalysis?: string;
  totalUniqueAuthors: number;
}

export interface SmartReportConfig {
  reportType: ReportType;
  extension: ReportExtension;
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

export function useSmartReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<SmartReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Compute enriched analytics from mentions
  const computeAnalytics = (mentions: Mention[]) => {
    // Source breakdown — normalize domains first
    const normalizeDomain = (d: string): string => {
      const map: Record<string, string> = {
        "twitter": "twitter.com", "x.com": "twitter.com",
        "facebook": "facebook.com", "www.facebook.com": "facebook.com",
        "youtube": "youtube.com", "www.youtube.com": "youtube.com",
        "instagram": "instagram.com", "www.instagram.com": "instagram.com",
        "tiktok": "tiktok.com", "www.tiktok.com": "tiktok.com",
        "reddit": "reddit.com", "www.reddit.com": "reddit.com",
        "linkedin": "linkedin.com", "www.linkedin.com": "linkedin.com",
      };
      return map[d] || d.replace(/^www\./, "");
    };

    const sourceMap: Record<string, { count: number; positive: number; negative: number; neutral: number }> = {};
    mentions.forEach(m => {
      const src = normalizeDomain(m.source_domain || "desconocido");
      if (!sourceMap[src]) sourceMap[src] = { count: 0, positive: 0, negative: 0, neutral: 0 };
      sourceMap[src].count++;
      if (m.sentiment === "positivo") sourceMap[src].positive++;
      else if (m.sentiment === "negativo") sourceMap[src].negative++;
      else if (m.sentiment === "neutral") sourceMap[src].neutral++;
    });
    const sourceBreakdown: SourceBreakdown[] = Object.entries(sourceMap)
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.count - a.count);

    // Influencers from raw_metadata + text/URL inference
    const inferAuthorFromText = (title?: string | null, description?: string | null, url?: string): string | null => {
      // Try to extract @username from title or description
      const text = `${title || ""} ${description || ""}`;
      const mentionMatch = text.match(/@([A-Za-z0-9_]{2,})/);
      if (mentionMatch) return mentionMatch[1];
      // Try to extract from social URL patterns
      if (url) {
        const twitterMatch = url.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i);
        if (twitterMatch && !["search", "hashtag", "i", "intent"].includes(twitterMatch[1].toLowerCase())) return twitterMatch[1];
        const fbMatch = url.match(/facebook\.com\/([A-Za-z0-9_.]+)/i);
        if (fbMatch && !["permalink.php", "profile.php", "story.php", "watch", "groups", "pages"].includes(fbMatch[1].toLowerCase())) return fbMatch[1];
        const igMatch = url.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
        if (igMatch && !["p", "reel", "explore", "stories"].includes(igMatch[1].toLowerCase())) return igMatch[1];
      }
      return null;
    };

    const authorMap: Record<string, { name: string; username: string; avatarUrl: string | null; platform: string; mentions: number; sentiments: string[]; engagement: number }> = {};
    mentions.forEach(m => {
      const meta = m.raw_metadata as Record<string, unknown> | null;
      let authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
      let username = (meta?.authorUsername || meta?.author_username || "") as string;
      const avatarUrl = (meta?.authorAvatarUrl || meta?.author_avatar_url || meta?.profileImageUrl || null) as string | null;

      // Fallback: infer from text/URL when metadata is empty
      if (!authorName) {
        const inferred = inferAuthorFromText(m.title, m.description, m.url);
        if (inferred) {
          authorName = inferred;
          username = inferred;
        } else {
          return; // truly no author info
        }
      }

      const normalizedPlatform = normalizeDomain(m.source_domain || "unknown");
      const key = `${authorName.toLowerCase()}@${normalizedPlatform}`;
      if (!authorMap[key]) {
        authorMap[key] = { name: authorName, username: username || authorName, avatarUrl, platform: normalizedPlatform, mentions: 0, sentiments: [], engagement: 0 };
      }
      authorMap[key].mentions++;
      if (m.sentiment) authorMap[key].sentiments.push(m.sentiment);
      const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0);
      authorMap[key].engagement += eng;
    });
    const influencers: InfluencerInfo[] = Object.values(authorMap)
      .sort((a, b) => b.engagement - a.engagement || b.mentions - a.mentions)
      .slice(0, 20)
      .map(a => {
        const negRatio = a.sentiments.filter(s => s === "negativo").length / (a.sentiments.length || 1);
        const posRatio = a.sentiments.filter(s => s === "positivo").length / (a.sentiments.length || 1);
        const sentiment = negRatio > 0.5 ? "negativo" : posRatio > 0.5 ? "positivo" : "mixto";
        return {
          name: a.name,
          username: a.username,
          avatarUrl: a.avatarUrl,
          platform: a.platform,
          mentions: a.mentions,
          sentiment,
          reach: a.engagement > 0 ? `${a.engagement.toLocaleString()} interacciones` : "N/D",
        };
      });

    // Timeline by day
    const dayMap: Record<string, { count: number; negative: number; positive: number }> = {};
    mentions.forEach(m => {
      const date = (m.published_at || m.created_at || "").split("T")[0];
      if (!date) return;
      if (!dayMap[date]) dayMap[date] = { count: 0, negative: 0, positive: 0 };
      dayMap[date].count++;
      if (m.sentiment === "negativo") dayMap[date].negative++;
      if (m.sentiment === "positivo") dayMap[date].positive++;
    });
    const timeline: TimelinePoint[] = Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));

    // ── Estimated Impressions & Reach ──
    // Industry-standard multipliers: engagement × platform factor
    const PLATFORM_MULTIPLIERS: Record<string, number> = {
      "twitter.com": 25,
      "facebook.com": 30,
      "instagram.com": 20,
      "linkedin.com": 15,
      "tiktok.com": 12,
      "youtube.com": 8,
      "reddit.com": 18,
    };

    let estimatedImpressions = 0;
    mentions.forEach(m => {
      const meta = m.raw_metadata as Record<string, unknown> | null;
      const views = Number(meta?.views) || 0;
      const likes = Number(meta?.likes) || 0;
      const comments = Number(meta?.comments) || 0;
      const shares = Number(meta?.shares) || 0;
      const engagement = likes + comments + shares;
      const platform = normalizeDomain(m.source_domain || "unknown");

      if (views > 0) {
        // Use actual views as impressions
        estimatedImpressions += views;
      } else if (engagement > 0) {
        // Estimate: engagement × platform-specific multiplier
        const multiplier = PLATFORM_MULTIPLIERS[platform] || 20;
        estimatedImpressions += engagement * multiplier;
      } else {
        // Minimal footprint: at least 1 impression per mention
        estimatedImpressions += 50;
      }
    });

    // Estimated Reach = ~65% of impressions (accounts for repeat viewers)
    const estimatedReach = Math.round(estimatedImpressions * 0.65);

    const totalUniqueAuthors = Object.keys(authorMap).length;

    // ── Narratives: top keywords with sentiment breakdown ──
    const kwMap: Record<string, { count: number; positive: number; negative: number; neutral: number; dates: string[] }> = {};
    mentions.forEach(m => {
      const kws = m.matched_keywords || [];
      const date = (m.published_at || m.created_at || "").split("T")[0];
      kws.forEach(kw => {
        const key = kw.toLowerCase().trim();
        if (!key || key.length < 2) return;
        if (!kwMap[key]) kwMap[key] = { count: 0, positive: 0, negative: 0, neutral: 0, dates: [] };
        kwMap[key].count++;
        if (m.sentiment === "positivo") kwMap[key].positive++;
        else if (m.sentiment === "negativo") kwMap[key].negative++;
        else kwMap[key].neutral++;
        if (date) kwMap[key].dates.push(date);
      });
    });

    const narratives: NarrativeInfo[] = Object.entries(kwMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12)
      .map(([keyword, data]) => {
        // Trend: compare first half vs second half of dates
        const sorted = data.dates.sort();
        const mid = Math.floor(sorted.length / 2);
        const firstHalf = sorted.slice(0, mid).length;
        const secondHalf = sorted.slice(mid).length;
        const trend: "up" | "down" | "stable" = secondHalf > firstHalf * 1.3 ? "up" : firstHalf > secondHalf * 1.3 ? "down" : "stable";
        return { keyword, count: data.count, positive: data.positive, negative: data.negative, neutral: data.neutral, trend };
      });

    return { sourceBreakdown, influencers, timeline, estimatedImpressions, estimatedReach, totalUniqueAuthors, narratives };
  };

  const generateReport = async (
    mentions: Mention[],
    config: SmartReportConfig
  ): Promise<SmartReportContent | null> => {
    if (mentions.length === 0) {
      toast({
        title: "Sin menciones",
        description: "No hay menciones disponibles para generar el reporte",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const analytics = computeAnalytics(mentions);

      const { data, error: fnError } = await supabase.functions.invoke("generate-smart-report", {
        body: {
          mentions: mentions.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            url: m.url,
            source_domain: m.source_domain,
            sentiment: m.sentiment,
            created_at: m.created_at,
            published_at: m.published_at,
            matched_keywords: m.matched_keywords,
            raw_metadata: m.raw_metadata,
          })),
          ...config,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Merge server AI analysis with client-side computed analytics
      const enrichedReport: SmartReportContent = {
        ...data,
        sourceBreakdown: analytics.sourceBreakdown,
        influencers: analytics.influencers,
        timeline: analytics.timeline,
        totalUniqueAuthors: analytics.totalUniqueAuthors,
        metrics: {
          ...data.metrics,
          estimatedImpressions: analytics.estimatedImpressions,
          estimatedReach: analytics.estimatedReach,
        },
      };

      setReport(enrichedReport);
      toast({
        title: "Reporte generado",
        description: `"${enrichedReport.title}" está listo`,
      });

      return enrichedReport;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      toast({
        title: "Error al generar reporte",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearReport = () => {
    setReport(null);
    setError(null);
  };

  return {
    generateReport,
    clearReport,
    isGenerating,
    report,
    error,
  };
}
