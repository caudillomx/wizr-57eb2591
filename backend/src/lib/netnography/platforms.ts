export type NetnographyPlatform = "instagram" | "tiktok" | "youtube" | "facebook" | "x";

export interface DetectedPlatformUrl {
  platform: NetnographyPlatform;
  normalizedUrl: string;
  postId: string | null;
}

/**
 * Detecta la plataforma social y extrae el postId a partir de una URL pública.
 */
export function detectPlatformFromUrl(rawUrl: string): DetectedPlatformUrl | null {
  let parsed: URL;
  try {
    const trimmed = rawUrl.trim();
    parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const path = parsed.pathname;

  if (host === "x.com" || host === "twitter.com") {
    const match = path.match(/\/status\/(\d+)/i);
    return {
      platform: "x",
      normalizedUrl: parsed.toString(),
      postId: match ? match[1] : null,
    };
  }

  if (host === "instagram.com") {
    const match = path.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/i);
    return {
      platform: "instagram",
      normalizedUrl: parsed.toString(),
      postId: match ? match[2] : null,
    };
  }

  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const match = path.match(/\/video\/(\d+)/i) || path.match(/\/t\/([A-Za-z0-9_-]+)/i);
    return {
      platform: "tiktok",
      normalizedUrl: parsed.toString(),
      postId: match ? match[1] : null,
    };
  }

  if (host === "youtube.com" || host === "youtu.be") {
    let postId: string | null = null;
    if (host === "youtu.be") {
      postId = path.replace(/^\/+/, "").split("/")[0] || null;
    } else {
      postId =
        parsed.searchParams.get("v") ||
        (path.match(/\/(shorts|live|embed)\/([A-Za-z0-9_-]+)/i)?.[2] ?? null);
    }
    return {
      platform: "youtube",
      normalizedUrl: parsed.toString(),
      postId,
    };
  }

  if (host === "facebook.com" || host === "fb.watch" || host.endsWith(".facebook.com")) {
    const match =
      path.match(/\/posts\/([^/?#]+)/i) ||
      path.match(/\/videos\/(\d+)/i) ||
      path.match(/\/reel\/(\d+)/i) ||
      path.match(/\/p\/([^/?#]+)/i);
    const postId = parsed.searchParams.get("story_fbid") || parsed.searchParams.get("v") || (match ? match[1] : null);
    return {
      platform: "facebook",
      normalizedUrl: parsed.toString(),
      postId,
    };
  }

  return null;
}

export function xSearchTerms(postId: string, nowSec = Math.floor(Date.now() / 1000)): string[] {
  const base = `conversation_id:${postId}`;
  let start: number;
  try {
    start = Math.floor((Number(BigInt(postId) >> 22n) + 1288834974657) / 1000);
  } catch {
    return [base];
  }
  if (!Number.isFinite(start) || start < 1.2e9) return [base];
  const H = 3600;
  const M = 60;
  const terms: string[] = [];
  const plan: [number, number][] = [
    [3 * H, 15 * M],
    [24 * H, H],
    [72 * H, 12 * H],
  ];
  let t = start - 15 * M;
  for (const [until, step] of plan) {
    while (t < start + until) {
      if (t > nowSec) return terms.length ? terms : [base];
      terms.push(`${base} since_time:${t} until_time:${t + step}`);
      t += step;
    }
  }
  if (t <= nowSec) terms.push(`${base} since_time:${t}`);
  return terms;
}
