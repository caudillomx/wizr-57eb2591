import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { format as formatDate } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, FileSpreadsheet, Loader2, X, Info, CheckCircle2, AlertTriangle, CalendarIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FKNetwork } from "@/hooks/useFanpageKarma";
import { cn } from "@/lib/utils";
import { canonicalizeFKProfileIdentity, normalizeFKText, prettifyFKIdentifier } from "@/lib/fkProfileUtils";

interface Props {
  clientId: string;
}

type FileKind = "kpis" | "posts" | "unknown";

interface DetectedFile {
  file: File;
  kind: FileKind;
  rowCount: number;
  asCompetitor: boolean;
  /** Auto-detected from Excel metadata, if found */
  detectedPeriodStart?: Date;
  detectedPeriodEnd?: Date;
  /** User overrides (only relevant for KPIs) */
  periodStart?: Date;
  periodEnd?: Date;
}

const NETWORK_DETECT: Record<string, FKNetwork> = {
  facebook: "facebook", fb: "facebook",
  instagram: "instagram", ig: "instagram",
  youtube: "youtube", yt: "youtube",
  twitter: "twitter", x: "twitter",
  tiktok: "tiktok",
  linkedin: "linkedin",
  threads: "threads",
};

// Header keywords (Spanish + English) for FK exports
const KPI_KEYS = [
  "fans", "seguidor", "seguidores", "followers", "subscribers",
  "ppi", "rendimiento", "performance index", "indice de rendimiento",
  "growth", "crecimiento",
  "posts per day", "publicaciones por dia",
];
const POST_KEYS = [
  "message", "mensaje", "post",
  "interactions", "interacciones",
  "alcance por publicacion", "post interaction",
  "reacciones, comentarios y compartidos",
  "numero de me gusta", "numero de comentarios",
];

function normalizeKey(s: string): string {
  return normalizeFKText(s);
}

function buildCandidateKeys(network: FKNetwork, displayName: string, profileId?: string | null): string[] {
  const candidates = [displayName, profileId || "", prettifyFKIdentifier(displayName), prettifyFKIdentifier(profileId || "")]
    .map((value) => value.trim())
    .filter(Boolean);

  const keys = new Set<string>();
  candidates.forEach((value) => {
    keys.add(`${network}::name::${normalizeKey(value)}`);
    keys.add(`${network}::canonical::${canonicalizeFKProfileIdentity(value)}`);
  });

  return Array.from(keys);
}

function detectNetwork(value: any): FKNetwork {
  const raw = normalizeKey(String(value || ""));
  for (const [k, v] of Object.entries(NETWORK_DETECT)) {
    if (raw.includes(k)) return v;
  }
  return "facebook";
}

function parseNumeric(val: any): number | null {
  if (val == null || val === "" || val === "-") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const s = String(val).replace(/[%,\s]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function readSheetWithHeaderDetection(sheet: XLSX.WorkSheet): { rows: Record<string, any>[]; kind: FileKind; headerRows: any[][] } {
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  let headerIdx = -1;
  let kind: FileKind = "unknown";

  // Scan first 15 rows looking for the header row
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i].map((c) => normalizeKey(String(c || "")));
    const hasProfileCol = row.some((c) => c === "profile" || c === "perfil" || c === "page" || c === "name" || c === "nombre");
    if (!hasProfileCol) continue;

    // Posts have a "date/fecha" column; KPIs do not (they aggregate the whole period)
    const hasDateCol = row.some((c) => c === "date" || c === "fecha" || c.includes("published") || c.includes("publicado"));
    const hasMessageCol = row.some((c) => c === "message" || c === "mensaje" || c.includes("contenido"));
    const looksPost = hasDateCol || hasMessageCol || POST_KEYS.some((k) => row.some((c) => c.includes(k)));
    const looksKpi = !looksPost && KPI_KEYS.some((k) => row.some((c) => c.includes(k)));

    if (looksPost) { headerIdx = i; kind = "posts"; break; }
    if (looksKpi) { headerIdx = i; kind = "kpis"; break; }
  }

  if (headerIdx === -1) return { rows: [], kind: "unknown", headerRows: matrix.slice(0, Math.min(matrix.length, 6)) };

  const headers = matrix[headerIdx].map((h) => String(h ?? "").trim());
  const dataRows = matrix.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c != null));
  const rows = dataRows.map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
    return obj;
  });
  return { rows, kind, headerRows: matrix.slice(0, headerIdx) };
}

