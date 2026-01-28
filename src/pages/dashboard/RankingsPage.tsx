import { useState } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useFKProfiles, useFKProfileKPIs, FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";
import { ProfileBatchForm } from "@/components/rankings/ProfileBatchForm";
import { ProfilesList } from "@/components/rankings/ProfilesList";
import { RankingTable } from "@/components/rankings/RankingTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Settings, BarChart3, TrendingUp, Users, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SortMetric = "followers" | "engagement_rate" | "follower_growth_percent" | "posts_per_day";

const SORT_OPTIONS: { value: SortMetric; label: string }[] = [
  { value: "engagement_rate", label: "Tasa de Engagement" },
  { value: "followers", label: "Seguidores" },
  { value: "follower_growth_percent", label: "Crecimiento %" },
  { value: "posts_per_day", label: "Publicaciones/día" },
];

const NETWORK_OPTIONS: { value: FKNetwork | "all"; label: string }[] = [
  { value: "all", label: "Todas las redes" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter/X" },
  { value: "threads", label: "Threads" },
];

const RankingsPage = () => {
  const { selectedProject } = useProject();
  const [activeTab, setActiveTab] = useState<"ranking" | "config">("ranking");
  const [sortBy, setSortBy] = useState<SortMetric>("engagement_rate");
  const [filterNetwork, setFilterNetwork] = useState<FKNetwork | "all">("all");

  const { data: profiles = [], isLoading: loadingProfiles } = useFKProfiles(selectedProject?.id);
  const profileIds = profiles.map((p) => p.id);
  const { data: kpis = [], isLoading: loadingKPIs } = useFKProfileKPIs(profileIds);

  // Count profiles by network
  const networkCounts = profiles.reduce((acc, p) => {
    const network = p.network as FKNetwork;
    acc[network] = (acc[network] || 0) + 1;
    return acc;
  }, {} as Record<FKNetwork, number>);

  const syncedCount = profiles.filter((p) => p.last_synced_at).length;

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Sin proyecto seleccionado</CardTitle>
            <CardDescription>
              Selecciona un proyecto para ver los rankings de Fanpage Karma
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-8 w-8 text-amber-500" />
            Rankings
          </h1>
          <p className="text-muted-foreground">
            Benchmarking competitivo con datos de Fanpage Karma
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ranking" | "config")}>
            <TabsList>
              <TabsTrigger value="ranking">
                <BarChart3 className="h-4 w-4 mr-2" />
                Ranking
              </TabsTrigger>
              <TabsTrigger value="config">
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perfiles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles.length}</div>
            <p className="text-xs text-muted-foreground">
              {syncedCount} sincronizados
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redes</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(networkCounts).length}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(networkCounts).map(([network, count]) => (
                <Badge key={network} variant="secondary" className="text-xs">
                  {getNetworkLabel(network as FKNetwork)}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KPIs</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.length}</div>
            <p className="text-xs text-muted-foreground">
              Registros de métricas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncedCount === profiles.length && profiles.length > 0 ? "✅" : "⏳"}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncedCount === profiles.length && profiles.length > 0 
                ? "Todos sincronizados" 
                : `${profiles.length - syncedCount} pendientes`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert for new users */}
      {profiles.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Comienza configurando tus perfiles</AlertTitle>
          <AlertDescription>
            Ve a la pestaña de <strong>Configuración</strong> para agregar los perfiles de Fanpage Karma 
            que quieres incluir en tu ranking. Los perfiles deben estar dados de alta en tu cuenta de FK.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {activeTab === "ranking" ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Ordenar por:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortMetric)}>
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Filtrar red:</span>
              <Select value={filterNetwork} onValueChange={(v) => setFilterNetwork(v as FKNetwork | "all")}>
                <SelectTrigger className="w-48 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {NETWORK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <RankingTable 
            profiles={profiles} 
            kpis={kpis} 
            isLoading={loadingProfiles || loadingKPIs}
            sortBy={sortBy}
            filterNetwork={filterNetwork}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <ProfileBatchForm 
            projectId={selectedProject.id} 
            onSuccess={() => {}}
          />
          <ProfilesList 
            profiles={profiles} 
            isLoading={loadingProfiles}
            projectId={selectedProject.id}
          />
        </div>
      )}
    </div>
  );
};

export default RankingsPage;
