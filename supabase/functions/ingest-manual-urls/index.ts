// Ingestión manual de URLs: el usuario pega URLs de FB/IG/TikTok/X y las scrapea
// con Apify para crear/upsert mentions con metadata real (incluye published_at).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APIFY_TOKEN = Deno.env.get("APIFY_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Platform = "facebook" | "instagram" | "tiktok" | "twitter";

const ACTOR_MAP: Record<Platform, string> = {
  facebook: "apify~facebook-posts-scraper",
  instagram: "apify~instagram-post-scraper",
  tiktok: "clockworks~tiktok-scraper",
  twitter: "apidojo~tweet-scraper",
};

const DOMAIN_TO_SOURCE: Record<Platform, string> = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  twitter: "x.com",
};

function detectPlatform(url: string): Platform | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (h.includes("facebook.com") || h.includes("fb.com") || h.includes("fb.watch")) return "facebook";
    if (h.includes("instagram.com")) return "instagram";
    if (h.includes("tiktok.com")) return "tiktok";
    if (h.includes("twitter.com") || h.includes("x.com")) return "twitter";
  } catch {}
  return null;
}

function buildInput(platform: Platform, urls: string[]) {
  switch (platform) {
    case "facebook":
      return { startUrls: urls.map((url) => ({ url })), resultsLimit: urls.length };
    case "instagram":
      return { directUrls: urls, resultsLimit: urls.length, addParentData: false };
    case "tiktok":
      return { postURLs: urls, resultsPerPage: urls.length, shouldDownloadVideos: false };
    case "twitter":
      return { startUrls: urls, maxItems: urls.length };
  }
}

