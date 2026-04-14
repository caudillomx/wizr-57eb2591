import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { subDays, format, eachDayOfInterval, startOfDay } from "date-fns";

export interface PanoramaMetrics {
  totalMentions: number;
  recentMentions: number;
  sentimentBreakdown: {
    positivo: number;
    neutral: number;
    negativo: number;
    sinAnalizar: number;
  };
  topSources: { domain: string; count: number }[];
  dailyActivity: { date: string; count: number }[];
  trend: "up" | "down" | "stable";
}

export function usePanoramaData(
  projectId: string | undefined,
  daysRange: number = 30,
  startDate?: Date,
  endDate?: Date
) {
  // Use explicit dates if provided, otherwise fall back to daysRange from now
  const effectiveStart = useMemo(
    () => startDate || subDays(new Date(), daysRange),
    [startDate, daysRange]
  );
  const effectiveEnd = useMemo(
    () => endDate || new Date(),
    [endDate]
  );

  const { data: mentions, isLoading } = useQuery({
    queryKey: ["panorama-mentions", projectId, effectiveStart.toISOString(), effectiveEnd.toISOString()],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("mentions")
        .select("id, sentiment, source_domain, created_at, published_at")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (error) throw error;

      console.log("[PanoramaData] Raw mentions from DB:", data?.length);
      console.log("[PanoramaData] Date range:", effectiveStart.toISOString(), "→", effectiveEnd.toISOString());

      // Filter by effective date (published_at or created_at) within the range
      const filtered = (data || []).filter((m) => {
        const d = m.published_at ? new Date(m.published_at) : new Date(m.created_at);
        return d >= effectiveStart && d <= effectiveEnd;
      });

      console.log("[PanoramaData] After date filter:", filtered.length);
      if (data && data.length > 0 && filtered.length === 0) {
        const sample = data[0];
        const sampleDate = sample.published_at ? new Date(sample.published_at) : new Date(sample.created_at);
        console.log("[PanoramaData] Sample mention date:", sampleDate.toISOString(), "published_at:", sample.published_at, "created_at:", sample.created_at);
      }

      return filtered;
    },
    enabled: !!projectId,
  });

  const metrics = useMemo((): PanoramaMetrics => {
    if (!mentions || mentions.length === 0) {
      return {
        totalMentions: 0,
        recentMentions: 0,
        sentimentBreakdown: { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 },
        topSources: [],
        dailyActivity: [],
        trend: "stable",
      };
    }

    const sevenDaysAgo = subDays(new Date(), 7);

    const sentimentBreakdown = { positivo: 0, neutral: 0, negativo: 0, sinAnalizar: 0 };
    mentions.forEach((m) => {
      const s = m.sentiment?.toLowerCase();
      if (s === "positivo" || s === "positive") sentimentBreakdown.positivo++;
      else if (s === "negativo" || s === "negative") sentimentBreakdown.negativo++;
      else if (s === "neutral") sentimentBreakdown.neutral++;
      else sentimentBreakdown.sinAnalizar++;
    });

    const recentMentions = mentions.filter((m) => {
      const d = m.published_at ? new Date(m.published_at) : new Date(m.created_at);
      return d > sevenDaysAgo;
    }).length;

    const sourceMap = new Map<string, number>();
    mentions.forEach((m) => {
      const domain = m.source_domain || "desconocido";
      sourceMap.set(domain, (sourceMap.get(domain) || 0) + 1);
    });
    const topSources = Array.from(sourceMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const dateRange = eachDayOfInterval({
      start: startOfDay(effectiveStart),
      end: startOfDay(effectiveEnd),
    });

    const dailyMap = new Map<string, number>();
    mentions.forEach((m) => {
      const d = m.published_at ? new Date(m.published_at) : new Date(m.created_at);
      const dateKey = format(d, "yyyy-MM-dd");
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
    });

    const dailyActivity = dateRange.map((d) => ({
      date: format(d, "yyyy-MM-dd"),
      count: dailyMap.get(format(d, "yyyy-MM-dd")) || 0,
    }));

    const olderMentions = mentions.length - recentMentions;
    const avgOlder = olderMentions / Math.max(1, (daysRange - 7) / 7);
    let trend: "up" | "down" | "stable" = "stable";
    if (recentMentions > avgOlder * 1.2) trend = "up";
    else if (recentMentions < avgOlder * 0.8) trend = "down";

    return {
      totalMentions: mentions.length,
      recentMentions,
      sentimentBreakdown,
      topSources,
      dailyActivity,
      trend,
    };
  }, [mentions, effectiveStart, effectiveEnd, daysRange]);

  return { metrics, isLoading };
}
