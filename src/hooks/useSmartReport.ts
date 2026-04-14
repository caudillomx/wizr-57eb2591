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
  sentimentAnalysis?: string;
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

    // Influencers from raw_metadata
    const authorMap: Record<string, { name: string; username: string; avatarUrl: string | null; platform: string; mentions: number; sentiments: string[]; engagement: number }> = {};
    mentions.forEach(m => {
      const meta = m.raw_metadata as Record<string, unknown> | null;
      const authorName = (meta?.author || meta?.author_name || meta?.authorName || meta?.author_username || meta?.authorUsername) as string | undefined;
      if (!authorName) return;
      const normalizedPlatform = normalizeDomain(m.source_domain || "unknown");
      const key = `${authorName}@${normalizedPlatform}`;
      if (!authorMap[key]) {
        const username = (meta?.authorUsername || meta?.author_username || "") as string;
        const avatarUrl = (meta?.authorAvatarUrl || meta?.author_avatar_url || meta?.profileImageUrl || null) as string | null;
        authorMap[key] = { name: authorName, username, avatarUrl, platform: normalizedPlatform, mentions: 0, sentiments: [], engagement: 0 };
      }
      authorMap[key].mentions++;
      if (m.sentiment) authorMap[key].sentiments.push(m.sentiment);
      const eng = ((meta?.likes as number) || 0) + ((meta?.comments as number) || 0) + ((meta?.shares as number) || 0);
      authorMap[key].engagement += eng;
    });
    const influencers: InfluencerInfo[] = Object.values(authorMap)
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 15)
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

    return { sourceBreakdown, influencers, timeline };
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
