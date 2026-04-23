import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Activity } from "lucide-react";
import { FKProfile, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { getFKProfileDisplayName, canonicalizeFKProfileIdentity } from "@/lib/fkProfileUtils";

interface PostLike {
  fk_profile_id: string;
  network: string;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

interface AvgEngagementByNetworkChartProps {
  profiles: FKProfile[];
  posts: PostLike[];
  isLoading: boolean;
}

const NETWORK_COLORS: Record<string, string> = {
  facebook: "#1877F2",
  instagram: "#E4405F",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  tiktok: "#000000",
  threads: "#444444",
  twitter: "#1DA1F2",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function AvgEngagementByNetworkChart({
  profiles,
  posts,
  isLoading,
}: AvgEngagementByNetworkChartProps) {
  const { data, networks } = useMemo(() => {
    // Group posts by profile_id
    const byProfile = new Map<string, { sum: number; count: number }>();
    posts.forEach((p) => {
      const reactions =
        (Number(p.likes) || 0) + (Number(p.comments) || 0) + (Number(p.shares) || 0);
      const existing = byProfile.get(p.fk_profile_id) ?? { sum: 0, count: 0 };
      existing.sum += reactions;
      existing.count += 1;
      byProfile.set(p.fk_profile_id, existing);
    });

    // Group profiles by brand (display_name without network suffix)
    type BrandRow = { brand: string; [network: string]: number | string };
    const brandMap = new Map<string, BrandRow>();
    const networksUsed = new Set<string>();

    profiles.forEach((profile) => {
      const brand = getFKProfileDisplayName(profile);
      const stats = byProfile.get(profile.id);
      if (!stats || stats.count === 0) return;
      const avg = stats.sum / stats.count;
      const net = profile.network as FKNetwork;
      networksUsed.add(net);

      const row = brandMap.get(brand) ?? { brand };
      row[net] = avg;
      brandMap.set(brand, row);
    });

    const rows = Array.from(brandMap.values());

    // Sort brands by max avg across networks (descending)
    rows.sort((a, b) => {
      const maxA = Math.max(
        ...Array.from(networksUsed).map((n) => Number(a[n] ?? 0))
      );
      const maxB = Math.max(
        ...Array.from(networksUsed).map((n) => Number(b[n] ?? 0))
      );
      return maxB - maxA;
    });

    return {
      data: rows.slice(0, 12),
      networks: Array.from(networksUsed),
    };
  }, [profiles, posts]);

  if (isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (data.length === 0 || networks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Promedio de reacciones por publicación
        </CardTitle>
        <CardDescription className="text-xs">
          Top {data.length} marcas · likes + comentarios + compartidos por post · agrupado por red social
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 38)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              tickFormatter={(v) => formatNumber(Number(v))}
              fontSize={11}
            />
            <YAxis
              dataKey="brand"
              type="category"
              width={120}
              fontSize={10}
              tickFormatter={(v) => {
                const s = String(v);
                return s.length > 16 ? `${s.slice(0, 16)}…` : s;
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [
                Math.round(value).toLocaleString(),
                getNetworkLabel(name as FKNetwork),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              formatter={(value: string) => getNetworkLabel(value as FKNetwork)}
            />
            {networks.map((net) => (
              <Bar
                key={net}
                dataKey={net}
                fill={NETWORK_COLORS[net] ?? "hsl(var(--primary))"}
                radius={[0, 4, 4, 0]}
                opacity={0.9}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
