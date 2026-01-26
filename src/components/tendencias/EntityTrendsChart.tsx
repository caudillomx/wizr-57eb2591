import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EntityTrendData } from "@/hooks/useTrendsData";
import { User, Building2, Briefcase } from "lucide-react";

interface EntityTrendsChartProps {
  entities: EntityTrendData[];
  maxEntities?: number;
}

const COLORS = [
  "hsl(221, 83%, 53%)",  // blue
  "hsl(142, 76%, 36%)",  // green
  "hsl(38, 92%, 50%)",   // amber
  "hsl(280, 67%, 54%)",  // purple
  "hsl(0, 84%, 60%)",    // red
  "hsl(180, 70%, 45%)",  // cyan
];

const entityTypeIcons = {
  persona: User,
  marca: Briefcase,
  institucion: Building2,
};

export function EntityTrendsChart({ entities, maxEntities = 5 }: EntityTrendsChartProps) {
  const displayEntities = entities.slice(0, maxEntities);

  if (displayEntities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tendencias por Entidad</CardTitle>
          <CardDescription>
            No hay entidades con menciones para mostrar
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          Sin datos de entidades
        </CardContent>
      </Card>
    );
  }

  // Merge all entity data into a single dataset for the chart
  const mergedData = displayEntities[0].data.map((point, idx) => {
    const merged: Record<string, string | number | Date> = {
      date: point.date,
      fullDate: point.fullDate,
    };
    
    displayEntities.forEach((entity, entityIdx) => {
      merged[entity.entityId] = entity.data[idx]?.menciones || 0;
    });
    
    return merged;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencias por Entidad</CardTitle>
        <CardDescription>
          Evolución de menciones por entidad monitoreada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend />
              {displayEntities.map((entity, idx) => (
                <Line
                  key={entity.entityId}
                  type="monotone"
                  dataKey={entity.entityId}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={entity.entityName}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Entity Legend with stats */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {displayEntities.map((entity, idx) => {
            const Icon = entityTypeIcons[entity.entityType as keyof typeof entityTypeIcons] || User;
            return (
              <div
                key={entity.entityId}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate flex-1">
                  {entity.entityName}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {entity.totals.menciones}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
