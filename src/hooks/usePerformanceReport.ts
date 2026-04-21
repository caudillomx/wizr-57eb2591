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

export interface PerformanceReportAnalytics {
  networks: string[];
  avgEngagement: number;
  avgGrowth: number;
  totalFollowers: number;
  bestPerformer: { name: string; network: string; engagement: number } | null;
  fastestGrower: { name: string; network: string; growth: number } | null;
  shareOfVoice: Array<{ name: string; isOwn: boolean; engagementShare: number; followersShare: number }>;
  rankingByEngagement: Array<{ name: string; network: string; engagement: number; isOwn: boolean; hasData: boolean }>;
  /** Engagement promedio + interacciones absolutas agregadas por marca (todas sus redes) */
  brandEngagement: Array<{ brand: string; isOwn: boolean; avgEngagement: number; totalInteractions: number; profiles: number; followers: number }>;
  /** Crecimiento promedio agregado por red social */
  networkGrowth: Array<{ network: string; avgGrowth: number; profiles: number }>;
  /** Engagement promedio agregado por red social */
  networkEngagement: Array<{ network: string; avgEngagement: number; profiles: number }>;
  /** Interacciones absolutas (likes+comments+shares de top posts) sumadas por red social */
  networkInteractions: Array<{ network: string; totalInteractions: number; profiles: number }>;
  /** Followers ordenados por perfil (top N) */
  followersByProfile: Array<{ name: string; network: string; followers: number; isOwn: boolean }>;
  /** Brecha vs líder para la marca propia (en engagement) */
  ownBrandGap: { ownAvg: number; leaderName: string; leaderAvg: number; multiple: number } | null;
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
  /** Lectura contextual debajo del ranking de engagement */
  rankingInsight?: string;
  /** Lectura contextual debajo del share of voice */
  sovInsight?: string;
  /** Lectura contextual debajo de la tabla de perfiles */
  profilesInsight?: string;
  conclusion: string;
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
  topPosts: FKDailyTopPost[] = [],
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
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      return b.engagement - a.engagement;
    });

  // ── Brand-level aggregation (sum profiles by brand) ──
  // engsAbs = suma de interacciones absolutas (likes+comments+shares) de los top posts del período
  // Esto evita el problema de "tasas en %" donde marcas grandes con %s pequeños desaparecen.
  const brandMap = new Map<string, { isOwn: boolean; engs: number[]; engsAbs: number; followers: number; profiles: number }>();
  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const brand = getFKProfileDisplayName(p);
    const eng = Number(k?.engagement_rate);
    const fol = Number(k?.followers);
    if (!brandMap.has(brand)) {
      brandMap.set(brand, { isOwn: !p.is_competitor, engs: [], engsAbs: 0, followers: 0, profiles: 0 });
    }
    const slot = brandMap.get(brand)!;
    slot.profiles += 1;
    if (Number.isFinite(eng) && eng > 0) slot.engs.push(eng);
    if (Number.isFinite(fol) && fol > 0) slot.followers += fol;
  }
  // Sumar engagement absoluto de top posts por marca (vía profile.id → display_name)
  for (const tp of topPosts) {
    const profile = profiles.find((pr) => pr.id === tp.fk_profile_id);
    if (!profile) continue;
    const brand = getFKProfileDisplayName(profile);
    const slot = brandMap.get(brand);
    if (!slot) continue;
    const eng = Number(tp.engagement);
    if (Number.isFinite(eng) && eng > 0) slot.engsAbs += eng;
  }
  const brandEngagement = Array.from(brandMap.entries())
    .map(([brand, v]) => ({
      brand,
      isOwn: v.isOwn,
      avgEngagement: v.engs.length ? pct(v.engs.reduce((s, e) => s + e, 0) / v.engs.length) : 0,
      totalInteractions: Math.round(v.engsAbs),
      profiles: v.profiles,
      followers: v.followers,
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions || b.avgEngagement - a.avgEngagement);

  // ── Network-level growth + engagement aggregation ──
  const netGrowthMap = new Map<string, number[]>();
  const netEngMap = new Map<string, number[]>();
  for (const p of profiles) {
    const k = kpis.find((kp) => kp.fk_profile_id === p.id);
    const gr = Number(k?.follower_growth_percent);
    const eng = Number(k?.engagement_rate);
    if (Number.isFinite(gr)) {
      if (!netGrowthMap.has(p.network)) netGrowthMap.set(p.network, []);
      netGrowthMap.get(p.network)!.push(gr);
    }
    if (Number.isFinite(eng) && eng > 0) {
      if (!netEngMap.has(p.network)) netEngMap.set(p.network, []);
      netEngMap.get(p.network)!.push(eng);
    }
  }
  const networkGrowth = Array.from(netGrowthMap.entries())
    .map(([network, arr]) => ({
      network,
      avgGrowth: pct(arr.reduce((s, v) => s + v, 0) / arr.length),
      profiles: arr.length,
    }))
    .sort((a, b) => b.avgGrowth - a.avgGrowth);
  const networkEngagement = Array.from(netEngMap.entries())
    .map(([network, arr]) => ({
      network,
      avgEngagement: pct(arr.reduce((s, v) => s + v, 0) / arr.length),
      profiles: arr.length,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  // ── Interacciones absolutas por red social (suma desde top posts) ──
  const netInterMap = new Map<string, { total: number; profiles: Set<string> }>();
  for (const tp of topPosts) {
    const eng = Number(tp.engagement);
    if (!Number.isFinite(eng) || eng <= 0) continue;
    const net = tp.network;
    if (!netInterMap.has(net)) netInterMap.set(net, { total: 0, profiles: new Set() });
    const slot = netInterMap.get(net)!;
    slot.total += eng;
    slot.profiles.add(tp.fk_profile_id);
  }
  const networkInteractions = Array.from(netInterMap.entries())
    .map(([network, v]) => ({
      network,
      totalInteractions: Math.round(v.total),
      profiles: v.profiles.size,
    }))
    .sort((a, b) => b.totalInteractions - a.totalInteractions);

  // ── Followers por perfil (top followers) ──
  const followersByProfile = profiles
    .map((p) => {
      const k = kpis.find((kp) => kp.fk_profile_id === p.id);
      const fol = Number(k?.followers);
      return {
        name: getFKProfileDisplayName(p),
        network: p.network,
        followers: Number.isFinite(fol) && fol > 0 ? fol : 0,
        isOwn: !p.is_competitor,
      };
    })
    .filter((x) => x.followers > 0)
    .sort((a, b) => b.followers - a.followers);

  // ── Own brand gap vs leader ──
  let ownBrandGap: PerformanceReportAnalytics["ownBrandGap"] = null;
  const own = brandEngagement.find((b) => b.isOwn && b.avgEngagement > 0);
  const leader = brandEngagement.find((b) => !b.isOwn && b.avgEngagement > 0);
  if (own && leader) {
    ownBrandGap = {
      ownAvg: own.avgEngagement,
      leaderName: leader.brand,
      leaderAvg: leader.avgEngagement,
      multiple: own.avgEngagement > 0 ? Math.round((leader.avgEngagement / own.avgEngagement) * 10) / 10 : 0,
    };
  }

  return {
    networks,
    avgEngagement,
    avgGrowth,
    totalFollowers,
    bestPerformer,
    fastestGrower,
    shareOfVoice,
    rankingByEngagement,
    brandEngagement,
    networkGrowth,
    networkEngagement,
    networkInteractions,
    followersByProfile,
    ownBrandGap,
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

  const waitForJob = async (jobId: string): Promise<Partial<PerformanceReportContent>> => {
    const maxAttempts = 90;
    const intervalMs = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const { data: statusData, error: statusError } = await supabase.functions.invoke(
        "generate-performance-report-async",
        {
          body: { action: "status", jobId },
        },
      );

      if (statusError) throw statusError;
      if (statusData?.error) throw new Error(statusData.error);
      if (statusData?.status === "failed") {
        throw new Error(statusData.error || "Error al generar reporte");
      }
      if (statusData?.status === "completed" && statusData.result) {
        return statusData.result as Partial<PerformanceReportContent>;
      }
    }

    throw new Error("La generación del reporte tardó demasiado. Intenta de nuevo.");
  };

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
      const analytics = computeAnalytics(profiles, kpis, topPosts);
      const snapshots = buildSnapshots(profiles, kpis, topPosts);

      const payload = {
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
      };

      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-performance-report-async",
        {
          body: {
            action: "create",
            payload,
          },
        },
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const reportData = data?.jobId
        ? await waitForJob(data.jobId as string)
        : (data as Partial<PerformanceReportContent>);

      const enriched: PerformanceReportContent = {
        title: reportData.title || `Reporte de Performance — ${config.clientName}`,
        summary: reportData.summary || "",
        highlights: reportData.highlights || [],
        keyFindings: reportData.keyFindings || [],
        recommendations: reportData.recommendations || [],
        topContentInsight: reportData.topContentInsight || "",
        competitiveInsight: reportData.competitiveInsight || "",
        rankingInsight: reportData.rankingInsight || "",
        sovInsight: reportData.sovInsight || "",
        profilesInsight: reportData.profilesInsight || "",
        conclusion: reportData.conclusion || "",
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
