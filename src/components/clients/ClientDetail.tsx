import { useState, useMemo } from "react";
import { format as formatDate } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ArrowLeft, BarChart3, Settings, Building2, TrendingUp, FileText,
  Sparkles, MessageCircle, BookOpen, FileBarChart, Users2, Target, History,
} from "lucide-react";
import { Client } from "@/hooks/useClients";
import { useFKProfilesByClient } from "@/hooks/useClients";
import { useFKProfileKPIs, useFKAllKPIs, useFKTopPosts, FKNetwork, FKProfile } from "@/hooks/useFanpageKarma";
import { FKExcelImporter } from "./FKExcelImporter";
import { ProfilesList } from "@/components/rankings/ProfilesList";
import { RankingTable } from "@/components/rankings/RankingTable";
import { RankingChart } from "@/components/rankings/RankingChart";
import { TrendsTab } from "@/components/rankings/TrendsTab";
import { TopContentTab } from "@/components/rankings/TopContentTab";
import { RankingInsightsPanel } from "@/components/rankings/RankingInsightsPanel";
import { RankingQuestionsPanel } from "@/components/rankings/RankingQuestionsPanel";
import { RankingAIChat } from "@/components/rankings/RankingAIChat";
import { NarrativesAnalysisPanel } from "@/components/rankings/NarrativesAnalysisPanel";
import { RankingDateFilter, DateRangePreset, getDateRangeFromPreset } from "@/components/rankings/RankingDateFilter";
import { DailyTopPostsPanel } from "@/components/rankings/DailyTopPostsPanel";
import { DateRange } from "react-day-picker";
import { ClientEvolutionTab } from "./ClientEvolutionTab";
import { PerformanceReportGenerator } from "./PerformanceReportGenerator";
import { SharedReportsList } from "@/components/reports/SharedReportsList";

interface Props {
  client: Client;
  onBack: () => void;
}

type ViewMode = "brand" | "benchmark";