function extractDate(platform: Platform, it: any): string | null {
  const list: any[] = (() => {
    switch (platform) {
      case "facebook": return [it.time, it.timestamp, it.publishedTime, it.date];
      case "instagram": return [it.timestamp, it.takenAtTimestamp, it.takenAt];
      case "tiktok": return [it.createTimeISO, it.createTime];
      case "twitter": return [it.createdAt, it.created_at, it.timestamp];
    }
  })();
  for (const c of list) {
    if (c == null) continue;
    if (typeof c === "number") {
      const ms = c > 1e12 ? c : c * 1000;
      return new Date(ms).toISOString();
    }
    if (typeof c === "string") {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function extractText(platform: Platform, it: any): { title: string | null; description: string | null } {
  let txt: string | null = null;
  switch (platform) {
    case "facebook": txt = it.text || it.message || it.caption || it.postText || null; break;
    case "instagram": txt = it.caption || it.text || null; break;
    case "tiktok": txt = it.text || it.desc || null; break;
    case "twitter": txt = it.text || it.fullText || null; break;
  }
  if (!txt) return { title: null, description: null };
  const clean = String(txt).trim();
  return {
    title: clean.slice(0, 140),
    description: clean,
  };
}

function extractEngagement(platform: Platform, it: any): { likes: number; comments: number; shares: number; views: number } {
  return {
    likes: Number(it.likes || it.likesCount || it.diggCount || it.favoriteCount || it.likeCount || 0) || 0,
    comments: Number(it.comments || it.commentsCount || it.commentCount || it.replyCount || 0) || 0,
    shares: Number(it.shares || it.sharesCount || it.shareCount || it.retweetCount || 0) || 0,
    views: Number(it.views || it.viewsCount || it.playCount || it.videoViewCount || 0) || 0,
  };
}

function extractAuthor(platform: Platform, it: any) {
  switch (platform) {
    case "facebook": return { name: it.user?.name || it.author || it.pageName || null, url: it.user?.profileUrl || it.pageUrl || null };
    case "instagram": return { name: it.ownerFullName || it.ownerUsername || null, url: it.ownerUsername ? `https://instagram.com/${it.ownerUsername}` : null };
    case "tiktok": return { name: it.authorMeta?.nickName || it.authorMeta?.name || null, url: it.authorMeta?.name ? `https://tiktok.com/@${it.authorMeta.name}` : null };
    case "twitter": return { name: it.author?.name || it.user?.name || null, url: it.author?.url || (it.author?.userName ? `https://x.com/${it.author.userName}` : null) };
  }
  return { name: null, url: null };
}

function itemUrl(it: any): string | null {
  return it.url || it.postUrl || it.webVideoUrl || it.permalink || it.postLink || it.link || it.shareUrl || null;
}

async function runApify(actorId: string, input: any): Promise<any[]> {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=120`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Apify ${actorId} ${resp.status}: ${t.slice(0, 300)}`);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { project_id, urls } = await req.json();
    if (!project_id || !Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({ error: "project_id and urls[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Pre-load entity keywords so we can stuff matched_keywords and bypass relevance trigger.
    const { data: ents } = await supabase
      .from("entities")
      .select("nombre, aliases, palabras_clave, platform_keywords")
      .eq("project_id", project_id)
      .eq("activo", true);

    const allKeywords = new Set<string>();
    for (const e of ents || []) {
      if (e.nombre) allKeywords.add(e.nombre);
      (e.aliases || []).forEach((a: string) => allKeywords.add(a));
      (e.palabras_clave || []).forEach((k: string) => allKeywords.add(k));
      const pk = (e.platform_keywords as any) || {};
      for (const arr of Object.values(pk)) {
        if (Array.isArray(arr)) arr.forEach((s) => typeof s === "string" && allKeywords.add(s));
      }
    }
    const matchedKeywords = Array.from(allKeywords).slice(0, 50);

    // Group URLs by platform
    const grouped: Record<Platform, string[]> = { facebook: [], instagram: [], tiktok: [], twitter: [] };
    const skipped: Array<{ url: string; reason: string }> = [];
    for (const raw of urls) {
      const u = String(raw).trim();
      if (!u) continue;
      const p = detectPlatform(u);
      if (!p) { skipped.push({ url: u, reason: "plataforma no detectada" }); continue; }
      grouped[p].push(u);
    }

    const results: Array<{ url: string; status: "inserted" | "updated" | "skipped" | "failed"; reason?: string; mention_id?: string }> = [];

    for (const platform of Object.keys(grouped) as Platform[]) {
      const batch = grouped[platform];
      if (batch.length === 0) continue;

      let items: any[] = [];
      try {
        items = await runApify(ACTOR_MAP[platform], buildInput(platform, batch));
      } catch (e: any) {
        for (const u of batch) results.push({ url: u, status: "failed", reason: `apify: ${e?.message || e}` });
        continue;
      }

      // Map items by their canonical URL + try fuzzy match
      const byUrl = new Map<string, any>();
      for (const it of items) {
        const u = itemUrl(it);
        if (u) byUrl.set(u, it);
      }

      for (const requestedUrl of batch) {
        let item = byUrl.get(requestedUrl);
        if (!item) {
          // try fuzzy: any item url shares an id segment
          for (const [k, v] of byUrl.entries()) {
            const a = requestedUrl.replace(/\/+$/, "").split("?")[0];
            const b = k.replace(/\/+$/, "").split("?")[0];
            if (a === b || a.endsWith(b) || b.endsWith(a)) { item = v; break; }
          }
        }
        if (!item && items.length === 1 && batch.length === 1) item = items[0];

        if (!item) {
          results.push({ url: requestedUrl, status: "failed", reason: "Apify no devolvió contenido (post privado/borrado o URL no soportada)" });
          continue;
        }

        const publishedAt = extractDate(platform, item);
        const { title, description } = extractText(platform, item);
        const author = extractAuthor(platform, item);
        const eng = extractEngagement(platform, item);
        const canonicalUrl = itemUrl(item) || requestedUrl;

        const raw_metadata = {
          ingestion_source: "manual_url_ingest",
          ingested_at: new Date().toISOString(),
          platform,
          author_name: author.name,
          author_url: author.url,
          engagement: eng,
          date_source: publishedAt ? "apify_manual" : "unavailable",
          date_confidence: publishedAt ? "high" : "unavailable",
          original_url: requestedUrl !== canonicalUrl ? requestedUrl : undefined,
          raw_item: item,
        };

        // Upsert by (project_id, url) — match patrón Mentions Persistence v2
        const { data: existing } = await supabase
          .from("mentions")
          .select("id")
          .eq("project_id", project_id)
          .eq("url", canonicalUrl)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase
            .from("mentions")
            .update({
              title: title || undefined,
              description: description || undefined,
              published_at: publishedAt || undefined,
              source_domain: DOMAIN_TO_SOURCE[platform],
              raw_metadata,
              is_archived: false,
            })
            .eq("id", existing.id);
          if (updErr) { results.push({ url: requestedUrl, status: "failed", reason: updErr.message }); continue; }
          results.push({ url: requestedUrl, status: "updated", mention_id: existing.id });
        } else {
          const { data: ins, error: insErr } = await supabase
            .from("mentions")
            .insert({
              project_id,
              url: canonicalUrl,
              title: title || `Post de ${platform}`,
              description: description || "",
              source_domain: DOMAIN_TO_SOURCE[platform],
              published_at: publishedAt,
              matched_keywords: matchedKeywords,
              raw_metadata,
              relevance_score: 1.0,
            })
            .select("id")
            .maybeSingle();
          if (insErr) { results.push({ url: requestedUrl, status: "failed", reason: insErr.message }); continue; }
          if (!ins) { results.push({ url: requestedUrl, status: "skipped", reason: "rechazado por filtro de relevancia" }); continue; }
          results.push({ url: requestedUrl, status: "inserted", mention_id: ins.id });
        }
      }
    }

    for (const s of skipped) results.push({ url: s.url, status: "skipped", reason: s.reason });

    const summary = {
      inserted: results.filter((r) => r.status === "inserted").length,
      updated: results.filter((r) => r.status === "updated").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
    };

    return new Response(JSON.stringify({ ok: true, summary, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ingest-manual-urls error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
