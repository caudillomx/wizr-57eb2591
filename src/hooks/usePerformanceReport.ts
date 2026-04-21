import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FKProfile, FKProfileKPI, FKDailyTopPost } from "./useFanpageKarma";

type FKProfileExt = FKProfile & { is_competitor?: boolean };
import { getFKProfileDisplayName } from "@/lib/fkProfileUtils";

export type PerformanceReportMode = "brand" | "benchmark";

export interface PerformanceReportHighlight {
  label: string;
  value: string;
  context: string;
}

export interface PerformanceNetworkBreakdown {
  network: string;
  followers: number;
  avgEngagement: number;
  avgGrowth: number;
  postsPerDay: number;
  profileCount: number;
}

export interface PerformanceReportAnalytics {
  networks: string[];
  avgEngagement: number;
  avgGrowth: number;
  totalFollowers: number;
  avgPostsPerDay: number;
  followersByNetwork: PerformanceNetworkBreakdown[];
  bestNetworkByEngagement: { network: string; engagement: number } | null;
  bestNetworkByGrowth: { network: string; growth: number } | null;
  riskNetwork: { network: string; growth: number } | null;
  bestPerformer: { name: string; network: string; engagement: number } | null;
  fastestGrower: { name: string; network: string; growth: number } | null;
  shareOfVoice: Array<{ name: string; isOwn: boolean; engagementShare: number; followersShare: number }>;
  rankingByEngagement: Array<{ name: string; network: string; engagement: number; isOwn: boolean; hasData: boolean }>;
  // Benchmark-only
  ownPosition: { rank: number; total: number } | null;
  ownEngagementShare: number;
  gapToLeader: { leaderName: string; leaderNetwork: string; gapPercent: number } | null;
  topCompetitor: { name: string; engagement: number } | null;
}