/**
 * Try to detect the data period from the metadata rows above the table header.
 * FK exports usually include something like:
 *   "Period: 2026-03-01 - 2026-03-31"
 *   "Periodo: 01.03.2026 - 31.03.2026"
 *   "From 2026-03-01 to 2026-03-31"
 */
function detectPeriodFromMeta(headerRows: any[][]): { start?: Date; end?: Date } {
  const flat = headerRows
    .flat()
    .map((c) => String(c ?? "").trim())
    .filter(Boolean)
    .join(" | ");
  if (!flat) return {};

  // Spanish + English month abbreviations
  const MONTHS: Record<string, number> = {
    ene: 1, enero: 1, jan: 1, january: 1,
    feb: 2, febrero: 2, february: 2,
    mar: 3, marzo: 3, march: 3,
    abr: 4, abril: 4, apr: 4, april: 4,
    may: 5, mayo: 5,
    jun: 6, junio: 6, june: 6,
    jul: 7, julio: 7, july: 7,
    ago: 8, agosto: 8, aug: 8, august: 8,
    sep: 9, sept: 9, septiembre: 9, september: 9,
    oct: 10, octubre: 10, october: 10,
    nov: 11, noviembre: 11, november: 11,
    dic: 12, diciembre: 12, dec: 12, december: 12,
  };

  // Try numeric format first: 2026-03-01 - 2026-03-31 / 01.03.2026 - 31.03.2026
  const numericRe = /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})/g;
  const numMatches = flat.match(numericRe);
  const parseNum = (s: string): Date | null => {
    const norm = s.replace(/\./g, "-").replace(/\//g, "-");
    const parts = norm.split("-").map((x) => parseInt(x, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    let y: number, m: number, d: number;
    if (parts[0] > 31) { [y, m, d] = parts; }
    else { [d, m, y] = parts; if (y < 100) y += 2000; }
    const dt = new Date(Date.UTC(y, m - 1, d));
    return isNaN(dt.getTime()) ? null : dt;
  };
  if (numMatches && numMatches.length >= 2) {
    const d1 = parseNum(numMatches[0]);
    const d2 = parseNum(numMatches[1]);
    if (d1 && d2) return d1 <= d2 ? { start: d1, end: d2 } : { start: d2, end: d1 };
  }

  // Try worded format: "1 mar 2026 - 20 abr 2026" (ES) or "Mar 1, 2026" (EN)
  const wordedRe = /(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ\.]+)\s*(?:de\s+)?(\d{2,4})/gi;
  const dates: Date[] = [];
  let m: RegExpExecArray | null;
  while ((m = wordedRe.exec(flat)) !== null) {
    const day = parseInt(m[1], 10);
    const monKey = normalizeKey(m[2]).replace(/\./g, "");
    const mon = MONTHS[monKey] ?? MONTHS[monKey.slice(0, 3)];
    let yr = parseInt(m[3], 10);
    if (!mon || isNaN(day) || isNaN(yr)) continue;
    if (yr < 100) yr += 2000;
    const dt = new Date(Date.UTC(yr, mon - 1, day));
    if (!isNaN(dt.getTime())) dates.push(dt);
    if (dates.length >= 2) break;
  }
  if (dates.length >= 2) {
    const [a, b] = dates;
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  }
  return {};
}

function pickField(row: Record<string, any>, candidates: string[]): any {
  for (const k of Object.keys(row)) {
    const nk = normalizeKey(k);
    for (const c of candidates) {
      if (nk === c || nk.includes(c)) return row[k];
    }
  }
  return null;
}

interface KpiRow {
  profileId: string;
  displayName: string;
  network: FKNetwork;
  followers: number | null;
  engagementRate: number | null;
  postsPerDay: number | null;
  pagePerformanceIndex: number | null;
  followerGrowthPercent: number | null;
  reachPerDay: number | null;
  impressionsPerInteraction: number | null;
}

interface PostRow {
  profileId: string;
  displayName: string;
  network: FKNetwork;
  externalId: string | null;
  publishedAt: string;
  message: string | null;
  link: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
  reach: number | null;
  interactionRate: number | null;
  postType: string | null;
  raw: Record<string, any>;
}

function mapKpiRow(row: Record<string, any>): KpiRow | null {
  // FK exports: column "Profile" usually has the display name, "Profile-ID" has the real platform ID
  const profileIdRaw = String(pickField(row, ["profile-id", "profile id", "page id", "page-id"]) || "").trim();
  const displayName = String(pickField(row, ["profile", "perfil", "page name", "name", "nombre", "page"]) || "").trim();
  if (!profileIdRaw && !displayName) return null;
  const networkRaw = pickField(row, ["network", "platform", "red", "plattform"]);
  const profileId = (profileIdRaw || displayName).replace(/^@/, "");
  return {
    profileId,
    displayName: displayName || profileId,
    network: detectNetwork(networkRaw),
    followers: parseNumeric(pickField(row, ["seguidor", "fans", "followers", "subscribers"])),
    engagementRate: parseNumeric(pickField(row, ["tasa de interaccion", "engagement rate", "engagement"])),
    postsPerDay: parseNumeric(pickField(row, ["publicaciones por dia", "posts per day", "posts/day"])),
    pagePerformanceIndex: parseNumeric(pickField(row, ["indice de rendimiento", "ppi", "page performance index", "rendimiento"])),
    followerGrowthPercent: parseNumeric(pickField(row, ["crecimiento de seguidores", "growth_percentage", "growth", "crecimiento", "fan growth"])),
    reachPerDay: parseNumeric(pickField(row, ["alcance por dia", "reach per day"])),
    impressionsPerInteraction: parseNumeric(pickField(row, ["interaccion por impresion", "post_interaction", "post interaction", "impresiones por interaccion"])),
  };
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0)).toISOString();
  }
  const d = new Date(String(v));
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

