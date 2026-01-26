import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Globe,
  ThumbsUp,
  ThumbsDown,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { InfluencerMetrics } from "@/hooks/useInfluencersData";

interface InfluencerCardProps {
  influencer: InfluencerMetrics;
  rank: number;
  maxMentions: number;
}

export function InfluencerCard({ influencer, rank, maxMentions }: InfluencerCardProps) {
  const {
    domain,
    totalMentions,
    sentiment,
    sentimentScore,
    recentMentions,
    trend,
    topKeywords,
    entities,
    lastMentionDate,
  } = influencer;

  const mentionPercentage = maxMentions > 0 
    ? (totalMentions / maxMentions) * 100 
    : 0;

  const TrendIcon = trend === "up" 
    ? TrendingUp 
    : trend === "down" 
    ? TrendingDown 
    : Minus;

  const trendColor = trend === "up" 
    ? "text-green-500" 
    : trend === "down" 
    ? "text-red-500" 
    : "text-muted-foreground";

  const getSentimentColor = (score: number) => {
    if (score > 0.2) return "text-green-500";
    if (score < -0.2) return "text-red-500";
    return "text-yellow-500";
  };

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  // Check if sentiment has been analyzed
  const hasSentimentData = sentiment.positivo > 0 || sentiment.neutral > 0 || sentiment.negativo > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted overflow-hidden">
              <img 
                src={faviconUrl} 
                alt="" 
                className="h-6 w-6"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement!.innerHTML = `<span class="font-bold text-sm text-primary">${rank}</span>`;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{domain}</span>
                <Badge variant="outline" className="text-xs">#{rank}</Badge>
              </div>
              {lastMentionDate && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  Última mención: {formatDistanceToNow(new Date(lastMentionDate), { 
                    addSuffix: true, 
                    locale: es 
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon className={`h-5 w-5 ${trendColor}`} />
            <Badge variant={trend === "up" ? "default" : trend === "down" ? "destructive" : "secondary"}>
              {trend === "up" ? "En alza" : trend === "down" ? "En baja" : "Estable"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mentions bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Total menciones</span>
            <span className="font-semibold">{totalMentions}</span>
          </div>
          <Progress value={mentionPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {recentMentions} en los últimos 7 días
          </p>
        </div>

        {/* Sentiment breakdown */}
        {hasSentimentData ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2">
                <ThumbsUp className="h-4 w-4 mx-auto text-green-500 mb-1" />
                <p className="text-lg font-bold text-green-600">{sentiment.positivo}</p>
                <p className="text-xs text-muted-foreground">Positivo</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/30 p-2">
                <Minus className="h-4 w-4 mx-auto text-gray-500 mb-1" />
                <p className="text-lg font-bold text-gray-600">{sentiment.neutral}</p>
                <p className="text-xs text-muted-foreground">Neutral</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2">
                <ThumbsDown className="h-4 w-4 mx-auto text-red-500 mb-1" />
                <p className="text-lg font-bold text-red-600">{sentiment.negativo}</p>
                <p className="text-xs text-muted-foreground">Negativo</p>
              </div>
            </div>

            {/* Sentiment score */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score de sentimiento</span>
              <span className={`font-semibold ${getSentimentColor(sentimentScore)}`}>
                {sentimentScore > 0 ? "+" : ""}{(sentimentScore * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm text-muted-foreground">
              Sentimiento pendiente de análisis
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Ve a Semántica para ejecutar el análisis
            </p>
          </div>
        )}

        {/* Entities */}
        {entities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Entidades mencionadas</p>
            <div className="flex flex-wrap gap-1">
              {entities.slice(0, 3).map((entity) => (
                <Badge key={entity} variant="outline" className="text-xs">
                  {entity}
                </Badge>
              ))}
              {entities.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{entities.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Keywords */}
        {topKeywords.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Palabras clave frecuentes</p>
            <div className="flex flex-wrap gap-1">
              {topKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
