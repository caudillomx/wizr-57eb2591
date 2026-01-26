import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Plus, TrendingUp, TrendingDown, Minus, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// Mock data for demonstration
const generateMockData = (days: number) => {
  const data = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const baseVolume = 150 + Math.floor(Math.random() * 100);
    const variation = Math.sin(i / 3) * 30;
    
    data.push({
      date: date.toLocaleDateString("es-MX", { month: "short", day: "numeric" }),
      fullDate: date.toISOString(),
      menciones: Math.floor(baseVolume + variation + Math.random() * 40),
      positivo: Math.floor(40 + Math.random() * 20 + Math.sin(i / 4) * 10),
      neutral: Math.floor(35 + Math.random() * 15),
      negativo: Math.floor(15 + Math.random() * 15 - Math.sin(i / 4) * 5),
      alcance: Math.floor((baseVolume + variation) * 150 + Math.random() * 5000),
      engagement: Math.floor(Math.random() * 500 + 200 + Math.sin(i / 2) * 100),
    });
  }
  
  return data;
};

const MOCK_DATA_7D = generateMockData(7);
const MOCK_DATA_30D = generateMockData(30);
const MOCK_DATA_90D = generateMockData(90);

const TendenciasPage = () => {
  const { selectedProject, loading } = useProject();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  const data = timeRange === "7d" ? MOCK_DATA_7D : timeRange === "30d" ? MOCK_DATA_30D : MOCK_DATA_90D;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Sin proyecto seleccionado</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Crea o selecciona un proyecto para ver las tendencias
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  // Calculate summary metrics
  const totalMentions = data.reduce((sum, d) => sum + d.menciones, 0);
  const avgMentions = Math.floor(totalMentions / data.length);
  const lastDayMentions = data[data.length - 1]?.menciones || 0;
  const prevDayMentions = data[data.length - 2]?.menciones || 0;
  const mentionChange = prevDayMentions > 0 
    ? ((lastDayMentions - prevDayMentions) / prevDayMentions * 100).toFixed(1) 
    : "0";

  const avgPositive = Math.floor(data.reduce((sum, d) => sum + d.positivo, 0) / data.length);
  const avgNegative = Math.floor(data.reduce((sum, d) => sum + d.negativo, 0) / data.length);
  const sentimentScore = avgPositive - avgNegative;

  const totalReach = data.reduce((sum, d) => sum + d.alcance, 0);
  const totalEngagement = data.reduce((sum, d) => sum + d.engagement, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tendencias</h1>
          <p className="text-muted-foreground">
            Evolución temporal y patrones — <span className="font-medium">{selectedProject.nombre}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="w-36 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="90d">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Menciones Totales"
          value={totalMentions.toLocaleString()}
          change={Number(mentionChange)}
          subtitle={`Promedio: ${avgMentions}/día`}
        />
        <MetricCard
          title="Sentimiento Neto"
          value={sentimentScore > 0 ? `+${sentimentScore}` : String(sentimentScore)}
          change={sentimentScore}
          subtitle={`${avgPositive}% positivo, ${avgNegative}% negativo`}
          isScore
        />
        <MetricCard
          title="Alcance Total"
          value={formatNumber(totalReach)}
          change={8.3}
          subtitle="Impresiones estimadas"
        />
        <MetricCard
          title="Engagement"
          value={formatNumber(totalEngagement)}
          change={-2.1}
          subtitle="Interacciones totales"
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="volume" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volume">Volumen</TabsTrigger>
          <TabsTrigger value="sentiment">Sentimiento</TabsTrigger>
          <TabsTrigger value="reach">Alcance</TabsTrigger>
        </TabsList>

        <TabsContent value="volume">
          <Card>
            <CardHeader>
              <CardTitle>Volumen de Menciones</CardTitle>
              <CardDescription>
                Evolución del número de menciones a lo largo del tiempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMenciones" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="menciones"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorMenciones)"
                      name="Menciones"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Sentimiento</CardTitle>
              <CardDescription>
                Evolución del sentimiento positivo, neutral y negativo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [`${value}%`, '']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="positivo"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      name="Positivo"
                    />
                    <Line
                      type="monotone"
                      dataKey="neutral"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      dot={false}
                      name="Neutral"
                    />
                    <Line
                      type="monotone"
                      dataKey="negativo"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Negativo"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reach">
          <Card>
            <CardHeader>
              <CardTitle>Alcance y Engagement</CardTitle>
              <CardDescription>
                Impresiones estimadas e interacciones a lo largo del tiempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      yAxisId="left"
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => formatNumber(value)}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string) => [
                        name === 'Alcance' ? formatNumber(value) : value.toLocaleString(),
                        name
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="alcance"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      yAxisId="left"
                      name="Alcance"
                    />
                    <Line
                      type="monotone"
                      dataKey="engagement"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={false}
                      yAxisId="right"
                      name="Engagement"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Banner */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="rounded-full bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Datos de demostración</p>
            <p className="text-sm text-muted-foreground">
              Los gráficos muestran datos simulados. Conecta fuentes de datos para ver información real.
            </p>
          </div>
          <Badge variant="outline">Demo</Badge>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper Components
interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  subtitle: string;
  isScore?: boolean;
}

const MetricCard = ({ title, value, change, subtitle, isScore }: MetricCardProps) => {
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {!isScore && (
            <span
              className={`flex items-center text-xs font-medium ${
                isNeutral
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-green-600"
                    : "text-red-600"
              }`}
            >
              {isNeutral ? (
                <Minus className="mr-0.5 h-3 w-3" />
              ) : isPositive ? (
                <ArrowUpRight className="mr-0.5 h-3 w-3" />
              ) : (
                <ArrowDownRight className="mr-0.5 h-3 w-3" />
              )}
              {Math.abs(change)}%
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
};

// Helper function
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default TendenciasPage;
