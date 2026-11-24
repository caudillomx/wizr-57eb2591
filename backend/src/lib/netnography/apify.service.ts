import axios from "axios";
import prisma from "../../config/prisma";
import { NetnographyPlatform, xSearchTerms } from "./platforms";
import { assessAuthenticity, buildPseudonymizer } from "./sampling";

const APIFY_BASE = "https://api.apify.com/v2";

export const NETNOGRAPHY_ACTORS: Record<NetnographyPlatform, string> = {
  youtube: "streamers~youtube-comments-scraper",
  tiktok: "clockworks~tiktok-comments-scraper",
  instagram: "apify~instagram-comment-scraper",
  facebook: "apify~facebook-comments-scraper",
  x: "apidojo~twitter-scraper-lite",
};

function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
  if (!token) {
    throw new Error("APIFY_API_TOKEN no está configurado en el servidor.");
  }
  return token;
}

export function buildActorInput(
  platform: NetnographyPlatform,
  url: string,
  postId: string | null,
  maxComments: number,
  includeReplies: boolean
) {
  switch (platform) {
    case "youtube":
      return { startUrls: [{ url }], maxComments };
    case "tiktok":
      return { postURLs: [url], commentsPerPost: maxComments, maxRepliesPerComment: includeReplies ? 10 : 0 };
    case "instagram":
      return { directUrls: [url], resultsLimit: maxComments, includeNestedComments: includeReplies };
    case "facebook":
      return { startUrls: [{ url }], resultsLimit: maxComments, includeNestedComments: includeReplies };
    case "x":
      return {
        searchTerms: xSearchTerms(postId || ""),
        maxItems: maxComments,
        sort: "Latest + Top",
        includeSearchTerms: true,
        deliverMode: "perPost",
      };
  }
}

export async function startSourceExtraction(sourceId: string) {
  const source = await prisma.netnographySource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Fuente no encontrada");
  if (source.platform === "fanpage_karma") return source;

  const token = getApifyToken();
  const platform = source.platform as NetnographyPlatform;
  const actorId = NETNOGRAPHY_ACTORS[platform];
  if (!actorId) throw new Error(`Plataforma no soportada para extracción: ${source.platform}`);

  const input = buildActorInput(platform, source.url, source.post_id, source.max_comments, source.include_replies);
  const runRes = await axios.post(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, input, {
    timeout: 30_000,
  });
  const runData = runRes.data?.data;

  return prisma.netnographySource.update({
    where: { id: source.id },
    data: {
      status: "extrayendo",
      apify_run_id: runData?.id || null,
      apify_dataset_id: runData?.defaultDatasetId || null,
      started_at: new Date(),
      error: null,
    },
  });
}

function normalizeApifyComment(item: any, platform: string) {
  const text = String(
    item.text || item.comment || item.full_text || item.message || item.body || ""
  ).trim();
  if (!text) return null;

  const externalId = String(
    item.id || item.cid || item.commentId || item.tweetId || item.url || `${platform}-${text.slice(0, 40)}-${item.createdAt || ""}`
  );
  const rawAuthor = String(
    item.author?.userName ||
      item.author?.name ||
      item.ownerUsername ||
      item.uniqueId ||
      item.authorName ||
      item.username ||
      item.author ||
      "anonimo"
  );
  const publishedRaw = item.publishedAt || item.createdAt || item.createTimeISO || item.date || item.timestamp;
  const publishedAt = publishedRaw ? new Date(publishedRaw) : null;

  return {
    external_id: externalId,
    rawAuthor,
    text,
    published_at: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
    likes: Number(item.likesCount ?? item.likeCount ?? item.diggCount ?? item.likes ?? 0) || 0,
    replies_count: Number(item.replyCount ?? item.repliesCount ?? 0) || 0,
    shares_count: Number(item.retweetCount ?? item.shareCount ?? 0) || 0,
    url: item.url || item.commentUrl || null,
    is_reply: Boolean(item.isReply || item.parentCommentId || item.inReplyToId),
    parent_external_id: item.parentCommentId || item.inReplyToId || null,
    raw: item,
  };
}

export async function syncSourceExtraction(sourceId: string) {
  const source = await prisma.netnographySource.findUnique({ where: { id: sourceId } });
  if (!source || !source.apify_run_id) return source;

  const token = getApifyToken();
  const statusRes = await axios.get(`${APIFY_BASE}/actor-runs/${source.apify_run_id}?token=${token}`, {
    timeout: 20_000,
  });
  const run = statusRes.data?.data;
  const apifyStatus = String(run?.status || "");
  const datasetId = run?.defaultDatasetId || source.apify_dataset_id;

  let normalizedItems: ReturnType<typeof normalizeApifyComment>[] = [];
  if (datasetId) {
    const itemsRes = await axios.get(`${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=${source.max_comments}`, {
      timeout: 30_000,
    });
    const rawItems = Array.isArray(itemsRes.data) ? itemsRes.data : [];
    normalizedItems = rawItems.map((it: any) => normalizeApifyComment(it, source.platform)).filter(Boolean);
  }

  if (normalizedItems.length > 0) {
    const pseudo = buildPseudonymizer();
    const assessment = assessAuthenticity(
      normalizedItems.map((n) => ({
        id: n!.external_id,
        stratum: source.platform,
        authorKey: n!.rawAuthor,
        text: n!.text,
        raw: n!.raw,
      }))
    );

    for (const item of normalizedItems) {
      if (!item) continue;
      const { alias, hash } = pseudo(item.rawAuthor);
      const auth = assessment.get(item.external_id) || { flag: "organic", signals: [] };

      await prisma.netnographyComment.upsert({
        where: {
          source_id_external_id: {
            source_id: source.id,
            external_id: item.external_id,
          },
        },
        update: {
          likes: item.likes,
          replies_count: item.replies_count,
          shares_count: item.shares_count,
        },
        create: {
          source_id: source.id,
          external_id: item.external_id,
          author_alias: alias,
          author_hash: hash,
          text: item.text,
          published_at: item.published_at,
          likes: item.likes,
          replies_count: item.replies_count,
          shares_count: item.shares_count,
          url: item.url,
          is_reply: item.is_reply,
          parent_external_id: item.parent_external_id,
          authenticity_flag: auth.flag,
          authenticity_signals: auth.signals,
          stratum: source.platform,
          raw: item.raw,
        },
      });
    }
  }

  const totalCount = await prisma.netnographyComment.count({ where: { source_id: source.id } });
  const isDone = apifyStatus === "SUCCEEDED";
  const isError = ["FAILED", "ABORTED", "TIMED-OUT"].includes(apifyStatus);

  return prisma.netnographySource.update({
    where: { id: source.id },
    data: {
      apify_dataset_id: datasetId,
      comment_count: totalCount,
      status: isDone ? "extraida" : isError ? "error" : "extrayendo",
      error: isError ? `Extracción terminó con estado ${apifyStatus}` : null,
      finished_at: isDone || isError ? new Date() : null,
      recheck_at:
        isDone && source.platform === "x" && !source.rechecked
          ? new Date(Date.now() + 2 * 3600 * 1000)
          : source.recheck_at,
    },
  });
}
