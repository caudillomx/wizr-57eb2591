import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Users, 
  Target,
  AlertTriangle,
  Crown,
  Sparkles
} from "lucide-react";
import { FKProfile, FKProfileKPI } from "@/hooks/useFanpageKarma";

interface RankingInsightsPanelProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
}

interface InsightCard {
  title: string;
  question: string;
  answer: string;
  detail: string;
  icon: React.ReactNode;
  variant: "success" | "warning" | "info" | "danger";
  value?: string;
}

function getProfileName(profiles: FKProfile[], profileId: string): string {
  const profile = profiles.find(p => p.id === profileId);
  return profile?.display_name || profile?.profile_id || "Desconocido";
}

function generateInsights(profiles: FKProfile[], kpis: FKProfileKPI[]): InsightCard[] {
  const insights: InsightCard[] = [];
  
  if (kpis.length === 0) {
    return [];
  }

  // Get the latest KPI for each profile
  const latestKpiByProfile = new Map<string, FKProfileKPI>();
  kpis.forEach(kpi => {
    const existing = latestKpiByProfile.get(kpi.fk_profile_id);
    if (!existing || new Date(kpi.period_end) > new Date(existing.period_end)) {
      latestKpiByProfile.set(kpi.fk_profile_id, kpi);
    }
  });

  const latestKpis = Array.from(latestKpiByProfile.values());

  // 1. Best engagement rate
  const sortedByEngagement = latestKpis
    .filter(k => k.engagement_rate !== null)
    .sort((a, b) => (b.engagement_rate || 0) - (a.engagement_rate || 0));
  
  if (sortedByEngagement.length > 0) {
    const best = sortedByEngagement[0];
    insights.push({
      title: "Mejor Engagement",
      question: "¿Quién tiene el mejor engagement rate?",
      answer: getProfileName(profiles, best.fk_profile_id),
      detail: `Con ${((best.engagement_rate || 0) * 100).toFixed(2)}% de engagement rate`,
      icon: <Crown className="h-5 w-5 text-amber-500" />,
      variant: "success",
      value: `${((best.engagement_rate || 0) * 100).toFixed(2)}%`
    });
  }

  // 2. Worst engagement rate
  if (sortedByEngagement.length > 1) {
    const worst = sortedByEngagement[sortedByEngagement.length - 1];
    insights.push({
      title: "Menor Engagement",
      question: "¿Quién tiene el peor engagement rate?",
      answer: getProfileName(profiles, worst.fk_profile_id),
      detail: `Con solo ${((worst.engagement_rate || 0) * 100).toFixed(2)}% de engagement rate`,
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      variant: "danger",
      value: `${((worst.engagement_rate || 0) * 100).toFixed(2)}%`
    });
  }

  // 3. Most followers
  const sortedByFollowers = latestKpis
    .filter(k => k.followers !== null)
    .sort((a, b) => (b.followers || 0) - (a.followers || 0));
  
  if (sortedByFollowers.length > 0) {
    const best = sortedByFollowers[0];
    insights.push({
      title: "Mayor Audiencia",
      question: "¿Quién tiene más seguidores?",
      answer: getProfileName(profiles, best.fk_profile_id),
      detail: `Con ${(best.followers || 0).toLocaleString()} seguidores`,
      icon: <Users className="h-5 w-5 text-blue-500" />,
      variant: "info",
      value: formatNumber(best.followers || 0)
    });
  }

  // 4. Highest follower growth
  const sortedByGrowth = latestKpis
    .filter(k => k.follower_growth_percent !== null)
    .sort((a, b) => (b.follower_growth_percent || 0) - (a.follower_growth_percent || 0));
  
  if (sortedByGrowth.length > 0 && (sortedByGrowth[0].follower_growth_percent || 0) > 0) {
    const best = sortedByGrowth[0];
    insights.push({
      title: "Mayor Crecimiento",
      question: "¿Quién creció más en seguidores?",
      answer: getProfileName(profiles, best.fk_profile_id),
      detail: `Creció ${(best.follower_growth_percent || 0).toFixed(2)}% en el período`,
      icon: <TrendingUp className="h-5 w-5 text-emerald-500" />,
      variant: "success",
      value: `+${(best.follower_growth_percent || 0).toFixed(2)}%`
    });
  }

  // 5. Lowest/negative growth
  if (sortedByGrowth.length > 1) {
    const worst = sortedByGrowth[sortedByGrowth.length - 1];
    if ((worst.follower_growth_percent || 0) < 0) {
      insights.push({
        title: "Pérdida de Seguidores",
        question: "¿Quién perdió más seguidores?",
        answer: getProfileName(profiles, worst.fk_profile_id),
        detail: `Perdió ${Math.abs(worst.follower_growth_percent || 0).toFixed(2)}% de seguidores`,
        icon: <TrendingDown className="h-5 w-5 text-destructive" />,
        variant: "danger",
        value: `${(worst.follower_growth_percent || 0).toFixed(2)}%`
      });
    }
  }

  // 6. Most active (posts per day)
  const sortedByActivity = latestKpis
    .filter(k => k.posts_per_day !== null)
    .sort((a, b) => (b.posts_per_day || 0) - (a.posts_per_day || 0));
  
  if (sortedByActivity.length > 0) {
    const best = sortedByActivity[0];
    insights.push({
      title: "Más Activo",
      question: "¿Quién publica más?",
      answer: getProfileName(profiles, best.fk_profile_id),
      detail: `${(best.posts_per_day || 0).toFixed(1)} posts por día en promedio`,
      icon: <Flame className="h-5 w-5 text-orange-500" />,
      variant: "info",
      value: `${(best.posts_per_day || 0).toFixed(1)}/día`
    });
  }

  // 7. Best page performance index
  const sortedByPPI = latestKpis
    .filter(k => k.page_performance_index !== null)
    .sort((a, b) => (b.page_performance_index || 0) - (a.page_performance_index || 0));
  
  if (sortedByPPI.length > 0) {
    const best = sortedByPPI[0];
    insights.push({
      title: "Mejor Rendimiento",
      question: "¿Quién tiene el mejor índice de rendimiento?",
      answer: getProfileName(profiles, best.fk_profile_id),
      detail: `Page Performance Index de ${(best.page_performance_index || 0).toFixed(0)}%`,
      icon: <Target className="h-5 w-5 text-violet-500" />,
      variant: "success",
      value: `${(best.page_performance_index || 0).toFixed(0)}%`
    });
  }

  return insights;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function getVariantClasses(variant: InsightCard["variant"]): string {
  switch (variant) {
    case "success":
      return "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20";
    case "warning":
      return "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20";
    case "danger":
      return "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20";
    case "info":
    default:
      return "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20";
  }
}

export function RankingInsightsPanel({ profiles, kpis, isLoading }: RankingInsightsPanelProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }

  const insights = generateInsights(profiles, kpis);

  if (insights.length === 0) {
    return (
      <Card className="py-8">
        <CardContent className="text-center">
          <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin datos para generar insights</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sincroniza los perfiles del ranking para ver respuestas automáticas a preguntas clave.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Insights del Ranking</h3>
        <Badge variant="secondary" className="ml-2">
          {insights.length} respuestas
        </Badge>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {insights.map((insight, index) => (
          <Card key={index} className={`${getVariantClasses(insight.variant)} transition-all hover:shadow-md`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {insight.icon}
                  {insight.title}
                </CardTitle>
                {insight.value && (
                  <Badge variant="outline" className="text-xs font-bold">
                    {insight.value}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-1">{insight.question}</p>
              <p className="font-semibold text-lg">{insight.answer}</p>
              <p className="text-xs text-muted-foreground mt-1">{insight.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