function mapPostRow(row: Record<string, any>): PostRow | null {
  const dateVal = pickField(row, ["date", "fecha", "published"]);
  const publishedAt = parseDate(dateVal);
  if (!publishedAt) return null;
  // For posts, FK puts the display name in "Profile" column
  const displayName = String(pickField(row, ["profile", "perfil", "page name", "name", "nombre"]) || "").trim();
  if (!displayName) return null;
  const networkRaw = pickField(row, ["network", "platform", "red"]);
  const externalIdRaw = String(pickField(row, ["message-id", "message id", "post id", "post-id", "external id", "external-id", "id"]) || "").trim();
  return {
    profileId: displayName.replace(/^@/, ""),
    displayName,
    network: detectNetwork(networkRaw),
    externalId: externalIdRaw || null,
    publishedAt,
    message: String(pickField(row, ["message", "mensaje", "content", "contenido", "text"]) || "") || null,
    link: String(pickField(row, ["link", "url", "permalink"]) || "") || null,
    likes: parseNumeric(pickField(row, ["numero de me gusta", "likes", "me gusta", "reactions"])),
    comments: parseNumeric(pickField(row, ["numero de comentarios", "comments", "comentarios"])),
    shares: parseNumeric(pickField(row, ["compartidos", "shares", "retweets"])),
    engagement: parseNumeric(pickField(row, ["reacciones, comentarios y compartidos", "interactions", "interacciones", "engagement"])),
    reach: parseNumeric(pickField(row, ["alcance por publicacion", "reach", "alcance"])),
    interactionRate: parseNumeric(pickField(row, ["tasa de interaccion", "interaction rate"])),
    postType: String(pickField(row, ["type", "tipo", "post type"]) || "") || null,
    raw: row,
  };
}

async function detectFile(file: File): Promise<DetectedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  let kind: FileKind = "unknown";
  let rowCount = 0;
  let detectedStart: Date | undefined;
  let detectedEnd: Date | undefined;

  for (const name of wb.SheetNames) {
    const { rows, kind: k, headerRows } = readSheetWithHeaderDetection(wb.Sheets[name]);
    if (k !== "unknown") {
      kind = k;
      rowCount += rows.length;
      // Detect period from metadata for both KPIs and Posts
      if (!detectedStart) {
        const period = detectPeriodFromMeta(headerRows);
        detectedStart = period.start;
        detectedEnd = period.end;
      }
    }
  }
  return {
    file,
    kind,
    rowCount,
    asCompetitor: false,
    detectedPeriodStart: detectedStart,
    detectedPeriodEnd: detectedEnd,
    periodStart: detectedStart,
    periodEnd: detectedEnd,
  };
}