export interface PerformanceTopPostSnapshot {
  authorName: string;
  network: string;
  postDate: string;
  postContent: string | null;
  postUrl: string | null;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export interface PerformanceProfileSnapshot {
  id: string;
  name: string;
  network: string;
  isCompetitor: boolean;
  followers: number | null;
  growthPercent: number | null;
  engagementRate: number | null;
  postsPerDay: number | null;
  performanceIndex: number | null;
}

export interface PerformanceReportContent {
  title: string;
  summary: string;
  highlights: PerformanceReportHighlight[];
  keyFindings: string[];
  recommendations: string[];
  topContentInsight: string;
  competitiveInsight: string;
  conclusion: string;
  // Snapshot of the data the report was based on (for the public view)
  reportMode: PerformanceReportMode;
  clientName: string;
  brandName?: string;
  analytics: PerformanceReportAnalytics;
  profiles: PerformanceProfileSnapshot[];
  topPosts: PerformanceTopPostSnapshot[];
}

export interface PerformanceReportConfig {
  reportMode: PerformanceReportMode;
  clientName: string;
  brandName?: string;
  strategicFocus?: string;
  dateRange: { start: string; end: string; label: string };
}

function pct(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeAnalytics(
  profiles: FKProfileExt[],
  kpis: FKProfileKPI[],
): PerformanceReportAnalytics {
  const networks = Array.from(new Set(profiles.map((p) => p.network)));

  const validEng = kpis
    .map((k) => Number(k.engagement_rate))
    .filter((v) => Number.isFinite(v) && v > 0);
  const validGrowth = kpis
    .map((k) => Number(k.follower_growth_percent))
    .filter((v) => Number.isFinite(v));
  const totalFollowers = kpis.reduce(
    (s, k) => s + (Number(k.followers) > 0 ? Number(k.followers) : 0),
    0,
  );

  const avgEngagement = validEng.length
    ? pct(validEng.reduce((s, v) => s + v, 0) / validEng.length)
    : 0;
  const avgGrowth = validGrowth.length
    ? pct(validGrowth.reduce((s, v) => s + v, 0) / validGrowth.length)
    : 0;

  // Best performer by engagement_rate
  let bestPerformer: PerformanceReportAnalytics["bestPerformer"] = null;
  let fastestGrower: PerformanceReportAnalytics["fastestGrower"] = null;
  let bestEng = -Infinity;
  let bestGrowth = -Infinity;

  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    if (!k) continue;
    const eng = Number(k.engagement_rate);
    const gr = Number(k.follower_growth_percent);
    const name = getFKProfileDisplayName(p);
    if (Number.isFinite(eng) && eng > bestEng) {
      bestEng = eng;
      bestPerformer = { name, network: p.network, engagement: pct(eng) };
    }
    if (Number.isFinite(gr) && gr > bestGrowth) {
      bestGrowth = gr;
      fastestGrower = { name, network: p.network, growth: pct(gr) };
    }
  }

  // Share of voice: % of total engagement contribution and % of total followers
  const totalEngContribution = profiles.reduce((s, p) => {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const eng = Number(k?.engagement_rate);
    return s + (Number.isFinite(eng) && eng > 0 ? eng : 0);
  }, 0) || 1;

  const totalFollowersForShare = totalFollowers || 1;

  const shareOfVoice = profiles.map((p) => {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const eng = Number(k?.engagement_rate);
    const fol = Number(k?.followers);
    return {
      name: getFKProfileDisplayName(p),
      isOwn: !p.is_competitor,
      engagementShare: pct(((Number.isFinite(eng) && eng > 0 ? eng : 0) / totalEngContribution) * 100),
      followersShare: pct(((Number.isFinite(fol) && fol > 0 ? fol : 0) / totalFollowersForShare) * 100),
    };
  });

  const rankingByEngagement = profiles
    .map((p) => {
      const k = kpis.find((kp) => kp.fk_profile_id === p.id);
      const eng = Number(k?.engagement_rate);
      const hasData = Number.isFinite(eng) && eng > 0;
      return {
        name: getFKProfileDisplayName(p),
        network: p.network,
        engagement: hasData ? pct(eng) : 0,
        isOwn: !p.is_competitor,
        hasData,
      };
    })
    .sort((a, b) => {
      // Profiles with data always come first
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      return b.engagement - a.engagement;
    });

  return {
    networks,
    avgEngagement,
    avgGrowth,
    totalFollowers,
    bestPerformer,
    fastestGrower,
    shareOfVoice,
    rankingByEngagement,
  };
}

function buildSnapshots(
  profiles: FKProfileExt[],
  kpis: FKProfileKPI[],
  topPosts: FKDailyTopPost[],
): { profiles: PerformanceProfileSnapshot[]; topPosts: PerformanceTopPostSnapshot[] } {
  const profileSnapshots: PerformanceProfileSnapshot[] = profiles.map((p) => {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    return {
      id: p.id,
      name: getFKProfileDisplayName(p),
      network: p.network,
      isCompetitor: !!p.is_competitor,
      followers: k?.followers ?? null,
      growthPercent: k?.follower_growth_percent ?? null,
      engagementRate: k?.engagement_rate ?? null,
      postsPerDay: k?.posts_per_day ?? null,
      performanceIndex: k?.page_performance_index ?? null,
    };
  });

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const topPostSnapshots: PerformanceTopPostSnapshot[] = [...topPosts]
    .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
    .slice(0, 10)
    .map((tp) => {
      const profile = profileById.get(tp.fk_profile_id);
      return {
        authorName: profile ? getFKProfileDisplayName(profile) : "—",
        network: tp.network,
        postDate: tp.post_date,
        postContent: tp.post_content,
        postUrl: tp.post_url,
        engagement: tp.engagement || 0,
        likes: tp.likes || 0,
        comments: tp.comments || 0,
        shares: tp.shares || 0,
        views: tp.views || 0,
      };
    });

  return { profiles: profileSnapshots, topPosts: topPostSnapshots };
}

export function usePerformanceReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<PerformanceReportContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateReport = async (
    profilesIn: FKProfile[],
    kpis: FKProfileKPI[],
    topPosts: FKDailyTopPost[],
    config: PerformanceReportConfig,
  ): Promise<PerformanceReportContent | null> => {
    const profiles = profilesIn as FKProfileExt[];
    if (profiles.length === 0) {
      toast({
        title: "Sin perfiles",
        description: "No hay perfiles para generar el reporte",
        variant: "destructive",
      });
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const analytics = computeAnalytics(profiles, kpis);
      const snapshots = buildSnapshots(profiles, kpis, topPosts);

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-performance-report",
        {
          body: {
            reportMode: config.reportMode,
            clientName: config.clientName,
            brandName: config.brandName,
            dateRange: config.dateRange,
            strategicFocus: config.strategicFocus,
            profiles: profiles.map((p) => ({
              id: p.id,
              network: p.network,
              display_name: p.display_name,
              profile_id: p.profile_id,
              is_competitor: !!p.is_competitor,
              is_own_profile: p.is_own_profile,
            })),
            kpis: kpis.map((k) => ({
              fk_profile_id: k.fk_profile_id,
              followers: k.followers,
              follower_growth_percent: k.follower_growth_percent,
              engagement_rate: k.engagement_rate,
              posts_per_day: k.posts_per_day,
              page_performance_index: k.page_performance_index,
            })),
            topPosts: topPosts.slice(0, 50).map((tp) => ({
              fk_profile_id: tp.fk_profile_id,
              network: tp.network,
              post_content: tp.post_content,
              post_url: tp.post_url,
              engagement: tp.engagement,
              likes: tp.likes,
              comments: tp.comments,
              shares: tp.shares,
              views: tp.views,
              post_date: tp.post_date,
            })),
            analytics,
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const enriched: PerformanceReportContent = {
        title: data.title,
        summary: data.summary,
        highlights: data.highlights || [],
        keyFindings: data.keyFindings || [],
        recommendations: data.recommendations || [],
        topContentInsight: data.topContentInsight || "",
        competitiveInsight: data.competitiveInsight || "",
        conclusion: data.conclusion || "",
        reportMode: config.reportMode,
        clientName: config.clientName,
        brandName: config.brandName,
        analytics,
        profiles: snapshots.profiles,
        topPosts: snapshots.topPosts,
      };

      setReport(enriched);
      toast({ title: "Reporte generado", description: `"${enriched.title}" está listo` });
      return enriched;
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

  return { generateReport, clearReport, isGenerating, report, error };
}
