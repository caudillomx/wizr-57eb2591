import { useState, useEffect, useCallback, useMemo } from "react";
import { useProject } from "@/contexts/ProjectContext";
import { useEntities } from "@/hooks/useEntities";
import { useMentions, useMentionStats } from "@/hooks/useMentions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { EntityForm } from "@/components/entities/EntityForm";
import { SocialMediaSearch } from "@/components/fuentes/SocialMediaSearch";
import { SocialHistoryTab } from "@/components/fuentes/SocialHistoryTab";
import { GoogleNewsSearch } from "@/components/fuentes/GoogleNewsSearch";
import { CommentsAnalysisTab } from "@/components/fuentes/CommentsAnalysisTab";
import { MentionsHubTab } from "@/components/fuentes/MentionsHubTab";
import { AutoSaveConfigPanel } from "@/components/fuentes/AutoSaveConfigPanel";
import { UnifiedSearch } from "@/components/fuentes/UnifiedSearch";
import { ScheduledSearchConfig } from "@/components/fuentes/ScheduledSearchConfig";

import {
  AlertCircle,
  Plus,
  Database,
  Search,
  Zap,
  Settings2,
  Globe,
  MessageCircle,
  Newspaper,
  Eye,
  TrendingUp,
  History,
} from "lucide-react";

type MainTab = "hub" | "buscar" | "automatizacion";
type SearchSubTab = "unified" | "social" | "news" | "comments" | "social-history";

const FuentesPage = () => {
  const { selectedProject, loading: projectLoading } = useProject();
  const { entities, isLoading: entitiesLoading, createEntity, isCreating } = useEntities(selectedProject?.id);
  const {
    mentions,
    isLoading: mentionsLoading,
    updateMention,
    deleteMention,
    analyzeUnanalyzed,
    isAnalyzing,
  } = useMentions(selectedProject?.id, { isArchived: false });
  const { data: stats } = useMentionStats(selectedProject?.id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mainTab, setMainTab] = useState<MainTab>("hub");
  const [searchSubTab, setSearchSubTab] = useState<SearchSubTab>("unified");
  const [showEntityForm, setShowEntityForm] = useState(false);

  if (projectLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16 p-6">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Sin proyecto seleccionado</h2>
        <p className="mt-2 max-w-md text-center text-muted-foreground">
          Crea o selecciona un proyecto para buscar fuentes
        </p>
        <Button className="mt-4" onClick={() => navigate("/nuevo-proyecto")}>
          <Plus className="mr-2 h-4 w-4" />
          Crear Proyecto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Captura y gestión</p>
          <h1 className="text-2xl font-bold">Fuentes</h1>
        </div>
        {stats && (
          <div className="hidden md:flex items-center gap-4 text-sm">
            <StatPill icon={<Database className="h-3.5 w-3.5" />} value={stats.total} label="total" />
            <StatPill icon={<Eye className="h-3.5 w-3.5" />} value={stats.unread} label="sin leer" accent />
            <StatPill icon={<TrendingUp className="h-3.5 w-3.5" />} value={stats.last24h} label="24h" />
          </div>
        )}
      </div>

      {/* Main 3-Tab Structure */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList className="h-11 bg-muted/50 p-1">
          <TabsTrigger value="hub" className="gap-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Database className="h-4 w-4" />
            Hub de Menciones
            {mentions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-semibold">
                {mentions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="buscar" className="gap-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Search className="h-4 w-4" />
            Buscar
          </TabsTrigger>
          <TabsTrigger value="automatizacion" className="gap-2 px-4 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Settings2 className="h-4 w-4" />
            Automatización
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Hub de Menciones ── */}
        <TabsContent value="hub" className="space-y-4 mt-4">
          <MentionsHubTab
            mentions={mentions}
            entities={entities}
            isLoading={mentionsLoading}
            onUpdateMention={updateMention}
            onDeleteMention={deleteMention}
            onAnalyzeUnanalyzed={analyzeUnanalyzed}
            isAnalyzing={isAnalyzing}
          />
        </TabsContent>

        {/* ── Tab 2: Buscar ── */}
        <TabsContent value="buscar" className="space-y-4 mt-4">
          {/* Sub-navigation for search types */}
          <div className="flex flex-wrap gap-2">
            <SubTabButton
              active={searchSubTab === "unified"}
              onClick={() => setSearchSubTab("unified")}
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Búsqueda Unificada"
              primary
            />
            <SubTabButton
              active={searchSubTab === "social"}
              onClick={() => setSearchSubTab("social")}
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label="Redes Sociales"
            />
            <SubTabButton
              active={searchSubTab === "news"}
              onClick={() => setSearchSubTab("news")}
              icon={<Globe className="h-3.5 w-3.5" />}
              label="Google News"
            />
            <SubTabButton
              active={searchSubTab === "comments"}
              onClick={() => setSearchSubTab("comments")}
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              label="Comentarios"
            />
            <SubTabButton
              active={searchSubTab === "social-history"}
              onClick={() => setSearchSubTab("social-history")}
              icon={<History className="h-3.5 w-3.5" />}
              label="Historial Social"
            />
          </div>

          {/* Sub-tab content */}
          {searchSubTab === "unified" && (
            <UnifiedSearch
              projectId={selectedProject.id}
              entities={entities}
              onSearchComplete={(total, saved) => {
                if (saved > 0) {
                  toast({
                    title: "Menciones guardadas",
                    description: `Se guardaron ${saved} nuevas menciones en tu proyecto`,
                  });
                }
              }}
            />
          )}

          {searchSubTab === "social" && (
            <SocialMediaSearch
              projectId={selectedProject.id}
              onResultsSaved={() => {
                toast({
                  title: "Menciones guardadas",
                  description: "Los resultados se agregaron al historial",
                });
              }}
            />
          )}

          {searchSubTab === "news" && (
            <GoogleNewsSearch
              projectId={selectedProject.id}
              defaultKeywords={entities.flatMap((e) => [e.nombre, ...e.palabras_clave])}
            />
          )}

          {searchSubTab === "comments" && (
            <CommentsAnalysisTab projectId={selectedProject.id} />
          )}

          {searchSubTab === "social-history" && (
            <SocialHistoryTab projectId={selectedProject.id} />
          )}
        </TabsContent>

        {/* ── Tab 3: Automatización ── */}
        <TabsContent value="automatizacion" className="space-y-6 mt-4">
          <ScheduledSearchConfig projectId={selectedProject.id} />
          <AutoSaveConfigPanel projectId={selectedProject?.id} />
        </TabsContent>
      </Tabs>

      {/* Quick Entity Form */}
      <EntityForm
        open={showEntityForm}
        onOpenChange={setShowEntityForm}
        onSubmit={(data) => {
          if (!selectedProject || !data.nombre || !data.tipo) return;
          createEntity({
            project_id: selectedProject.id,
            nombre: data.nombre,
            tipo: data.tipo,
            descripcion: data.descripcion,
            palabras_clave: data.palabras_clave,
            aliases: data.aliases,
          });
          setShowEntityForm(false);
        }}
        isLoading={isCreating}
      />
    </div>
  );
};

/* ── Sub-components ── */

function StatPill({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${accent ? "text-primary font-medium" : "text-muted-foreground"}`}>
      {icon}
      <span className="font-mono font-semibold">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  icon,
  label,
  primary,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? primary
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-foreground/10 text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default FuentesPage;