export function FKExcelImporter({ clientId }: Props) {
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [overlapInfo, setOverlapInfo] = useState<{
    overlaps: Array<{ profileName: string; network: string; existing: string; incoming: string }>;
  } | null>(null);
  const qc = useQueryClient();

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const detected = await Promise.all(arr.map(detectFile));
    const known = detected.filter((d) => d.kind !== "unknown");
    if (known.length < detected.length) {
      toast({
        title: "Algunos archivos no se reconocieron",
        description: `${detected.length - known.length} archivo(s) sin formato KPIs ni Posts.`,
        variant: "destructive",
      });
    }
    setFiles((prev) => [...prev, ...detected]);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const setCompetitor = (i: number, v: boolean) =>
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, asCompetitor: v } : f)));
  const setPeriodStart = (i: number, d?: Date) =>
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, periodStart: d } : f)));
  const setPeriodEnd = (i: number, d?: Date) =>
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, periodEnd: d } : f)));

  // KPI files require both dates before importing
  const missingPeriod = files.some(
    (f) => f.kind === "kpis" && (!f.periodStart || !f.periodEnd)
  );

  /**
   * Pre-check: detecta periodos de KPIs que se solapan con snapshots existentes
   * (sin ser idénticos). Si hay solapamiento, muestra un aviso global y deja que
   * el usuario decida reemplazar (borrar existentes solapados) o cancelar.
   * Igualdad exacta (mismo period_start+period_end) NO es solapamiento: es upsert natural.
   */
  const handleImport = async () => {
    if (missingPeriod) {
      toast({
        title: "Falta el período en uno o más archivos de KPIs",
        description: "Selecciona la fecha de inicio y fin del período al que corresponden los datos.",
        variant: "destructive",
      });
      return;
    }

    const kpiFiles = files.filter((f) => f.kind === "kpis" && f.periodStart && f.periodEnd);
    if (kpiFiles.length === 0) {
      return runImport(false);
    }

    const incoming: Array<{ network: FKNetwork; displayName: string; profileId: string; periodStart: string; periodEnd: string }> = [];
    for (const f of kpiFiles) {
      const buf = await f.file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ps = formatDate(f.periodStart!, "yyyy-MM-dd");
      const pe = formatDate(f.periodEnd!, "yyyy-MM-dd");
      for (const sheetName of wb.SheetNames) {
        const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
        if (kind !== "kpis") continue;
        for (const r of rows) {
          const m = mapKpiRow(r);
          if (m) incoming.push({ network: m.network, displayName: m.displayName, profileId: m.profileId, periodStart: ps, periodEnd: pe });
        }
      }
    }

    if (incoming.length === 0) return runImport(false);

    const { data: existingProfiles } = await supabase
      .from("fk_profiles")
      .select("id, network, profile_id, display_name")
      .eq("client_id", clientId);

    const profileMap = new Map<string, { id: string; displayName: string; network: string }>();
    (existingProfiles || []).forEach((e: any) => {
      buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id).forEach((key) => {
        profileMap.set(key, { id: e.id, displayName: e.display_name || e.profile_id, network: e.network });
      });
    });

    const existingIds = Array.from(new Set(Array.from(profileMap.values()).map((p) => p.id)));
    let existingKpis: Array<{ fk_profile_id: string; period_start: string; period_end: string }> = [];
    if (existingIds.length > 0) {
      const { data } = await supabase
        .from("fk_profile_kpis")
        .select("fk_profile_id, period_start, period_end")
        .in("fk_profile_id", existingIds);
      existingKpis = data || [];
    }

    const overlaps: Array<{ profileName: string; network: string; existing: string; incoming: string }> = [];
    const seen = new Set<string>();
    for (const inc of incoming) {
      const candidates = buildCandidateKeys(inc.network, inc.displayName, inc.profileId);
      const matched = candidates.map((k) => profileMap.get(k)).find(Boolean);
      if (!matched) continue;
      for (const ek of existingKpis) {
        if (ek.fk_profile_id !== matched.id) continue;
        const sameRange = ek.period_start === inc.periodStart && ek.period_end === inc.periodEnd;
        if (sameRange) continue;
        const intersects = ek.period_start <= inc.periodEnd && ek.period_end >= inc.periodStart;
        if (intersects) {
          const key = `${matched.id}|${ek.period_start}|${ek.period_end}|${inc.periodStart}|${inc.periodEnd}`;
          if (!seen.has(key)) {
            seen.add(key);
            overlaps.push({
              profileName: matched.displayName,
              network: matched.network,
              existing: `${ek.period_start} → ${ek.period_end}`,
              incoming: `${inc.periodStart} → ${inc.periodEnd}`,
            });
          }
        }
      }
    }

    if (overlaps.length === 0) {
      return runImport(false);
    }

    setOverlapInfo({ overlaps });
  };

  const runImport = async (replaceOverlaps: boolean) => {
    setOverlapInfo(null);
    setImporting(true);
    let totalProfiles = 0;
    let totalKpis = 0;
    let totalPosts = 0;
    let deletedOverlaps = 0;

    try {
      for (const f of files) {
        if (f.kind === "unknown") continue;
        const buf = await f.file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true });

        if (f.kind === "kpis") {
          const kpiRows: KpiRow[] = [];
          for (const sheetName of wb.SheetNames) {
            const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
            if (kind !== "kpis") continue;
            for (const r of rows) {
              const m = mapKpiRow(r);
              if (m) kpiRows.push(m);
            }
          }
          if (kpiRows.length === 0) continue;

          // Resolve profiles by (client_id, network, normalized display_name)
          // so that re-imports with different profile_id formats (handle vs numeric ID)
          // map to the same canonical profile. Different brands within the same network
          // (e.g. Banorte + Actinver in Facebook) remain distinct via display_name.
          const { data: existing } = await supabase
            .from("fk_profiles")
            .select("id, network, profile_id, display_name")
            .eq("client_id", clientId);
          const existingByName = new Map<string, string>();
          (existing || []).forEach((e: any) => {
            buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id).forEach((key) => {
              existingByName.set(key, e.id);
            });
          });

          const profilePayload = kpiRows.map((k) => ({
            client_id: clientId,
            network: k.network,
            profile_id: k.profileId,
            display_name: k.displayName,
            is_active: true,
            is_competitor: f.asCompetitor,
            _key: `${k.network}::canonical::${canonicalizeFKProfileIdentity(k.displayName || k.profileId)}`,
          }));

          const toInsert = profilePayload
            .filter((p) => !existingByName.has(p._key))
            // dedupe within batch
            .filter((p, idx, arr) => arr.findIndex((x) => x._key === p._key) === idx)
            .map(({ _key, ...rest }) => rest);

          if (toInsert.length > 0) {
            const { data: inserted, error } = await supabase
              .from("fk_profiles")
              .insert(toInsert)
              .select("id, network, profile_id, display_name");
            if (error) throw error;
            (inserted || []).forEach((row: any) => {
              buildCandidateKeys(row.network, row.display_name || row.profile_id, row.profile_id).forEach((key) => {
                existingByName.set(key, row.id);
              });
            });
          }

          if (f.asCompetitor) {
            const ids = kpiRows
              .map((k) => existingByName.get(`${k.network}::${normalizeKey(k.displayName || k.profileId)}`))
              .map((id, idx) => id || buildCandidateKeys(kpiRows[idx].network, kpiRows[idx].displayName || kpiRows[idx].profileId, kpiRows[idx].profileId).map((key) => existingByName.get(key)).find(Boolean))
              .filter(Boolean) as string[];
            if (ids.length > 0) {
              await supabase.from("fk_profiles").update({ is_competitor: true }).in("id", ids);
            }
          }
          totalProfiles += toInsert.length;

          const periodStart = formatDate(f.periodStart!, "yyyy-MM-dd");
          const periodEnd = formatDate(f.periodEnd!, "yyyy-MM-dd");

          const kpiPayload = kpiRows
            .map((k) => {
              const id = buildCandidateKeys(k.network, k.displayName || k.profileId, k.profileId)
                .map((key) => existingByName.get(key))
                .find(Boolean);
              if (!id) return null;
              return {
                fk_profile_id: id,
                period_start: periodStart,
                period_end: periodEnd,
                followers: k.followers != null ? Math.round(k.followers) : null,
                engagement_rate: k.engagementRate,
                posts_per_day: k.postsPerDay,
                page_performance_index: k.pagePerformanceIndex,
                follower_growth_percent: k.followerGrowthPercent,
                reach_per_day: k.reachPerDay != null ? Math.round(k.reachPerDay) : null,
                impressions_per_interaction: k.impressionsPerInteraction,
              };
            })
            .filter(Boolean) as any[];

          if (kpiPayload.length > 0) {
            // Si el usuario eligió reemplazar solapamientos, borramos los snapshots
            // que intersectan con el rango entrante (sin ser idénticos — el mismo
            // rango ya se maneja como upsert natural).
            if (replaceOverlaps) {
              const profileIds = Array.from(new Set(kpiPayload.map((p) => p.fk_profile_id)));
              const { data: existingForDelete } = await supabase
                .from("fk_profile_kpis")
                .select("id, fk_profile_id, period_start, period_end")
                .in("fk_profile_id", profileIds);
              const idsToDelete = (existingForDelete || [])
                .filter((ek: any) => {
                  const sameRange = ek.period_start === periodStart && ek.period_end === periodEnd;
                  if (sameRange) return false;
                  return ek.period_start <= periodEnd && ek.period_end >= periodStart;
                })
                .map((ek: any) => ek.id);
              if (idsToDelete.length > 0) {
                const { error: delErr } = await supabase
                  .from("fk_profile_kpis")
                  .delete()
                  .in("id", idsToDelete);
                if (delErr) console.error("Overlap delete", delErr);
                else deletedOverlaps += idsToDelete.length;
              }
            }

            // Idempotent: re-importing same period updates the row
            const { error } = await supabase
              .from("fk_profile_kpis")
              .upsert(kpiPayload, { onConflict: "fk_profile_id,period_start,period_end", ignoreDuplicates: false });
            if (error) console.error("KPI upsert", error);
            else totalKpis += kpiPayload.length;
          }
        } else if (f.kind === "posts") {
          const postRows: PostRow[] = [];
          for (const sheetName of wb.SheetNames) {
            const { rows, kind } = readSheetWithHeaderDetection(wb.Sheets[sheetName]);
            if (kind !== "posts") continue;
            for (const r of rows) {
              const m = mapPostRow(r);
              if (m) postRows.push(m);
            }
          }
          if (postRows.length === 0) continue;

          // Load existing profiles by both profile_id AND display_name (posts don't carry Profile-ID)
          const { data: existing } = await supabase
            .from("fk_profiles")
            .select("id, network, profile_id, display_name")
            .eq("client_id", clientId);
          const byId = new Map<string, string>();
          const byName = new Map<string, string>();
          const byCanonical = new Map<string, string>();
          (existing || []).forEach((e: any) => {
            byId.set(`${e.network}::${e.profile_id}`, e.id);
            buildCandidateKeys(e.network, e.display_name || e.profile_id, e.profile_id).forEach((key) => {
              if (key.includes("::name::")) byName.set(key, e.id);
              if (key.includes("::canonical::")) byCanonical.set(key, e.id);
            });
          });

          const resolveProfileId = (network: FKNetwork, displayName: string): string | undefined => {
            return buildCandidateKeys(network, displayName, displayName)
              .map((key) => {
                if (key.includes("::name::")) return byName.get(key);
                if (key.includes("::canonical::")) return byCanonical.get(key);
                return undefined;
              })
              .find(Boolean)
              ?? byId.get(`${network}::${displayName.replace(/^@/, "")}`);
          };

          // Create profiles for posts whose profile doesn't exist yet (rare: posts before KPIs)
          const uniqueNew = new Map<string, { network: FKNetwork; displayName: string }>();
          for (const p of postRows) {
            if (resolveProfileId(p.network, p.displayName)) continue;
            const k = `${p.network}::canonical::${canonicalizeFKProfileIdentity(p.displayName)}`;
            if (!uniqueNew.has(k)) uniqueNew.set(k, { network: p.network, displayName: p.displayName });
          }
          if (uniqueNew.size > 0) {
            const toInsert = Array.from(uniqueNew.values()).map((p) => ({
              client_id: clientId,
              network: p.network,
              profile_id: p.displayName.replace(/^@/, ""),
              display_name: p.displayName,
              is_active: true,
              is_competitor: f.asCompetitor,
            }));
            const { data: inserted, error } = await supabase
              .from("fk_profiles")
              .insert(toInsert)
              .select("id, network, profile_id, display_name");
            if (error) throw error;
            (inserted || []).forEach((row: any) => {
              byId.set(`${row.network}::${row.profile_id}`, row.id);
              buildCandidateKeys(row.network, row.display_name || row.profile_id, row.profile_id).forEach((key) => {
                if (key.includes("::name::")) byName.set(key, row.id);
                if (key.includes("::canonical::")) byCanonical.set(key, row.id);
              });
            });
            totalProfiles += toInsert.length;
          }

          // Build payload + dedupe within batch by (fk_profile_id, external_id)
          const seen = new Set<string>();
          const postsPayload: any[] = [];
          for (const p of postRows) {
            const id = resolveProfileId(p.network, p.displayName);
            if (!id) continue;
            // Synthesize a stable external_id when missing to avoid null collisions
            const extId = p.externalId
              || p.link
              || `${p.publishedAt}::${(p.message || "").slice(0, 80)}`;
            const dedupKey = `${id}::${extId}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);
            postsPayload.push({
              fk_profile_id: id,
              network: p.network,
              external_id: extId,
              published_at: p.publishedAt,
              message: p.message,
              link: p.link,
              likes: p.likes != null ? Math.round(p.likes) : 0,
              comments: p.comments != null ? Math.round(p.comments) : 0,
              shares: p.shares != null ? Math.round(p.shares) : 0,
              engagement: p.engagement != null ? Math.round(p.engagement) : 0,
              reach: p.reach != null ? Math.round(p.reach) : 0,
              interaction_rate: p.interactionRate,
              post_type: p.postType,
              raw_data: p.raw,
            });
          }

          const CHUNK = 500;
          for (let i = 0; i < postsPayload.length; i += CHUNK) {
            const slice = postsPayload.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("fk_posts")
              .upsert(slice, { onConflict: "fk_profile_id,external_id", ignoreDuplicates: false });
            if (error) {
              console.error("upsert posts error", error);
              throw error;
            }
            totalPosts += slice.length;
          }

          // Derive top post per profile per day for the legacy fk_daily_top_posts panel
          const topByDay = new Map<string, any>();
          for (const p of postsPayload) {
            const day = (p.published_at || "").slice(0, 10);
            if (!day) continue;
            const k = `${p.fk_profile_id}::${day}`;
            const cur = topByDay.get(k);
            if (!cur || (p.engagement || 0) > (cur.engagement || 0)) {
              topByDay.set(k, {
                fk_profile_id: p.fk_profile_id,
                network: p.network,
                post_date: day,
                post_url: p.link,
                post_content: p.message,
                likes: p.likes,
                comments: p.comments,
                shares: p.shares,
                engagement: p.engagement,
                raw_data: { external_id: p.external_id, reach: p.reach },
              });
            }
          }
          const topArr = Array.from(topByDay.values());
          for (let i = 0; i < topArr.length; i += CHUNK) {
            await supabase.from("fk_daily_top_posts").insert(topArr.slice(i, i + CHUNK));
          }
        }
      }

      toast({
        title: "Importación completada",
        description: `${totalProfiles} perfiles nuevos · ${totalKpis} KPIs · ${totalPosts} posts${
          deletedOverlaps > 0 ? ` · ${deletedOverlaps} snapshots solapados reemplazados` : ""
        }.`,
      });
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["fk-profiles-client"] });
      qc.invalidateQueries({ queryKey: ["fk-kpis"] });
      qc.invalidateQueries({ queryKey: ["fk-all-kpis"] });
      qc.invalidateQueries({ queryKey: ["fk-daily-top-posts"] });
      qc.invalidateQueries({ queryKey: ["fk-posts"] });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error al importar", description: err.message || String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar Excel de Performance
        </CardTitle>
        <CardDescription>
          Sube los exports de KPIs y Posts. El importador detecta tipo de archivo y, cuando es posible, también el período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fk-excel-input")?.click()}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium text-sm">Arrastra varios archivos o haz clic para seleccionar</p>
          <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv — puedes mezclar KPIs y Posts</p>
        </div>
        <input
          id="fk-excel-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ""; }}
        />

        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f, i) => {
              const periodAuto = f.kind === "kpis" && f.detectedPeriodStart && f.detectedPeriodEnd;
              const periodMissing = f.kind === "kpis" && (!f.periodStart || !f.periodEnd);
              return (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.file.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {f.kind === "kpis" && <Badge variant="default">KPIs · {f.rowCount} perfiles</Badge>}
                        {f.kind === "posts" && <Badge variant="secondary">Posts · {f.rowCount} filas</Badge>}
                        {f.kind === "unknown" && <Badge variant="destructive">No reconocido</Badge>}
                        {periodAuto && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <CheckCircle2 className="h-3 w-3 text-primary" />
                            Período detectado
                          </Badge>
                        )}
                        {periodMissing && !periodAuto && (
                          <Badge variant="outline" className="text-xs gap-1 text-destructive border-destructive/40">
                            <AlertTriangle className="h-3 w-3" />
                            Selecciona el período
                          </Badge>
                        )}
                      </div>
                    </div>
                    {f.kind !== "unknown" && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`comp-${i}`} className="text-xs">Competencia</Label>
                        <Switch id={`comp-${i}`} checked={f.asCompetitor} onCheckedChange={(v) => setCompetitor(i, v)} />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removeFile(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {f.kind === "kpis" && (
                    <div className="flex items-center gap-2 pl-8">
                      <Label className="text-xs text-muted-foreground shrink-0">Período de los datos:</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 text-xs justify-start font-normal", !f.periodStart && "text-muted-foreground")}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {f.periodStart ? formatDate(f.periodStart, "dd MMM yyyy", { locale: es }) : "Inicio"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={f.periodStart}
                            onSelect={(d) => setPeriodStart(i, d)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-xs text-muted-foreground">→</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 text-xs justify-start font-normal", !f.periodEnd && "text-muted-foreground")}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {f.periodEnd ? formatDate(f.periodEnd, "dd MMM yyyy", { locale: es }) : "Fin"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={f.periodEnd}
                            onSelect={(d) => setPeriodEnd(i, d)}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFiles([])}>Limpiar</Button>
              <Button
                onClick={handleImport}
                disabled={importing || files.every((f) => f.kind === "unknown") || missingPeriod}
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Importar {files.filter((f) => f.kind !== "unknown").length} archivo(s)
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Los archivos de <strong>KPIs</strong> requieren un período (inicio y fin). Si el Excel lo trae en sus metadatos, se detecta automáticamente; si no, lo seleccionas manualmente. Re-importar el mismo período para un perfil <strong>actualiza</strong> sus métricas en lugar de duplicarlas. Los archivos de <strong>Posts</strong> usan la fecha real de cada publicación.
          </span>
        </div>
      </CardContent>

      <AlertDialog open={!!overlapInfo} onOpenChange={(open) => !open && setOverlapInfo(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Periodos solapados detectados
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {overlapInfo?.overlaps.length} snapshot(s) existentes se solapan con los periodos que estás subiendo (sin ser idénticos).
                  Esto suele pasar cuando combinas exportes de rangos distintos (p.ej. semanal vs. mensual) que terminan el mismo día.
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/40 p-2 text-xs font-mono space-y-1">
                  {overlapInfo?.overlaps.slice(0, 20).map((o, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <strong>{o.profileName}</strong> · {o.network}
                      </span>
                      <span className="text-muted-foreground whitespace-nowrap">
                        {o.existing} <span className="text-amber-600">↔</span> {o.incoming}
                      </span>
                    </div>
                  ))}
                  {overlapInfo && overlapInfo.overlaps.length > 20 && (
                    <div className="text-muted-foreground">… y {overlapInfo.overlaps.length - 20} más</div>
                  )}
                </div>
                <p className="text-sm">
                  <strong>Reemplazar</strong> borra los snapshots solapados existentes y mantiene los nuevos (recomendado para evitar series duplicadas).
                  <br />
                  <strong>Conservar ambos</strong> importa sin borrar: quedarán varios snapshots terminando el mismo día.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => runImport(false)}>
              Conservar ambos
            </Button>
            <AlertDialogAction onClick={() => runImport(true)}>
              Reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
