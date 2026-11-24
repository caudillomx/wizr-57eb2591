import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search as SearchIcon, 
  Loader2, 
  ExternalLink, 
  RefreshCw, 
  CalendarIcon, 
  Filter, 
  Sparkles, 
  Download,
  Heart,
  MessageSquare,
  Share2,
  Eye,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Database,
  CheckCircle2,
  FolderOpen
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/contexts/ProjectContext";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  searchEngine,
  exportResultsToExcel,
  saveResultsToDb,
  type SearchResult,
  type SearchJobStatus,
} from "@/lib/services/searchEngine";

const SEARCH_CACHE_KEY = "wizr_search_state_cache";

export default function SearchPage() {
  const { selectedProject } = useProject();
  const { toast } = useToast();

  // Load cached state or default
  const cached = useMemo(() => {
    try {
      const item = sessionStorage.getItem(SEARCH_CACHE_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }, []);

  const [query, setQuery] = useState(cached?.query || "");
  const [category, setCategory] = useState(cached?.category || "social");
  
  // Date filtering state
  const [dateFilterEnabled, setDateFilterEnabled] = useState(cached?.dateFilterEnabled || false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    cached?.dateFrom ? new Date(cached.dateFrom) : subDays(new Date(), 7)
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(
    cached?.dateTo ? new Date(cached.dateTo) : new Date()
  );
  
  // Platform selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>(
    cached?.selectedPlatforms || {
      twitter: false,
      instagram: false,
      facebook: false,
      tiktok: false,
      reddit: false,
      linkedin: false,
      google_news: true,
    }
  );

  const [isSearching, setIsSearching] = useState(false);
  const [isParsingIntent, setIsParsingIntent] = useState(false);
  const [isSavingToDb, setIsSavingToDb] = useState(false);
  const [isLoadingDbMentions, setIsLoadingDbMentions] = useState(false);
  const [isDbSynced, setIsDbSynced] = useState(false);
  const [results, setResults] = useState<SearchResult[]>(cached?.results || []);
  const [jobStatuses, setJobStatuses] = useState<Record<string, { status: string; progress?: number; error?: string }>>({});
  const [activeResultTab, setActiveResultTab] = useState<string>("all");
  
  // Sorting & Pagination state
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "engagement">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      searchEngine.cancelActivePolls();
    };
  }, []);

  // Hydrate from DB on mount if results are empty and project is selected
  useEffect(() => {
    if (results.length === 0 && selectedProject?.id) {
      loadDbMentions();
    }
  }, [selectedProject?.id]);

  const loadDbMentions = async () => {
    if (!selectedProject?.id) return;
    setIsLoadingDbMentions(true);
    try {
      const { data, error } = await supabase
        .from("mentions")
        .select("*")
        .eq("project_id", selectedProject.id)
        .order("published_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: SearchResult[] = data.map((m: any) => {
          const meta = (m.raw_metadata as any) || {};
          return {
            id: m.id,
            platform: m.source_domain || "web",
            title: m.title || "",
            description: m.description || "",
            url: m.url,
            publishedAt: m.published_at || m.created_at,
            author: meta.author || {},
            metrics: meta.metrics || { likes: 0, comments: 0, shares: 0, views: 0 }
          };
        });
        setResults(mapped);
        setIsDbSynced(true);
      }
    } catch (err) {
      console.error("Error loading mentions from DB:", err);
    } finally {
      setIsLoadingDbMentions(false);
    }
  };

  const handlePlatformChange = (platform: string) => {
    setSelectedPlatforms(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  const getTargetPlatforms = () => {
    if (category === "social") {
      return ["twitter", "instagram", "facebook", "tiktok", "reddit", "linkedin"].filter(p => selectedPlatforms[p]);
    } else {
      return ["google_news"].filter(p => selectedPlatforms[p]);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const platformsToSearch = getTargetPlatforms();
    if (platformsToSearch.length === 0) return;

    setIsSearching(true);
    setIsDbSynced(false);
    setResults([]);
    setActiveResultTab("all");
    setCurrentPage(1);

    const initialStatuses: Record<string, SearchJobStatus> = {};
    platformsToSearch.forEach((p) => {
      initialStatuses[p] = { status: "STARTING", progress: 0 };
    });
    setJobStatuses(initialStatuses);

    try {
      const searchRes = await searchEngine.executeSearch({
        query,
        platforms: platformsToSearch,
        dateFilterEnabled,
        dateFrom,
        dateTo,
        projectId: selectedProject?.id,
        onJobStatusChange: (platform, status) => {
          setJobStatuses((prev) => ({ ...prev, [platform]: status }));
        },
        onPartialResults: (_platform, partialItems) => {
          setResults((prev) => {
            const combined = [...prev, ...partialItems];
            const seen = new Set<string>();
            const unique: SearchResult[] = [];
            for (const item of combined) {
              const k = item.url?.trim() || `${item.title}-${item.description}`.trim();
              if (k && !seen.has(k)) {
                seen.add(k);
                unique.push(item);
              }
            }
            return unique;
          });
        },
      });

      setResults(searchRes.results);
      if (searchRes.savedCount > 0 && selectedProject) {
        setIsDbSynced(true);
        toast({
          title: "✓ Guardado en Base de Datos",
          description: `Se sincronizaron ${searchRes.savedCount} menciones en el proyecto "${selectedProject.nombre}".`,
        });
      }
    } catch (err) {
      console.error("Search execution error:", err);
      toast({
        title: "Error en la búsqueda",
        description: "Ocurrió un error al procesar las plataformas solicitadas.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAiSearch = async () => {
    if (!query.trim()) return;

    setIsParsingIntent(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-intent", {
        body: { prompt: query }
      });

      if (error) throw error;

      if (data && data.success && data.data) {
        const result = data.data;
        
        // 1. Update Query with boolean expanded intent
        if (result.query) {
          setQuery(result.query);
        }
        
        // 2. Update Platforms
        const newPlatforms = { ...selectedPlatforms };
        Object.keys(newPlatforms).forEach(k => newPlatforms[k] = false);
        if (result.platforms && Array.isArray(result.platforms)) {
          result.platforms.forEach((p: string) => {
            if (newPlatforms.hasOwnProperty(p)) newPlatforms[p] = true;
          });
        }
        setSelectedPlatforms(newPlatforms);
        
        // Determine category based on platforms
        if (result.platforms?.includes("google_news") && !result.platforms?.some((p: string) => p !== "google_news")) {
          setCategory("noticias");
        } else {
          setCategory("social");
        }

        // 3. Update Dates
        if (result.dateFrom || result.dateTo) {
          setDateFilterEnabled(true);
          if (result.dateFrom) setDateFrom(new Date(result.dateFrom));
          if (result.dateTo) setDateTo(new Date(result.dateTo));
        }
      }
    } catch (err) {
      console.error("AI Parse Intent Error:", err);
    } finally {
      setIsParsingIntent(false);
    }
  };

  // Download CSV handler
  const handleDownloadCSV = () => {
    exportResultsToExcel(results, query);
  };

  const handleManualSave = async () => {
    if (!selectedProject || results.length === 0) return;
    setIsSavingToDb(true);
    try {
      const count = await saveResultsToDb(selectedProject.id, results, query);
      setIsDbSynced(true);
      toast({
        title: "✓ Guardado en Base de Datos",
        description: `Se sincronizaron ${count} menciones en el proyecto "${selectedProject.nombre}".`,
      });
    } catch {
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar las menciones.",
        variant: "destructive",
      });
    } finally {
      setIsSavingToDb(false);
    }
  };

  // Filtered & Sorted Results
  const filteredAndSortedResults = useMemo(() => {
    let list = results.filter(r => activeResultTab === "all" || r.platform === activeResultTab);

    return list.sort((a, b) => {
      if (sortBy === "newest") {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === "oldest") {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === "engagement") {
        const engA = (a.metrics?.likes || 0) + (a.metrics?.comments || 0) * 2 + (a.metrics?.shares || 0) * 3;
        const engB = (b.metrics?.likes || 0) + (b.metrics?.comments || 0) * 2 + (b.metrics?.shares || 0) * 3;
        return engB - engA;
      }
      return 0;
    });
  }, [results, activeResultTab, sortBy]);

  // Paginated Results
  const totalPages = Math.ceil(filteredAndSortedResults.length / pageSize) || 1;
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedResults.slice(start, start + pageSize);
  }, [filteredAndSortedResults, currentPage, pageSize]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Exploración y Captura</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Búsqueda unificada en redes sociales y medios con persistencia en base de datos.
          </p>
        </div>

        {selectedProject && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 bg-purple-50 text-purple-700 border-purple-200 gap-1.5 text-xs font-medium">
              <Database className="h-3.5 w-3.5" />
              Proyecto: {selectedProject.nombre}
            </Badge>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDbMentions}
              disabled={isLoadingDbMentions}
              className="text-xs h-7 gap-1.5"
              title="Cargar menciones guardadas previamente en la base de datos"
            >
              {isLoadingDbMentions ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FolderOpen className="h-3 w-3 text-purple-600" />
              )}
              Cargar desde BD
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-6">
            
            {/* Primary Search Input & Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-4xl">
              <div className="relative flex-1">
                <Input 
                  type="text" 
                  placeholder="Ingresa tu búsqueda (ej. Actinver, #Finanzas, @Actinver_mx)..." 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-base py-6 pr-10"
                  disabled={isSearching || isParsingIntent}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="px-6 bg-[#5D3AB2] hover:bg-[#4E3197] text-white" 
                  disabled={isSearching || isParsingIntent || !query.trim() || getTargetPlatforms().length === 0}
                >
                  {isSearching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <SearchIcon className="mr-2 h-5 w-5" />}
                  Buscar
                </Button>

                <Button 
                  type="button" 
                  variant="outline"
                  size="lg" 
                  onClick={handleAiSearch}
                  disabled={isSearching || isParsingIntent || !query.trim()}
                  className="px-4 border-[#D8B4FE] text-[#7E22CE] bg-[#FAF5FF] hover:bg-[#F3E8FF]"
                  title="Expande términos, hashtags, redes y fechas con Inteligencia Artificial"
                >
                  {isParsingIntent ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-5 w-5 text-[#9333EA]" />
                  )}
                  Auto-Completar con IA
                </Button>
              </div>
            </div>

            {/* Category and Time Limit Controls */}
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Tabs value={category} onValueChange={(v) => { if(!isSearching) setCategory(v); }} className="w-[320px]">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="social" disabled={isSearching}>Social</TabsTrigger>
                    <TabsTrigger value="noticias" disabled={isSearching}>Noticias</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Date Range Picker */}
              <div className="inline-flex items-center gap-3 p-1 rounded-lg border bg-white shadow-sm mt-5">
                <Button
                  type="button"
                  variant={dateFilterEnabled ? "default" : "ghost"}
                  className={cn("gap-2 h-8 px-3 rounded-md transition-colors text-sm", dateFilterEnabled ? "bg-[#A78BFA] hover:bg-[#8B5CF6] text-white" : "text-muted-foreground")}
                  onClick={() => setDateFilterEnabled(!dateFilterEnabled)}
                  disabled={isSearching}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtrar por fecha
                </Button>
                
                {dateFilterEnabled && (
                  <div className="flex items-center gap-3 pr-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-normal text-muted-foreground">Desde</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[130px] h-8 justify-start text-left font-normal bg-[#F9F5FF] border-[#E9D5FF] text-[#A78BFA] hover:bg-[#F9F5FF]/80 hover:text-[#A78BFA] rounded-md",
                              !dateFrom && "text-muted-foreground"
                            )}
                            disabled={isSearching}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateFrom ? format(dateFrom, "d MMM yyyy", { locale: es }) : "Inicio"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover" align="start">
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-normal text-muted-foreground">Hasta</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[130px] h-8 justify-start text-left font-normal bg-[#F9F5FF] border-[#E9D5FF] text-[#A78BFA] hover:bg-[#F9F5FF]/80 hover:text-[#A78BFA] rounded-md",
                              !dateTo && "text-muted-foreground"
                            )}
                            disabled={isSearching}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateTo ? format(dateTo, "d MMM yyyy", { locale: es }) : "Fin"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover" align="start">
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Selection based on Category */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Plataformas a buscar</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 px-2 text-[#5D3AB2] hover:bg-[#5D3AB2]/10 hover:text-[#5D3AB2]"
                  onClick={() => {
                    const platforms = category === "social" 
                      ? ["twitter", "instagram", "facebook", "tiktok", "reddit", "linkedin"]
                      : ["google_news"];
                    
                    const allSelected = platforms.every(p => selectedPlatforms[p]);
                    
                    setSelectedPlatforms(prev => {
                      const next = { ...prev };
                      platforms.forEach(p => {
                        next[p] = !allSelected;
                      });
                      return next;
                    });
                  }}
                  disabled={isSearching || isParsingIntent}
                >
                  {(() => {
                    const platforms = category === "social" 
                      ? ["twitter", "instagram", "facebook", "tiktok", "reddit", "linkedin"]
                      : ["google_news"];
                    const allSelected = platforms.every(p => selectedPlatforms[p]);
                    return allSelected ? "Deseleccionar todas" : "Seleccionar todas";
                  })()}
                </Button>
              </div>
              
              {category === "social" && (
                <div className="flex flex-wrap gap-6">
                  {["twitter", "instagram", "facebook", "tiktok", "reddit", "linkedin"].map((p) => (
                    <div key={p} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`p-${p}`} 
                        checked={selectedPlatforms[p]} 
                        onCheckedChange={() => handlePlatformChange(p)} 
                        disabled={isSearching}
                      />
                      <Label htmlFor={`p-${p}`} className="cursor-pointer capitalize">{p}</Label>
                      
                      {jobStatuses[p] && (
                        <span className="text-xs text-muted-foreground flex items-center ml-2">
                          {jobStatuses[p].status === "STARTING" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          {jobStatuses[p].status === "RUNNING" && <RefreshCw className="h-3 w-3 animate-spin mr-1 text-blue-500" />}
                          {jobStatuses[p].status === "SUCCEEDED" && <Badge className="bg-green-100 hover:bg-green-100 text-green-700 border-green-200 ml-1 rounded-xl px-2 py-0 text-[10px] font-medium shadow-none">Listo</Badge>}
                          {jobStatuses[p].status === "FAILED" && <Badge variant="destructive" className="ml-1 rounded-xl px-2 py-0 text-[10px] shadow-none bg-red-500">Error</Badge>}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {category === "noticias" && (
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="p-google_news" 
                      checked={selectedPlatforms.google_news} 
                      onCheckedChange={() => handlePlatformChange("google_news")} 
                      disabled={isSearching}
                    />
                    <Label htmlFor="p-google_news" className="cursor-pointer">Google News (Firecrawl)</Label>
                    
                    {jobStatuses["google_news"] && (
                      <span className="text-xs text-muted-foreground flex items-center ml-2">
                        {jobStatuses["google_news"].status === "STARTING" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        {jobStatuses["google_news"].status === "RUNNING" && <RefreshCw className="h-3 w-3 animate-spin mr-1 text-blue-500" />}
                        {jobStatuses["google_news"].status === "SUCCEEDED" && <Badge className="bg-green-100 hover:bg-green-100 text-green-700 border-green-200 ml-1 rounded-xl px-2 py-0 text-[10px] font-medium shadow-none">Listo</Badge>}
                        {jobStatuses["google_news"].status === "FAILED" && <Badge variant="destructive" className="ml-1 rounded-xl px-2 py-0 text-[10px] shadow-none bg-red-500">Error</Badge>}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

          </form>
        </CardContent>
      </Card>
      
      {/* Results View */}
      {(results.length > 0 || isSearching) && (
        <div className="mt-8 border-t pt-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">
                  Resultados de búsqueda ({filteredAndSortedResults.length})
                </h3>
                {isDbSynced && selectedProject && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1 py-0.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Sincronizado en BD
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Las menciones están respaldadas en la base de datos de tu proyecto y en la sesión.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {results.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <SelectValue placeholder="Ordenar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Más recientes</SelectItem>
                        <SelectItem value="oldest">Más antiguos</SelectItem>
                        <SelectItem value="engagement">Mayor interacción</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProject && (
                    <Button 
                      onClick={handleManualSave} 
                      variant="outline" 
                      size="sm" 
                      disabled={isSavingToDb}
                      className="gap-1.5 h-8 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                      title="Guardar manualmente las menciones en la base de datos de Supabase"
                    >
                      {isSavingToDb ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Database className="h-3.5 w-3.5 text-purple-600" />
                      )}
                      Guardar en BD
                    </Button>
                  )}

                  <Button onClick={handleDownloadCSV} variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Descargar CSV
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {results.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={activeResultTab === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setActiveResultTab("all"); setCurrentPage(1); }}
                className={cn("rounded-full h-7 text-xs", activeResultTab === "all" ? "bg-[#5D3AB2] hover:bg-[#4E3197] text-white" : "")}
              >
                Todos ({results.length})
              </Button>
              {Object.entries(
                results.reduce((acc, result) => {
                  acc[result.platform] = (acc[result.platform] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([platform, count]) => (
                <Button
                  key={platform}
                  variant={activeResultTab === platform ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setActiveResultTab(platform); setCurrentPage(1); }}
                  className={cn("rounded-full capitalize h-7 text-xs", activeResultTab === platform ? "bg-[#5D3AB2] hover:bg-[#4E3197] text-white" : "")}
                >
                  {platform.replace('_', ' ')} ({count})
                </Button>
              ))}
            </div>
          )}
          
          <div className="grid gap-4">
            {paginatedResults.map((result, idx) => (
              <Card key={`${result.id}-${idx}`} className="overflow-hidden hover:border-purple-200 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2 capitalize">{result.platform.replace('_', ' ')}</Badge>
                      <CardTitle className="text-base font-semibold leading-snug">
                        {result.title || "Publicación"}
                      </CardTitle>
                      {result.author?.name && (
                        <CardDescription className="mt-1 flex items-center gap-2">
                          {result.author.avatarUrl && <img src={result.author.avatarUrl} className="w-5 h-5 rounded-full" alt="avatar" />}
                          <span className="font-medium text-foreground/80">{result.author.name}</span>
                          {result.author.username && <span>@{result.author.username}</span>}
                          {result.publishedAt && (
                            <span className="text-xs ml-2">
                              • {format(new Date(result.publishedAt), "PPP", { locale: es })}
                            </span>
                          )}
                        </CardDescription>
                      )}
                    </div>
                    {result.url && (
                      <a href={result.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-1">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-foreground/90 line-clamp-3 whitespace-pre-wrap">
                    {result.description}
                  </p>

                  {/* Metrics Badge Row */}
                  {result.metrics && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
                      {result.metrics.likes !== undefined && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5 text-rose-500" />
                          {result.metrics.likes.toLocaleString()}
                        </span>
                      )}
                      {result.metrics.comments !== undefined && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                          {result.metrics.comments.toLocaleString()}
                        </span>
                      )}
                      {result.metrics.shares !== undefined && (
                        <span className="flex items-center gap-1">
                          <Share2 className="h-3.5 w-3.5 text-green-500" />
                          {result.metrics.shares.toLocaleString()}
                        </span>
                      )}
                      {Boolean(result.metrics.views) && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-amber-500" />
                          {result.metrics.views?.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            
            {isSearching && results.length === 0 && (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>Buscando información en las plataformas seleccionadas...</p>
              </div>
            )}
            
            {!isSearching && results.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <p>No se encontraron resultados para esta búsqueda con los filtros aplicados.</p>
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages} ({filteredAndSortedResults.length} resultados)
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} 
                  disabled={currentPage === 1}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} 
                  disabled={currentPage === totalPages}
                  className="h-8 px-2"
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

