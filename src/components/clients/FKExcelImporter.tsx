import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, Loader2, X, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";

interface Props {
  clientId: string;
}

type FileKind = "kpis" | "posts" | "unknown";

interface DetectedFile {
  file: File;
  kind: FileKind;
  rowCount: number;
  asCompetitor: boolean;
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

const KPI_KEYS = ["fans", "seguidores", "followers", "ppi", "rendimiento", "performance index", "growth", "crecimiento"];
const POST_KEYS = ["message", "mensaje", "post", "interactions", "interacciones", "alcance por publicación", "post interaction"];

function normalizeKey(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

// FK Excel exports have metadata in first ~4 rows; real headers can start lower.
// Find the header row by scanning for known column tokens.
function readSheetWithHeaderDetection(sheet: XLSX.WorkSheet): { rows: Record<string, any>[]; kind: FileKind } {
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
  let headerIdx = -1;
  let kind: FileKind = "unknown";

  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i].map((c) => normalizeKey(String(c || "")));
    const joined = row.join("|");
    const looksKpi = KPI_KEYS.some((k) => joined.includes(k)) && row.some((c) => c === "profile" || c === "perfil" || c === "page" || c === "name" || c === "nombre");
    const looksPost = POST_KEYS.some((k) => joined.includes(k)) && (joined.includes("date") || joined.includes("fecha"));
    if (looksKpi) { headerIdx = i; kind = "kpis"; break; }
    if (looksPost) { headerIdx = i; kind = "posts"; break; }
  }

  if (headerIdx === -1) return { rows: [], kind: "unknown" };

  const headers = matrix[headerIdx].map((h) => String(h ?? "").trim());
  const dataRows = matrix.slice(headerIdx + 1).filter((r) => r.some((c) => c !== "" && c != null));

  const rows = dataRows.map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
    return obj;
  });

  return { rows, kind };
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
  const profileId = String(pickField(row, ["profile", "perfil", "page id", "page"]) || "").trim();
  const displayName = String(pickField(row, ["page name", "name", "nombre", "page"]) || profileId).trim();
  if (!profileId && !displayName) return null;
  const networkRaw = pickField(row, ["network", "platform", "red", "plattform"]);
  return {
    profileId: (profileId || displayName).replace(/^@/, ""),
    displayName: displayName || profileId,
    network: detectNetwork(networkRaw),
    followers: parseNumeric(pickField(row, ["fans", "followers", "seguidores", "subscribers"])),
    engagementRate: parseNumeric(pickField(row, ["engagement rate", "engagement", "interaccion"])),
    postsPerDay: parseNumeric(pickField(row, ["posts per day", "posts/day", "publicaciones por dia"])),
    pagePerformanceIndex: parseNumeric(pickField(row, ["ppi", "page performance index", "rendimiento"])),
    followerGrowthPercent: parseNumeric(pickField(row, ["growth_percentage", "growth", "crecimiento", "fan growth"])),
    reachPerDay: parseNumeric(pickField(row, ["alcance por dia", "reach per day"])),
    impressionsPerInteraction: parseNumeric(pickField(row, ["post_interaction", "post interaction", "impresiones por interaccion"])),
  };
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  // Excel serial number
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
  const profileId = String(pickField(row, ["profile", "perfil", "page"]) || "").trim();
  const displayName = String(pickField(row, ["page name", "name", "nombre"]) || profileId).trim();
  if (!profileId && !displayName) return null;
  const networkRaw = pickField(row, ["network", "platform", "red"]);
  return {
    profileId: (profileId || displayName).replace(/^@/, ""),
    displayName: displayName || profileId,
    network: detectNetwork(networkRaw),
    externalId: String(pickField(row, ["message id", "post id", "external id", "id"]) || "") || null,
    publishedAt,
    message: String(pickField(row, ["message", "mensaje", "content", "contenido", "text"]) || "") || null,
    link: String(pickField(row, ["link", "url", "permalink"]) || "") || null,
    likes: parseNumeric(pickField(row, ["likes", "me gusta", "reactions"])),
    comments: parseNumeric(pickField(row, ["comments", "comentarios"])),
    shares: parseNumeric(pickField(row, ["shares", "compartidos", "retweets"])),
    engagement: parseNumeric(pickField(row, ["interactions", "interacciones", "engagement"])),
    reach: parseNumeric(pickField(row, ["alcance por publicacion", "reach", "alcance"])),
    interactionRate: parseNumeric(pickField(row, ["interaction rate", "tasa de interaccion"])),
    postType: String(pickField(row, ["type", "tipo", "post type"]) || "") || null,
    raw: row,
  };
}

async function detectFile(file: File): Promise<DetectedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  let kind: FileKind = "unknown";
  let rowCount = 0;
  for (const name of wb.SheetNames) {
    const { rows, kind: k } = readSheetWithHeaderDetection(wb.Sheets[name]);
    if (k !== "unknown") {
      kind = k;
      rowCount += rows.length;
    }
  }
  return { file, kind, rowCount, asCompetitor: false };
}

