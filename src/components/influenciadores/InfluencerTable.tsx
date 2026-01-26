import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, AlertCircle, ExternalLink } from "lucide-react";
import { InfluencerMetrics } from "@/hooks/useInfluencersData";
import { SourceMentionsDrawer } from "./SourceMentionsDrawer";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Mention {
  id: string;
  title: string | null;
  description: string | null;
  url: string;
  source_domain: string | null;
  sentiment: string | null;
  created_at: string;
  matched_keywords: string[];
}

interface InfluencerTableProps {
  influencers: InfluencerMetrics[];
  maxMentions: number;
  mentions?: Mention[];
}

export function InfluencerTable({ influencers, maxMentions, mentions = [] }: InfluencerTableProps) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDomainClick = (domain: string) => {
    setSelectedDomain(domain);
    setDrawerOpen(true);
  };

  // Check if any mentions have sentiment analyzed
  const hasSentimentData = mentions.some((m) => m.sentiment !== null);

  if (influencers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Fuentes</CardTitle>
          <CardDescription>Tabla detallada de todas las fuentes</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No hay datos de fuentes disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return "text-emerald-600 font-semibold";
    if (score < -0.2) return "text-red-600 font-semibold";
    return "text-amber-600 font-semibold";
  };

  const getSentimentBg = (score: number) => {
    if (score > 0.2) return "bg-emerald-50";
    if (score < -0.2) return "bg-red-50";
    return "bg-amber-50";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Ranking de Fuentes
            {!hasSentimentData && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1 font-normal">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      Sentimiento pendiente
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Las menciones no han sido analizadas semánticamente.</p>
                    <p>Ve a Semántica para ejecutar el análisis.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <CardDescription>
            {influencers.length} fuentes identificadas ordenadas por impacto • Clic en una fila para ver menciones
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Fuente</TableHead>
                <TableHead className="text-center">Menciones</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    Sentimiento
                    {!hasSentimentData && (
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Tendencia</TableHead>
                <TableHead>Última Mención</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {influencers.map((influencer, index) => {
                const TrendIcon = influencer.trend === "up"
                  ? TrendingUp
                  : influencer.trend === "down"
                  ? TrendingDown
                  : Minus;

                const trendColor = influencer.trend === "up"
                  ? "text-emerald-600"
                  : influencer.trend === "down"
                  ? "text-red-600"
                  : "text-muted-foreground";

                const trendBg = influencer.trend === "up"
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : influencer.trend === "down"
                  ? "bg-red-50 dark:bg-red-950/30"
                  : "bg-muted";

                const mentionPercentage = maxMentions > 0
                  ? (influencer.totalMentions / maxMentions) * 100
                  : 0;

                const faviconUrl = `https://www.google.com/s2/favicons?domain=${influencer.domain}&sz=32`;

                // Check if this domain has sentiment data
                const domainMentions = mentions.filter(m => m.source_domain === influencer.domain);
                const domainHasSentiment = domainMentions.some(m => m.sentiment !== null);

                return (
                  <TableRow 
                    key={influencer.domain}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleDomainClick(influencer.domain)}
                  >
                    <TableCell className="font-bold text-primary">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <img 
                          src={faviconUrl} 
                          alt="" 
                          className="h-5 w-5 rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                        <div>
                          <div className="font-medium text-foreground">{influencer.domain}</div>
                          {influencer.entities.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {influencer.entities.slice(0, 2).map((e) => (
                                <Badge key={e} variant="outline" className="text-xs">
                                  {e}
                                </Badge>
                              ))}
                              {influencer.entities.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{influencer.entities.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">{influencer.totalMentions}</span>
                          <span className="text-muted-foreground text-xs">
                            ({influencer.recentMentions} recientes)
                          </span>
                        </div>
                        <Progress value={mentionPercentage} className="h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell>
                      {domainHasSentiment ? (
                        <div className="flex justify-center gap-2 text-xs">
                          <span className="text-emerald-600 font-medium">{influencer.sentiment.positivo}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-muted-foreground">{influencer.sentiment.neutral}</span>
                          <span className="text-muted-foreground">/</span>
                          <span className="text-red-600 font-medium">{influencer.sentiment.negativo}</span>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Sin analizar
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {domainHasSentiment ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${getSentimentColor(influencer.sentimentScore)} ${getSentimentBg(influencer.sentimentScore)}`}>
                          {influencer.sentimentScore > 0 ? "+" : ""}
                          {(influencer.sentimentScore * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-full ${trendBg}`}>
                        <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                        <span className={`text-xs ${trendColor}`}>{
                          influencer.trend === "up" ? "Alza" : 
                          influencer.trend === "down" ? "Baja" : 
                          "Estable"
                        }</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {influencer.lastMentionDate
                        ? formatDistanceToNow(new Date(influencer.lastMentionDate), {
                            addSuffix: true,
                            locale: es,
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SourceMentionsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sourceDomain={selectedDomain}
        mentions={mentions}
      />
    </>
  );
}
