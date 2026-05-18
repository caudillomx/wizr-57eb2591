import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from "recharts";
import { MousePointer2, Info } from "lucide-react";

function dateKeyToLocalDate(dateKey: string): Date {
  // IMPORTANT: A "YYYY-MM-DD" string is parsed as UTC by Date(), which shifts the day
  // for many timezones. Build a local Date instead.
  const [y, m, d] = dateKey.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

interface ActivityChartProps {
  data: { date: string; count: number; lowConfidence?: boolean }[];
  onDateClick?: (date: string, label: string) => void;
}

export function ActivityChart({ data, onDateClick }: ActivityChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actividad Diaria</CardTitle>
          <CardDescription>Volumen de menciones por día</CardDescription>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <p className="text-muted-foreground">Sin datos de actividad</p>
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    label: dateKeyToLocalDate(d.date).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
  }));

  const handleClick = (data: any) => {
    if (data?.activePayload?.[0]?.payload && onDateClick) {
      const payload = data.activePayload[0].payload;
      onDateClick(payload.date, payload.label);
    }
  };

  const hasLowConfidence = formattedData.some((d) => d.lowConfidence);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Actividad Diaria</CardTitle>
            <CardDescription>Volumen de menciones por día</CardDescription>
          </div>
          {onDateClick && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MousePointer2 className="h-3 w-3" />
              Clic para ver detalle
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={formattedData}
            onClick={handleClick}
            style={{ cursor: onDateClick ? "pointer" : "default" }}
          >
            <defs>
              <pattern
                id="lowConfidencePattern"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" strokeOpacity="0.35" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelFormatter={(_, payload) => {
                if (payload && payload[0]) {
                  const date = dateKeyToLocalDate(payload[0].payload.date);
                  const base = date.toLocaleDateString("es-MX", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  });
                  return payload[0].payload.lowConfidence ? `${base} · fecha estimada` : base;
                }
                return "";
              }}
              formatter={(value: number) => [value, "Menciones"]}
            />
            {formattedData.map((d, i) =>
              d.lowConfidence ? (
                <ReferenceArea
                  key={`lc-${d.date}`}
                  x1={d.label}
                  x2={d.label}
                  fill="url(#lowConfidencePattern)"
                  fillOpacity={1}
                  ifOverflow="visible"
                />
              ) : null
            )}
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.2)"
              strokeWidth={2}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: "hsl(var(--primary))",
                fill: "hsl(var(--background))",
                cursor: onDateClick ? "pointer" : "default",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {hasLowConfidence && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              Las zonas rayadas corresponden a días con fechas estimadas (sin fecha de publicación verificada).
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}