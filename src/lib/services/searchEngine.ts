import { apifyApi } from "@/lib/api/apify";
import { firecrawlApi } from "@/lib/api/firecrawl";
import { supabase } from "@/integrations/supabase/client";
import { format, isAfter, startOfDay } from "date-fns";
import * as XLSX from "xlsx";

export interface SearchResult {
  id: string;
  platform: string;
  title: string;
  description: string;
  url: string;
  publishedAt?: string;
  author?: {
    name?: string;
    username?: string;
    avatarUrl?: string;
  };
  metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
}

export type SearchPlatform =
  | "twitter"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "reddit"
  | "linkedin"
  | "google_news";

export interface SearchJobStatus {
  status: "STARTING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  progress?: number;
  error?: string;
}

export interface ExecuteSearchParams {
  query: string;
  platforms: string[];
  dateFilterEnabled?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  projectId?: string;
  entityId?: string;
  maxResults?: number;
  strictMatching?: boolean;
  onJobStatusChange?: (platform: string, status: SearchJobStatus) => void;
  onPartialResults?: (platform: string, newResults: SearchResult[]) => void;
}

export interface ExecuteSearchResult {
  results: SearchResult[];
  savedCount: number;
  statuses: Record<string, SearchJobStatus>;
}

export function filterResultsByTime(
  items: SearchResult[],
  dateFilterEnabled?: boolean,
  dateFrom?: Date,
  dateTo?: Date
): SearchResult[] {
  if (!dateFilterEnabled || !dateFrom || !dateTo) return items;

  const fromStart = startOfDay(dateFrom);
  const toEnd = new Date(dateTo);
  toEnd.setHours(23, 59, 59, 999);

  return items.filter((item) => {
    if (!item.publishedAt) return true;
    const pubDate = new Date(item.publishedAt);
    if (isNaN(pubDate.getTime())) return true;
    return !isAfter(fromStart, pubDate) && !isAfter(pubDate, toEnd);
  });
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deduplicateResults(items: SearchResult[]): SearchResult[] {
  const uniqueResults: SearchResult[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const uniqueKey = item.url?.trim() || `${item.title}-${item.description}`.trim();
    if (uniqueKey && !seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      uniqueResults.push(item);
    }
  }

  return uniqueResults;
}

export async function saveResultsToDb(
  projectId: string,
  itemsToSave: SearchResult[],
  query?: string,
  entityId?: string
): Promise<number> {
  if (!projectId || itemsToSave.length === 0) return 0;

  try {
    const mentionsToUpsert = itemsToSave.map((item) => ({
      project_id: projectId,
      entity_id: entityId || null,
      url: item.url || `urn:wizr:${item.platform}:${item.id}`,
      title: item.title || (item.description ? item.description.substring(0, 120) : "Mención"),
      description: item.description || "",
      source_domain: item.platform,
      published_at: item.publishedAt
        ? new Date(item.publishedAt).toISOString()
        : new Date().toISOString(),
      matched_keywords: query ? [query] : [],
      is_read: false,
      is_archived: false,
      raw_metadata: {
        author: typeof item.author === "string" ? item.author : (item.author?.name || item.author?.username || ""),
        author_name: item.author?.name || (typeof item.author === "string" ? item.author : ""),
        author_username: item.author?.username || "",
        author_avatar_url: item.author?.avatarUrl || "",
        author_details: item.author,
        metrics: item.metrics,
        platform: item.platform,
        external_id: item.id,
      },
    }));

    const { error, data } = await supabase
      .from("mentions")
      .upsert(mentionsToUpsert, { onConflict: "project_id,url" })
      .select("id");

    if (error) {
      console.error("Save to mentions error:", error);
      throw error;
    }

    return data?.length ?? mentionsToUpsert.length;
  } catch (err) {
    console.error("Auto-save to Supabase failed:", err);
    return 0;
  }
}

export function exportResultsToExcel(results: SearchResult[], query?: string): void {
  if (results.length === 0) return;

  const csvData = results.map((result) => ({
    Plataforma: result.platform,
    Título: result.title,
    Descripción: result.description,
    URL: result.url,
    Fecha: result.publishedAt ? format(new Date(result.publishedAt), "yyyy-MM-dd HH:mm:ss") : "",
    Autor_Nombre: result.author?.name || "",
    Autor_Usuario: result.author?.username || "",
    Likes: result.metrics?.likes ?? 0,
    Comentarios: result.metrics?.comments ?? 0,
    Compartidos: result.metrics?.shares ?? 0,
    Vistas: result.metrics?.views ?? 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(csvData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Menciones");

  const safeQuery = query ? query.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "menciones";
  const fileName = `wizr_${safeQuery}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export class WizrSearchEngine {
  private activePolls: Record<string, NodeJS.Timeout> = {};

  public cancelActivePolls() {
    Object.values(this.activePolls).forEach(clearTimeout);
    this.activePolls = {};
  }

  private pollJobStatus(
    runId: string,
    platform: string,
    query: string,
    params: ExecuteSearchParams,
    onSuccess: (items: SearchResult[]) => void,
    onFail: (err: string) => void
  ) {
    apifyApi
      .checkStatus(runId, platform)
      .then((res) => {
        if (!res.success || !res.data) {
          const errMsg = res.error || "Unknown error";
          params.onJobStatusChange?.(platform, { status: "FAILED", error: errMsg });
          onFail(errMsg);
          return;
        }

        const { status, items } = res.data;

        if (status === "SUCCEEDED") {
          params.onJobStatusChange?.(platform, { status: "SUCCEEDED", progress: 100 });

          if (items && items.length > 0) {
            const normalized: SearchResult[] = items.map((item: any) => ({
              id: item.id || Math.random().toString(36).substring(2, 11),
              platform,
              title: item.title || "",
              description: item.description || item.text || "",
              url: item.url || "",
              publishedAt: item.publishedAt || item.createdAt,
              author: item.author || {},
              metrics: {
                likes: item.metrics?.likes ?? item.likes ?? item.likesCount ?? 0,
                comments: item.metrics?.comments ?? item.comments ?? item.commentsCount ?? 0,
                shares:
                  item.metrics?.shares ?? item.shares ?? item.sharesCount ?? item.retweets ?? 0,
                views: item.metrics?.views ?? item.views ?? item.viewCount ?? 0,
              },
            }));

            // Time filtering
            const timeFiltered = filterResultsByTime(
              normalized,
              params.dateFilterEnabled,
              params.dateFrom,
              params.dateTo
            );

            // Strict whole-word regex filtering
            let finalItems = timeFiltered;
            if (params.strictMatching !== false && query) {
              const queryRegex = new RegExp(`\\b${escapeRegExp(query)}\\b`, "i");
              finalItems = timeFiltered.filter((item: SearchResult) => {
                const titleMatch = item.title && queryRegex.test(item.title);
                const descMatch = item.description && queryRegex.test(item.description);
                return titleMatch || descMatch;
              });
            }

            onSuccess(finalItems);
          } else {
            onSuccess([]);
          }
        } else if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
          const errMsg = `Job ${status}`;
          params.onJobStatusChange?.(platform, { status: "FAILED", error: errMsg });
          onFail(errMsg);
        } else {
          // Still running, poll again
          params.onJobStatusChange?.(platform, { status: "RUNNING", progress: 50 });
          this.activePolls[runId] = setTimeout(() => {
            this.pollJobStatus(runId, platform, query, params, onSuccess, onFail);
          }, 3000);
        }
      })
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : "Connection error";
        params.onJobStatusChange?.(platform, { status: "FAILED", error: errMsg });
        onFail(errMsg);
      });
  }

  public async executeSearch(params: ExecuteSearchParams): Promise<ExecuteSearchResult> {
    const { query, platforms } = params;
    if (!query.trim() || platforms.length === 0) {
      return { results: [], savedCount: 0, statuses: {} };
    }

    this.cancelActivePolls();

    const statuses: Record<string, SearchJobStatus> = {};
    platforms.forEach((p) => {
      statuses[p] = { status: "STARTING", progress: 0 };
      params.onJobStatusChange?.(p, statuses[p]);
    });

    const collectedResults: SearchResult[] = [];

    const promises = platforms.map(async (platform) => {
      try {
        if (platform === "google_news") {
          statuses[platform] = { status: "RUNNING", progress: 30 };
          params.onJobStatusChange?.(platform, statuses[platform]);

          const newsRes = await firecrawlApi.searchGoogleNews(query, "week", params.maxResults || 25);

          if (newsRes.success && newsRes.data) {
            const mappedNews: SearchResult[] = newsRes.data.map((item) => ({
              id: Math.random().toString(36).substring(2, 11),
              platform: "google_news",
              title: item.title,
              description: item.description || "",
              url: item.url,
              publishedAt: item.metadata?.publishedDate || new Date().toISOString(),
              author: {
                name: item.metadata?.sourceURL || "Noticias Web",
              },
              metrics: { likes: 0, comments: 0, shares: 0, views: 0 },
            }));

            const filteredNews = filterResultsByTime(
              mappedNews,
              params.dateFilterEnabled,
              params.dateFrom,
              params.dateTo
            );

            statuses[platform] = { status: "SUCCEEDED", progress: 100 };
            params.onJobStatusChange?.(platform, statuses[platform]);
            params.onPartialResults?.(platform, filteredNews);
            collectedResults.push(...filteredNews);
          } else {
            const errMsg = newsRes.error || "No se encontraron noticias";
            statuses[platform] = { status: "FAILED", error: errMsg };
            params.onJobStatusChange?.(platform, statuses[platform]);
          }
          return;
        }

        // Social platforms go through Apify
        const res = await apifyApi.startScrape({
          platform,
          query,
          maxResults: params.maxResults || 100,
          ...(params.dateFilterEnabled && params.dateFrom
            ? { dateFrom: params.dateFrom.toISOString() }
            : {}),
          ...(params.dateFilterEnabled && params.dateTo
            ? { dateTo: params.dateTo.toISOString() }
            : {}),
        });

        if (res.success && res.data?.runId) {
          statuses[platform] = { status: "RUNNING", progress: 10 };
          params.onJobStatusChange?.(platform, statuses[platform]);

          await new Promise<void>((resolve) => {
            this.pollJobStatus(
              res.data!.runId!,
              platform,
              query,
              params,
              (items) => {
                collectedResults.push(...items);
                params.onPartialResults?.(platform, items);
                resolve();
              },
              () => {
                resolve();
              }
            );
          });
        } else {
          const errMsg = res.error || "Failed to start scrape";
          statuses[platform] = { status: "FAILED", error: errMsg };
          params.onJobStatusChange?.(platform, statuses[platform]);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Connection error";
        statuses[platform] = { status: "FAILED", error: errMsg };
        params.onJobStatusChange?.(platform, statuses[platform]);
      }
    });

    await Promise.all(promises);

    const uniqueResults = deduplicateResults(collectedResults);

    let savedCount = 0;
    if (params.projectId && uniqueResults.length > 0) {
      savedCount = await saveResultsToDb(
        params.projectId,
        uniqueResults,
        query,
        params.entityId
      );
    }

    return {
      results: uniqueResults,
      savedCount,
      statuses,
    };
  }
}

export const searchEngine = new WizrSearchEngine();
