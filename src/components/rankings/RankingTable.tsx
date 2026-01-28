import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Trophy, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { FKProfile, FKProfileKPI, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";

type SortMetric = "followers" | "engagement_rate" | "follower_growth_percent" | "posts_per_day";

interface RankingTableProps {
  profiles: FKProfile[];
  kpis: FKProfileKPI[];
  isLoading: boolean;
  sortBy?: SortMetric;
  filterNetwork?: FKNetwork | "all";
}

const MEDAL_COLORS = ["🥇", "🥈", "🥉"];

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatPercent = (num: number | null | undefined): string => {
  if (num === null || num === undefined) return "-";
  return `${num.toFixed(2)}%`;
};

const GrowthIndicator = ({ value }: { value: number | null | undefined }) => {
  if (value === null || value === undefined) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export function RankingTable({ 
  profiles, 
  kpis, 
  isLoading, 
  sortBy = "engagement_rate",
  filterNetwork = "all"
}: RankingTableProps) {
  const rankedData = useMemo(() => {
    // Create a map of profile ID to latest KPIs
    const kpiMap = new Map<string, FKProfileKPI>();
    kpis.forEach((kpi) => {
      const existing = kpiMap.get(kpi.fk_profile_id);
      if (!existing || new Date(kpi.fetched_at) > new Date(existing.fetched_at)) {
        kpiMap.set(kpi.fk_profile_id, kpi);
      }
    });

    // Filter and combine profiles with KPIs
    let data = profiles
      .filter((p) => filterNetwork === "all" || p.network === filterNetwork)
      .map((profile) => ({
        profile,
        kpi: kpiMap.get(profile.id) || null,
      }));

    // Sort by the selected metric
    data.sort((a, b) => {
      const aVal = a.kpi?.[sortBy] ?? -Infinity;
      const bVal = b.kpi?.[sortBy] ?? -Infinity;
      return (bVal as number) - (aVal as number);
    });

    return data;
  }, [profiles, kpis, sortBy, filterNetwork]);

  // Calculate max values for relative bars
  const maxEngagement = useMemo(() => {
    const values = rankedData.map((d) => d.kpi?.engagement_rate ?? 0);
    return Math.max(...values, 0.01);
  }, [rankedData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rankedData.length === 0) {
    return (
      <Card className="py-12">
        <CardContent className="text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sin datos de ranking</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sincroniza los perfiles para obtener sus métricas y generar el ranking.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Ranking de Perfiles
        </CardTitle>
        <CardDescription>
          Ordenado por {sortBy === "engagement_rate" ? "Tasa de Engagement" : 
            sortBy === "followers" ? "Seguidores" :
            sortBy === "follower_growth_percent" ? "Crecimiento" : "Publicaciones/día"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Red</TableHead>
              <TableHead className="text-right">Seguidores</TableHead>
              <TableHead className="text-right">Crecimiento</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
              <TableHead className="w-32">Relativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rankedData.map((item, index) => {
              const { profile, kpi } = item;
              const network = profile.network as FKNetwork;
              const engagementPercent = kpi?.engagement_rate 
                ? (kpi.engagement_rate / maxEngagement) * 100 
                : 0;

              return (
                <TableRow key={profile.id}>
                  <TableCell className="font-bold text-lg">
                    {index < 3 ? MEDAL_COLORS[index] : index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">@{profile.profile_id}</div>
                    {profile.display_name && profile.display_name !== profile.profile_id && (
                      <div className="text-sm text-muted-foreground">{profile.display_name}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {getNetworkLabel(network)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatNumber(kpi?.followers)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <GrowthIndicator value={kpi?.follower_growth_percent} />
                      <span className={kpi?.follower_growth_percent && kpi.follower_growth_percent > 0 ? "text-green-600" : kpi?.follower_growth_percent && kpi.follower_growth_percent < 0 ? "text-red-600" : ""}>
                        {formatPercent(kpi?.follower_growth_percent)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPercent(kpi?.engagement_rate)}
                  </TableCell>
                  <TableCell>
                    <Progress value={engagementPercent} className="h-2" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