export function ClientDetail({ client, onBack }: Props) {
  const qc = useQueryClient();
  const isBenchmarkOnly = client.client_type === "benchmark";
  const [view, setView] = useState<ViewMode>(isBenchmarkOnly ? "benchmark" : "brand");
  const [activeTab, setActiveTab] = useState<
    "ranking" | "insights" | "evolution" | "narratives" | "trends" | "content" | "reports" | "ai" | "config"
  >("ranking");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("7d");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [appliedPreset, setAppliedPreset] = useState<DateRangePreset>("7d");
  const [appliedCustomRange, setAppliedCustomRange] = useState<DateRange | undefined>();
  const [aiInitialQuestion, setAiInitialQuestion] = useState("");
  const [filterNet, setFilterNet] = useState<FKNetwork | "all">("all");

  const dateRange = getDateRangeFromPreset(appliedPreset, appliedCustomRange);
  const periodStart = formatDate(dateRange.from, "yyyy-MM-dd");
  const periodEnd = formatDate(dateRange.to, "yyyy-MM-dd");

  const periodStartTop = formatDate(dateRange.from, "yyyy-MM-dd");
  const periodEndTop = formatDate(dateRange.to, "yyyy-MM-dd");

  const { data: rawProfiles = [], isLoading: loadingProfiles } = useFKProfilesByClient(client.id, "all");

  const profiles = useMemo<FKProfile[]>(() => {
    return rawProfiles
      .filter((p) => (isBenchmarkOnly ? true : view === "brand" ? !p.is_competitor : true))
      .map((p) => ({
        ...p,
        project_id: null,
        ranking_id: null,
        is_own_profile: isBenchmarkOnly ? false : !p.is_competitor,
        network: p.network as FKNetwork,
      })) as unknown as FKProfile[];
  }, [rawProfiles, view, isBenchmarkOnly]);

  const profileIds = profiles.map((p) => p.id);
  const { data: kpis = [], isLoading: loadingKpis } = useFKProfileKPIs(profileIds, periodStart, periodEnd);
  const { data: allKpis = [], isLoading: loadingAllKpis } = useFKAllKPIs(profileIds);
  const { data: dailyTopPosts = [], isLoading: loadingTop } = useFKTopPosts(profileIds, periodStartTop, periodEndTop);

  const brandCount = rawProfiles.filter((p) => !p.is_competitor).length;
  const compCount = rawProfiles.filter((p) => p.is_competitor).length;

  const handleApplyDateRange = (preset?: DateRangePreset, custom?: DateRange) => {
    setAppliedPreset(preset ?? datePreset);
    setAppliedCustomRange(custom ?? customDateRange);
  };
  const handleAskAI = (q: string) => { setAiInitialQuestion(q); setActiveTab("ai"); };
  const handleRefreshTopPosts = () => {
    qc.invalidateQueries({ queryKey: ["fk-daily-top-posts"] });
    qc.invalidateQueries({ queryKey: ["fk-kpis"] });
    qc.invalidateQueries({ queryKey: ["fk-profiles-client"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            {client.description && (
              <p className="text-muted-foreground text-sm">{client.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isBenchmarkOnly ? (
            <Badge variant="secondary" className="gap-1">
              <Users2 className="h-3 w-3" /> {rawProfiles.length} perfiles
            </Badge>
          ) : (
            <>
              <Badge variant="secondary">{brandCount} marca</Badge>
              <Badge variant="outline">{compCount} competencia</Badge>
            </>
          )}
        </div>
      </div>

      {!isBenchmarkOnly && (
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            Vista actual
          </div>
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
            <ToggleGroupItem value="brand" className="gap-2">
              <Building2 className="h-4 w-4" /> Marca ({brandCount})
            </ToggleGroupItem>
            <ToggleGroupItem value="benchmark" className="gap-2">
              <Users2 className="h-4 w-4" /> Benchmark ({brandCount + compCount})
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {activeTab !== "config" && activeTab !== "evolution" && profiles.length > 0 && (
        <RankingDateFilter
          preset={datePreset}
          customRange={customDateRange}
          onPresetChange={setDatePreset}
          onCustomRangeChange={setCustomDateRange}
          onApply={handleApplyDateRange}
        />
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="ranking"><BarChart3 className="h-4 w-4 mr-2" />Ranking</TabsTrigger>
          <TabsTrigger value="insights" disabled={profiles.length === 0}><Sparkles className="h-4 w-4 mr-2" />Insights</TabsTrigger>
          <TabsTrigger value="evolution" disabled={profiles.length === 0}><History className="h-4 w-4 mr-2" />Evolución</TabsTrigger>
          <TabsTrigger value="trends" disabled={profiles.length === 0}><TrendingUp className="h-4 w-4 mr-2" />Tendencias</TabsTrigger>
          <TabsTrigger value="content" disabled={profiles.length === 0}><FileText className="h-4 w-4 mr-2" />Contenido</TabsTrigger>
          <TabsTrigger value="narratives" disabled={profiles.length === 0}><BookOpen className="h-4 w-4 mr-2" />Narrativas</TabsTrigger>
          <TabsTrigger value="reports" disabled={profiles.length === 0}><FileBarChart className="h-4 w-4 mr-2" />Reportes</TabsTrigger>
          <TabsTrigger value="ai" disabled={profiles.length === 0}><MessageCircle className="h-4 w-4 mr-2" />IA</TabsTrigger>
          <TabsTrigger value="config"><Settings className="h-4 w-4 mr-2" />Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-6">
          {profiles.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {isBenchmarkOnly
                  ? "Aún no hay perfiles cargados"
                  : view === "brand" ? "Aún no hay perfiles de marca" : "Aún no hay perfiles cargados"}
              </h3>
              <p className="text-muted-foreground mb-4">
                Ve a Configuración para importar Excel de KPIs y Posts.
              </p>
              <Button onClick={() => setActiveTab("config")}>
                <Settings className="h-4 w-4 mr-2" />Ir a Configuración
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <RankingInsightsPanel profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} />
              <RankingTable
                profiles={profiles}
                kpis={kpis}
                isLoading={loadingProfiles || loadingKpis}
                sortBy="engagement_rate"
                filterNetwork={filterNet}
                onNetworkChange={setFilterNet}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <RankingChart profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} filterNetwork={filterNet} metric="engagement_rate" />
                <RankingChart profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} filterNetwork={filterNet} metric="followers" />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <div className="space-y-6">
            <DailyTopPostsPanel profiles={profiles} topPosts={dailyTopPosts} isLoading={loadingProfiles || loadingTop} onRefresh={handleRefreshTopPosts} />
            <div className="grid gap-6 lg:grid-cols-2">
              <RankingQuestionsPanel profiles={profiles} kpis={kpis} isLoading={loadingProfiles || loadingKpis} onAskAI={handleAskAI} />
              <RankingAIChat profiles={profiles} kpis={kpis} rankingName={`${client.name}${isBenchmarkOnly ? " (Comparativo)" : ` (${view === "brand" ? "Marca" : "Benchmark"})`}`} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evolution" className="mt-6">
          <ClientEvolutionTab
            profiles={profiles}
            allKpis={allKpis}
            isLoading={loadingProfiles || loadingAllKpis}
            brandCount={brandCount}
            compCount={compCount}
          />
        </TabsContent>

        <TabsContent value="trends" className="mt-6">
          <TrendsTab profiles={profiles} kpis={allKpis} isLoading={loadingProfiles || loadingAllKpis} />
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <TopContentTab profiles={profiles} isLoading={loadingProfiles} dateRange={dateRange} analysisContext={isBenchmarkOnly ? "benchmark" : view} brandName={isBenchmarkOnly ? undefined : client.name} />
        </TabsContent>

        <TabsContent value="narratives" className="mt-6">
          <NarrativesAnalysisPanel profiles={profiles} isLoading={loadingProfiles} dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <div className="space-y-6">
            <PerformanceReportGenerator
              reportMode={isBenchmarkOnly ? "comparative" : view}
              clientId={client.id}
              clientName={client.name}
              brandName={isBenchmarkOnly ? undefined : client.name}
              profiles={profiles}
              kpis={kpis}
              topPosts={dailyTopPosts}
              dateRange={dateRange}
            />
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Reportes publicados</h3>
              <SharedReportsList clientId={client.id} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <div className="max-w-2xl mx-auto">
            <RankingAIChat
              profiles={profiles}
              kpis={kpis}
              rankingName={`${client.name}${isBenchmarkOnly ? " (Comparativo)" : ` (${view === "brand" ? "Marca" : "Benchmark"})`}`}
              initialQuestion={aiInitialQuestion}
            />
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <div className="space-y-6">
            <FKExcelImporter clientId={client.id} />
            <ProfilesList
              profiles={rawProfiles as unknown as FKProfile[]}
              isLoading={loadingProfiles}
              rankingId={client.id}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
