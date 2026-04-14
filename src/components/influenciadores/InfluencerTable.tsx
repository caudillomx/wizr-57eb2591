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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendingUp, TrendingDown, Minus, AlertCircle, ExternalLink, Heart, Eye } from "lucide-react";
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

  const handleRowClick = (influencer: InfluencerMetrics) => {
    // Use platform domain for drawer filtering
    setSelectedDomain(influencer.platform.toLowerCase().replace("/", ""));
    setDrawerOpen(true);
  };

  const hasSentimentData = mentions.some((m) => m.sentiment !== null);

  if (influencers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Influenciadores</CardTitle>
          <CardDescription>Perfiles con mayor impacto</CardDescription>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center">
          <p className="text-muted-foreground">No hay datos de influenciadores disponibles</p>
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
            Ranking de Influenciadores
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
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <CardDescription>
            {influencers.length} perfiles identificados ordenados por impacto
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-center">Red Social</TableHead>
                <TableHead className="text-center">Publicaciones</TableHead>
                <TableHead className="text-center">Engagement</TableHead>
                <TableHead className="text-center">Sentimiento</TableHead>
                <TableHead className="text-center">Tendencia</TableHead>
                <TableHead>Última Actividad</TableHead>
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

                const initials = influencer.authorName.slice(0, 2).toUpperCase();

                return (
                  <TableRow 
                    key={influencer.authorKey}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(influencer)}
                  >
                    <TableCell className="font-bold text-primary">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          {influencer.authorAvatarUrl && <AvatarImage src={influencer.authorAvatarUrl} />}
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-foreground flex items-center gap-1">
                            {influencer.authorUrl ? (
                              <a
                                href={influencer.authorUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {influencer.authorName}
                              </a>
                            ) : (
                              influencer.authorName
                            )}
                            {influencer.authorUrl && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                          </div>
                          {influencer.authorUsername && (
                            <span className="text-xs text-muted-foreground">@{influencer.authorUsername}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">{influencer.platform}</Badge>
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
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        {influencer.totalEngagement > 0 && (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Heart className="h-3 w-3" /> {influencer.totalEngagement.toLocaleString()}
                          </span>
                        )}
                        {influencer.totalViews > 0 && (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Eye className="h-3 w-3" /> {influencer.totalViews.toLocaleString()}
                          </span>
                        )}
                        {influencer.totalEngagement === 0 && influencer.totalViews === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${getSentimentColor(influencer.sentimentScore)} ${getSentimentBg(influencer.sentimentScore)}`}>
                        {influencer.sentimentScore > 0 ? "+" : ""}
                        {(influencer.sentimentScore * 100).toFixed(0)}%
                      </span>
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