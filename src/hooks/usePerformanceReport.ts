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

  // Followers + métricas por red social (agregado)
  const networkMap = new Map<string, { followers: number; engs: number[]; growths: number[]; posts: number[]; count: number }>();
  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const net = p.network;
    if (!networkMap.has(net)) networkMap.set(net, { followers: 0, engs: [], growths: [], posts: [], count: 0 });
    const bucket = networkMap.get(net)!;
    bucket.count += 1;
    const fol = Number(k?.followers);
    if (Number.isFinite(fol) && fol > 0) bucket.followers += fol;
    const eng = Number(k?.engagement_rate);
    if (Number.isFinite(eng) && eng > 0) bucket.engs.push(eng);
    const gr = Number(k?.follower_growth_percent);
    if (Number.isFinite(gr)) bucket.growths.push(gr);
    const ppd = Number(k?.posts_per_day);
    if (Number.isFinite(ppd) && ppd > 0) bucket.posts.push(ppd);
  }
  const followersByNetwork: PerformanceNetworkBreakdown[] = Array.from(networkMap.entries())
    .map(([network, b]) => ({
      network,
      followers: b.followers,
      avgEngagement: b.engs.length ? pct(b.engs.reduce((s, v) => s + v, 0) / b.engs.length) : 0,
      avgGrowth: b.growths.length ? pct(b.growths.reduce((s, v) => s + v, 0) / b.growths.length) : 0,
      postsPerDay: b.posts.length ? pct(b.posts.reduce((s, v) => s + v, 0) / b.posts.length) : 0,
      profileCount: b.count,
    }))
    .sort((a, b) => b.followers - a.followers);

  const bestNetworkByEngagement = followersByNetwork
    .filter((n) => n.avgEngagement > 0)
    .sort((a, b) => b.avgEngagement - a.avgEngagement)[0]
    ? { network: followersByNetwork.filter((n) => n.avgEngagement > 0).sort((a, b) => b.avgEngagement - a.avgEngagement)[0].network,
        engagement: followersByNetwork.filter((n) => n.avgEngagement > 0).sort((a, b) => b.avgEngagement - a.avgEngagement)[0].avgEngagement }
    : null;
  const bestNetworkByGrowth = followersByNetwork
    .filter((n) => n.avgGrowth !== 0)
    .sort((a, b) => b.avgGrowth - a.avgGrowth)[0]
    ? { network: followersByNetwork.filter((n) => n.avgGrowth !== 0).sort((a, b) => b.avgGrowth - a.avgGrowth)[0].network,
        growth: followersByNetwork.filter((n) => n.avgGrowth !== 0).sort((a, b) => b.avgGrowth - a.avgGrowth)[0].avgGrowth }
    : null;
  const riskCandidate = followersByNetwork
    .filter((n) => n.avgGrowth < 0)
    .sort((a, b) => a.avgGrowth - b.avgGrowth)[0];
  const riskNetwork = riskCandidate ? { network: riskCandidate.network, growth: riskCandidate.avgGrowth } : null;

  const validPosts = kpis
    .map((k) => Number(k.posts_per_day))
    .filter((v) => Number.isFinite(v) && v > 0);
  const avgPostsPerDay = validPosts.length ? pct(validPosts.reduce((s, v) => s + v, 0) / validPosts.length) : 0;

  // Share of voice ponderado por engagement absoluto (followers * engagement_rate)
  // así reflejamos peso real en lugar de solo sumar tasas
  const weightedContribs = profiles.map((p) => {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const eng = Number(k?.engagement_rate);
    const fol = Number(k?.followers);
    const weight = (Number.isFinite(eng) && eng > 0 ? eng : 0) * (Number.isFinite(fol) && fol > 0 ? fol : 0);
    return { p, k, weight, eng: Number.isFinite(eng) && eng > 0 ? eng : 0, fol: Number.isFinite(fol) && fol > 0 ? fol : 0 };
  });
  const totalWeight = weightedContribs.reduce((s, w) => s + w.weight, 0) || 1;
  const totalFollowersForShare = totalFollowers || 1;

  const shareOfVoice = weightedContribs.map(({ p, weight, fol }) => ({
    name: getFKProfileDisplayName(p),
    isOwn: !p.is_competitor,
    engagementShare: pct((weight / totalWeight) * 100),
    followersShare: pct((fol / totalFollowersForShare) * 100),
  }));

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
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      return b.engagement - a.engagement;
    });

  // Métricas competitivas (benchmark)
  const ownProfiles = rankingByEngagement.filter((r) => r.isOwn && r.hasData);
  const allWithData = rankingByEngagement.filter((r) => r.hasData);
  let ownPosition: PerformanceReportAnalytics["ownPosition"] = null;
  let gapToLeader: PerformanceReportAnalytics["gapToLeader"] = null;
  let topCompetitor: PerformanceReportAnalytics["topCompetitor"] = null;
  let ownEngagementShare = 0;

  if (ownProfiles.length > 0 && allWithData.length > 0) {
    const bestOwn = ownProfiles[0];
    const bestOwnIdx = allWithData.findIndex((r) => r.name === bestOwn.name && r.network === bestOwn.network);
    ownPosition = { rank: bestOwnIdx + 1, total: allWithData.length };
    const leader = allWithData[0];
    if (leader && !leader.isOwn) {
      gapToLeader = {
        leaderName: leader.name,
        leaderNetwork: leader.network,
        gapPercent: pct(leader.engagement - bestOwn.engagement),
      };
    }
    const competitor = allWithData.find((r) => !r.isOwn);
    if (competitor) topCompetitor = { name: competitor.name, engagement: competitor.engagement };
  }
  ownEngagementShare = pct(shareOfVoice.filter((s) => s.isOwn).reduce((s, v) => s + v.engagementShare, 0));

  return {
    networks,
    avgEngagement,
    avgGrowth,
    totalFollowers,
    avgPostsPerDay,
    followersByNetwork,
    bestNetworkByEngagement,
    bestNetworkByGrowth,
    riskNetwork,
    bestPerformer,
    fastestGrower,
    shareOfVoice,
    rankingByEngagement,
    ownPosition,
    ownEngagementShare,
    gapToLeader,
    topCompetitor,
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
