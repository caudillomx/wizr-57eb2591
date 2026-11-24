import axios from "axios";

export interface ViralSignalItem {
  key: string;
  title: string;
  description: string;
  reach: number;
  signals: Array<{
    platform: "google_trends" | "bluesky" | "youtube";
    geo: string;
    traffic?: number;
    posts?: number;
    views?: number;
    at: string | null;
    link: string | null;
  }>;
  news: Array<{ title: string; url: string; outlet: string }>;
}

function decodeXml(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : "";
}

function subjectKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .sort()
    .slice(0, 5)
    .join(" ");
}

export function reachOf({ traffic = 0, posts = 0, views = 0, places = 1 }): number {
  const searches = traffic > 0 ? Math.min(1, Math.log10(traffic) / 6) : 0;
  const talk = posts > 0 ? Math.min(1, Math.log10(posts) / 4) : 0;
  const watched = views > 0 ? Math.min(1, Math.log10(views) / 7) : 0;
  return Math.round(Math.min(1, Math.max(searches, talk, watched) + 0.08 * Math.max(0, places - 1)) * 1000) / 1000;
}

/**
 * Señales virales inspiradas en Newsloom (Google Trends RSS + Bluesky + YouTube Popular).
 */
export async function fetchViralSignals(geo: string = "MX"): Promise<ViralSignalItem[]> {
  const map = new Map<string, ViralSignalItem>();

  const upsert = (
    key: string,
    title: string,
    signal: ViralSignalItem["signals"][number],
    description = "",
    news: ViralSignalItem["news"] = []
  ) => {
    if (!title) return;
    const k = key || title.toLowerCase();
    const existing = map.get(k) || {
      key: k,
      title,
      description,
      reach: 0,
      signals: [],
      news: [],
    };
    existing.signals.push(signal);
    if (!existing.description && description) existing.description = description;
    for (const n of news) {
      if (!existing.news.some((x) => x.url === n.url)) {
        existing.news.push(n);
      }
    }
    map.set(k, existing);
  };

  // 1. Google Trends RSS
  try {
    const res = await axios.get(`https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`, {
      timeout: 10_000,
    });
    const xml = String(res.data || "");
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const block of items.slice(0, 20)) {
      const title = extractTag(block, "title");
      const trafficRaw = extractTag(block, "ht:approx_traffic");
      const traffic = Number(trafficRaw.replace(/[^\d]/g, "")) || 0;
      const pubDate = extractTag(block, "pubDate");
      const newsBlocks = block.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) || [];
      const news = newsBlocks
        .map((nb) => ({
          title: extractTag(nb, "ht:news_item_title"),
          url: extractTag(nb, "ht:news_item_url"),
          outlet: extractTag(nb, "ht:news_item_source"),
        }))
        .filter((n) => /^https?:\/\//.test(n.url));

      upsert(
        subjectKey(title),
        title,
        {
          platform: "google_trends",
          geo,
          traffic,
          at: pubDate ? new Date(pubDate).toISOString() : null,
          link: news[0]?.url || null,
        },
        news[0]?.title || "",
        news
      );
    }
  } catch (err: any) {
    console.warn("[Signals GoogleTrends]:", err?.message);
  }

  // 2. Bluesky public trending topics
  try {
    const res = await axios.get("https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends?limit=15", {
      timeout: 8_000,
    });
    const trends = res.data?.trends || [];
    for (const t of trends) {
      const title = String(t.displayName || t.topic || "").trim();
      upsert(
        subjectKey(title),
        title,
        {
          platform: "bluesky",
          geo: "GLOBAL",
          posts: Number(t.postCount) || 0,
          at: t.startedAt || null,
          link: t.link ? `https://bsky.app${t.link}` : null,
        },
        String(t.description || "")
      );
    }
  } catch (err: any) {
    console.warn("[Signals Bluesky]:", err?.message);
  }

  // 3. YouTube Most Popular (si hay YOUTUBE_API_KEY)
  const ytKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
  if (ytKey) {
    try {
      const res = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: { part: "snippet,statistics", chart: "mostPopular", regionCode: geo, maxResults: 15, key: ytKey },
        timeout: 8_000,
      });
      for (const v of res.data?.items || []) {
        const title = String(v.snippet?.title || "").trim();
        upsert(
          subjectKey(title),
          title,
          {
            platform: "youtube",
            geo,
            views: Number(v.statistics?.viewCount) || 0,
            at: v.snippet?.publishedAt || null,
            link: v.id ? `https://www.youtube.com/watch?v=${v.id}` : null,
          },
          String(v.snippet?.channelTitle || "")
        );
      }
    } catch (err: any) {
      console.warn("[Signals YouTube]:", err?.message);
    }
  }

  // Calcular reach combinado y ordenar
  const out = [...map.values()].map((item) => {
    const maxTraffic = Math.max(0, ...item.signals.map((s) => s.traffic || 0));
    const maxPosts = Math.max(0, ...item.signals.map((s) => s.posts || 0));
    const maxViews = Math.max(0, ...item.signals.map((s) => s.views || 0));
    const places = new Set(item.signals.map((s) => `${s.platform}:${s.geo}`)).size;
    return {
      ...item,
      reach: reachOf({ traffic: maxTraffic, posts: maxPosts, views: maxViews, places }),
    };
  });

  return out.sort((a, b) => b.reach - a.reach).slice(0, 30);
}

/**
 * Busca contexto noticioso (Google News RSS) para detonantes de la línea de tiempo netnográfica.
 */
export async function fetchTimelineNewsContext(topic: string, limit = 10) {
  if (!topic.trim()) return [];
  try {
    const q = encodeURIComponent(topic.trim());
    const res = await axios.get(`https://news.google.com/rss/search?q=${q}&hl=es-419&gl=MX&ceid=MX:es-419`, {
      timeout: 10_000,
    });
    const xml = String(res.data || "");
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    return items.slice(0, limit).map((block) => {
      const title = extractTag(block, "title");
      const link = extractTag(block, "link");
      const pubDate = extractTag(block, "pubDate");
      const source = extractTag(block, "source");
      return {
        title,
        url: link,
        outlet: source || "Prensa",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
      };
    });
  } catch (err: any) {
    console.warn("[Timeline News Context Error]:", err?.message);
    return [];
  }
}