export function FKExcelImporter({ clientId }: Props) {
  const [files, setFiles] = useState<DetectedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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

  const handleImport = async () => {
    setImporting(true);
    let totalProfiles = 0;
    let totalKpis = 0;
    let totalPosts = 0;

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

          // Upsert profiles
          const profilePayload = kpiRows.map((k) => ({
            client_id: clientId,
            network: k.network,
            profile_id: k.profileId,
            display_name: k.displayName,
            is_active: true,
            is_competitor: f.asCompetitor,
          }));

          // Insert/upsert one by one to handle existing rows w/o unique constraint by client+network+profile
          // We use a simple approach: select existing then insert missing
          const { data: existing } = await supabase
            .from("fk_profiles")
            .select("id, network, profile_id")
            .eq("client_id", clientId);

          const existingMap = new Map(
            (existing || []).map((e: any) => [`${e.network}::${e.profile_id}`, e.id])
          );

          const toInsert = profilePayload.filter(
            (p) => !existingMap.has(`${p.network}::${p.profile_id}`)
          );

          if (toInsert.length > 0) {
            const { data: inserted, error } = await supabase
              .from("fk_profiles")
              .insert(toInsert)
              .select("id, network, profile_id");
            if (error) throw error;
            (inserted || []).forEach((row: any) =>
              existingMap.set(`${row.network}::${row.profile_id}`, row.id)
            );
          }

          // Update is_competitor flag for existing rows in this batch
          if (f.asCompetitor) {
            const ids = kpiRows
              .map((k) => existingMap.get(`${k.network}::${k.profileId}`))
              .filter(Boolean) as string[];
            if (ids.length > 0) {
              await supabase
                .from("fk_profiles")
                .update({ is_competitor: true })
                .in("id", ids);
            }
          }

          totalProfiles += toInsert.length;

          // Insert KPIs (one row per profile, today's snapshot)
          const today = new Date().toISOString().slice(0, 10);
          const kpiPayload = kpiRows
            .map((k) => {
              const id = existingMap.get(`${k.network}::${k.profileId}`);
              if (!id) return null;
              return {
                fk_profile_id: id,
                period_start: today,
                period_end: today,
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
            const { error } = await supabase.from("fk_profile_kpis").insert(kpiPayload);
            if (error) console.error("KPI insert", error);
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

          // Resolve profile ids (create missing as competitors if asCompetitor=true, else as brand)
          const { data: existing } = await supabase
            .from("fk_profiles")
            .select("id, network, profile_id")
            .eq("client_id", clientId);
          const existingMap = new Map(
            (existing || []).map((e: any) => [`${e.network}::${e.profile_id}`, e.id])
          );

          const uniqueProfiles = new Map<string, { network: FKNetwork; profileId: string; displayName: string }>();
          for (const p of postRows) {
            const k = `${p.network}::${p.profileId}`;
            if (!uniqueProfiles.has(k)) {
              uniqueProfiles.set(k, { network: p.network, profileId: p.profileId, displayName: p.displayName });
            }
          }

          const missing = Array.from(uniqueProfiles.values()).filter(
            (p) => !existingMap.has(`${p.network}::${p.profileId}`)
          );
          if (missing.length > 0) {
            const { data: inserted, error } = await supabase
              .from("fk_profiles")
              .insert(missing.map((p) => ({
                client_id: clientId,
                network: p.network,
                profile_id: p.profileId,
                display_name: p.displayName,
                is_active: true,
                is_competitor: f.asCompetitor,
              })))
              .select("id, network, profile_id");
            if (error) throw error;
            (inserted || []).forEach((row: any) =>
              existingMap.set(`${row.network}::${row.profile_id}`, row.id)
            );
            totalProfiles += missing.length;
          }

          // Build posts payload, chunked
          const postsPayload = postRows
            .map((p) => {
              const id = existingMap.get(`${p.network}::${p.profileId}`);
              if (!id) return null;
              return {
                fk_profile_id: id,
                network: p.network,
                external_id: p.externalId,
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
              };
            })
            .filter(Boolean) as any[];

          // Upsert in chunks of 500
          const CHUNK = 500;
          for (let i = 0; i < postsPayload.length; i += CHUNK) {
            const slice = postsPayload.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("fk_posts")
              .upsert(slice, { onConflict: "fk_profile_id,external_id", ignoreDuplicates: false });
            if (error) {
              // fallback: plain insert ignoring duplicates manually
              console.error("upsert posts error", error);
              const { error: e2 } = await supabase.from("fk_posts").insert(slice);
              if (e2) throw e2;
            }
            totalPosts += slice.length;
          }

          // Refresh fk_daily_top_posts derived view: pick top engagement per (profile, day)
          // Group in JS and upsert
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
        description: `${totalProfiles} perfiles nuevos · ${totalKpis} KPIs · ${totalPosts} posts.`,
      });
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["fk-profiles-client"] });
      qc.invalidateQueries({ queryKey: ["fk-kpis"] });
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
          Sube los exports de KPIs y Posts (Fanpage Karma u otros). El importador detecta automáticamente el tipo de archivo.
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
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {f.kind === "kpis" && <Badge variant="default">KPIs · {f.rowCount} perfiles</Badge>}
                    {f.kind === "posts" && <Badge variant="secondary">Posts · {f.rowCount} filas</Badge>}
                    {f.kind === "unknown" && <Badge variant="destructive">No reconocido</Badge>}
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
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFiles([])}>Limpiar</Button>
              <Button onClick={handleImport} disabled={importing || files.every((f) => f.kind === "unknown")}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Importar {files.filter((f) => f.kind !== "unknown").length} archivo(s)
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Los archivos de <strong>KPIs</strong> contienen métricas por perfil (followers, engagement, PPI). Los archivos de <strong>Posts</strong> contienen el universo de publicaciones con likes, comentarios, alcance, etc.
            Marca "Competencia" en los archivos de benchmark para distinguir perfiles propios de competidores.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
