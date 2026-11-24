import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import prisma from "./src/config/prisma";
import { buildPseudonymizer } from "./src/lib/netnography/sampling";

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\r") {
        // ignore
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.length >= headers.length)
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? "";
      });
      return obj;
    });
}

function safeJson(raw: string | undefined, fallback: any = null) {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function ensureOwnerUser() {
  const existing = await prisma.user.findFirst({ orderBy: { created_at: "asc" } });
  if (existing) return existing;

  const password = await bcrypt.hash("WizrAdmin2026!", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@wizr.mx",
      password,
      roles: { create: { role: "admin" } },
      profile: { create: { full_name: "Admin Wizr" } },
    },
  });
  return user;
}

async function importWizrProjects(wizrDir: string, ownerId: string) {
  if (!fs.existsSync(wizrDir)) {
    console.log("No se encontró carpeta wizrDir:", wizrDir);
    return;
  }
  const entries = fs.readdirSync(wizrDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const dir of entries) {
    const folder = path.join(wizrDir, dir.name);
    const projPath = path.join(folder, "proyecto.json");
    if (!fs.existsSync(projPath)) continue;

    const projData = JSON.parse(fs.readFileSync(projPath, "utf-8"));
    const p = projData.proyecto;
    if (!p?.id) continue;

    await prisma.project.upsert({
      where: { id: p.id },
      update: {
        nombre: p.nombre,
        objetivo: p.objetivo || "",
        audiencia: p.audiencia || "General",
        descripcion: p.descripcion || null,
        contexto_estrategico: p.contexto_estrategico || null,
        activo: p.activo ?? true,
      },
      create: {
        id: p.id,
        user_id: ownerId,
        nombre: p.nombre,
        tipo: p.tipo || "monitoreo",
        objetivo: p.objetivo || "",
        audiencia: p.audiencia || "General",
        sensibilidad: p.sensibilidad || "medio",
        alcance_temporal: p.alcance_temporal || "diario",
        alcance_geografico: Array.isArray(p.alcance_geografico) ? p.alcance_geografico : [],
        version: p.version || 1,
        descripcion: p.descripcion || null,
        contexto_estrategico: p.contexto_estrategico || null,
        activo: p.activo ?? true,
      },
    });

    for (const ent of projData.entidades || []) {
      await prisma.entity.upsert({
        where: { id: ent.id },
        update: {
          nombre: ent.nombre,
          palabras_clave: Array.isArray(ent.palabras_clave) ? ent.palabras_clave : [],
          aliases: Array.isArray(ent.aliases) ? ent.aliases : [],
        },
        create: {
          id: ent.id,
          project_id: p.id,
          tipo: ent.tipo || "tema",
          nombre: ent.nombre,
          descripcion: ent.descripcion || null,
          palabras_clave: Array.isArray(ent.palabras_clave) ? ent.palabras_clave : [],
          aliases: Array.isArray(ent.aliases) ? ent.aliases : [],
          platform_keywords: ent.platform_keywords || {},
          metadata: ent.metadata || {},
          activo: ent.activo ?? true,
        },
      });
    }

    const mencionesPath = path.join(folder, "menciones.json");
    let importedMentions = 0;
    if (fs.existsSync(mencionesPath)) {
      const menciones: any[] = JSON.parse(fs.readFileSync(mencionesPath, "utf-8"));
      if (Array.isArray(menciones) && menciones.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < menciones.length; i += chunkSize) {
          const chunk = menciones.slice(i, i + chunkSize).map((m) => ({
            id: m.id,
            project_id: p.id,
            entity_id: m.entity_id || null,
            url: m.url,
            title: m.title || null,
            description: m.description || null,
            source_domain: m.source_domain || null,
            published_at: m.published_at ? new Date(m.published_at) : null,
            matched_keywords: Array.isArray(m.matched_keywords) ? m.matched_keywords : [],
            sentiment: m.sentiment || null,
            relevance_score: m.relevance_score ?? 0.5,
            raw_metadata: m.raw_metadata || {},
            is_read: Boolean(m.is_read),
            is_archived: Boolean(m.is_archived),
          }));
          const res = await prisma.mention.createMany({ data: chunk, skipDuplicates: true });
          importedMentions += res.count;
        }
      }
    }

    const reportesPath = path.join(folder, "reportes.json");
    let importedReports = 0;
    if (fs.existsSync(reportesPath)) {
      const reportes: any[] = JSON.parse(fs.readFileSync(reportesPath, "utf-8"));
      for (const r of Array.isArray(reportes) ? reportes : []) {
        await prisma.sharedReport.upsert({
          where: { id: r.id },
          update: { title: r.title, content: r.content || {} },
          create: {
            id: r.id,
            project_id: p.id,
            project_name: r.project_name || p.nombre,
            title: r.title || `Reporte ${p.nombre}`,
            report_kind: r.report_kind || "smart",
            content: r.content || {},
            date_range: r.date_range || {},
            created_by: ownerId,
          },
        });
        importedReports += 1;
      }
    }

    console.log(
      `[Wizr] ${p.nombre}: ${(projData.entidades || []).length} entidades, ${importedMentions} menciones nuevas, ${importedReports} reportes`
    );
  }
}

async function importRadarStudies(radarDir: string, ownerId: string) {
  if (!fs.existsSync(radarDir)) {
    console.log("No se encontró carpeta radarDir:", radarDir);
    return;
  }

  const studiesFile = path.join(radarDir, "studies.csv");
  const sourcesFile = path.join(radarDir, "sources.csv");
  const analysesFile = path.join(radarDir, "analyses.csv");

  const studies = fs.existsSync(studiesFile) ? parseCsv(fs.readFileSync(studiesFile, "utf-8")) : [];
  const sources = fs.existsSync(sourcesFile) ? parseCsv(fs.readFileSync(sourcesFile, "utf-8")) : [];
  const analyses = fs.existsSync(analysesFile) ? parseCsv(fs.readFileSync(analysesFile, "utf-8")) : [];

  for (let i = 0; i < studies.length; i++) {
    const s = studies[i];
    if (!s.id) continue;
    await prisma.netnographyStudy.upsert({
      where: { id: s.id },
      update: { title: s.title, topic: s.topic || "", stance_target: s.stance_target || null },
      create: {
        id: s.id,
        folio: `NET-2026-${String(i + 1).padStart(3, "0")}`,
        kind: s.kind === "quick" ? "quick" : "deep",
        title: s.title || "Estudio importado",
        topic: s.topic || "",
        requester: s.client || null,
        stance_target: s.stance_target || null,
        user_id: ownerId,
      },
    });
  }

  for (const src of sources) {
    if (!src.id || !src.study_id) continue;
    await prisma.netnographySource.upsert({
      where: { id: src.id },
      update: { comment_count: Number(src.comment_count || 0) || 0, status: src.status || "extraida" },
      create: {
        id: src.id,
        study_id: src.study_id,
        url: src.url,
        platform: src.platform || "x",
        post_id: src.post_id || null,
        status: src.status || "extraida",
        max_comments: Number(src.max_comments || 500) || 500,
        include_replies: src.include_replies !== "f",
        apify_run_id: src.apify_run_id || null,
        apify_dataset_id: src.apify_dataset_id || null,
        comment_count: Number(src.comment_count || 0) || 0,
        extra_pass: src.extra_pass === "t",
        rechecked: src.rechecked === "t",
      },
    });
  }

  for (const a of analyses) {
    if (!a.id || !a.study_id) continue;
    await prisma.netnographyAnalysis.upsert({
      where: { id: a.id },
      update: { status: a.status || "completado", result: safeJson(a.result, null) },
      create: {
        id: a.id,
        study_id: a.study_id,
        status: a.status || "completado",
        stage: a.stage || "completado",
        model: a.model || null,
        comment_count: Number(a.comment_count || 0) || 0,
        sample_size: Number(a.comment_count || 0) || 0,
        effective_sample_size: Number(a.comment_count || 0) || 0,
        batches_total: Number(a.batches_total || 0) || 0,
        batches_done: Number(a.batches_done || 0) || 0,
        sample: safeJson(a.sample, null),
        codebook: safeJson(a.codebook, null),
        synthesis: safeJson(a.synthesis, null),
        result: safeJson(a.result, null),
        error: a.error || null,
      },
    });
  }

  console.log(`[Netnografía] ${studies.length} estudios, ${sources.length} fuentes, ${analyses.length} análisis importados.`);
}

async function streamCsvRows(
  filePath: string,
  onBatch: (rows: Record<string, string>[]) => Promise<void>,
  batchSize = 1000
) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(256 * 1024);
  let bytesRead = 0;
  let headers: string[] | null = null;
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let pendingQuote = false;
  let batch: Record<string, string>[] = [];

  const flushRow = async () => {
    row.push(field);
    field = "";
    if (!headers) {
      headers = row.map((h) => h.trim());
    } else if (row.length >= headers.length) {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = row[i] ?? "";
      batch.push(obj);
      if (batch.length >= batchSize) {
        await onBatch(batch);
        batch = [];
      }
    }
    row = [];
  };

  while ((bytesRead = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
    const chunk = buf.toString("utf-8", 0, bytesRead);
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          continue;
        } else {
          inQuotes = false;
        }
      }
      if (inQuotes) {
        if (c === '"') {
          pendingQuote = true;
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ",") {
          row.push(field);
          field = "";
        } else if (c === "\r") {
          // ignore
        } else if (c === "\n") {
          await flushRow();
        } else {
          field += c;
        }
      }
    }
  }
  fs.closeSync(fd);
  if (pendingQuote) inQuotes = false;
  if (field.length > 0 || row.length > 0) await flushRow();
  if (batch.length > 0) await onBatch(batch);
}

async function importCommentsCsv(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    console.log("No se encontró archivo de comentarios:", csvPath);
    return;
  }
  const existingSources = new Set(
    (await prisma.netnographySource.findMany({ select: { id: true } })).map((s) => s.id)
  );
  const pseudo = buildPseudonymizer();
  let total = 0;
  let skipped = 0;

  await streamCsvRows(
    csvPath,
    async (rows) => {
      const data = [];
      for (const r of rows) {
        if (!r.id || !r.source_id || !existingSources.has(r.source_id)) {
          skipped++;
          continue;
        }
        const { alias, hash } = pseudo(r.author);
        const pub = r.published_at ? new Date(r.published_at) : null;
        data.push({
          id: r.id,
          source_id: r.source_id,
          external_id: r.external_id || r.id,
          author_alias: alias,
          author_hash: hash,
          text: r.text || "",
          published_at: pub && !isNaN(pub.getTime()) ? pub : null,
          likes: Number(r.likes || 0) || 0,
          url: r.url || null,
          is_reply: r.is_reply === "t" || r.is_reply === "true",
          parent_external_id: r.parent_external_id || null,
          raw: safeJson(r.raw, {}),
        });
      }
      if (data.length > 0) {
        const res = await prisma.netnographyComment.createMany({ data, skipDuplicates: true });
        total += res.count;
      }
    },
    1000
  );
  console.log(`[Netnografía] ${total} comentarios importados (${skipped} omitidos sin fuente).`);
}

function normSent(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (s === "pos" || s === "positivo" || s === "positive") return "positive";
  if (s === "neg" || s === "negativo" || s === "negative") return "negative";
  if (s === "neu" || s === "neutral") return "neutral";
  return s || null;
}

async function importCommentLabelsCsv(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    console.log("No se encontró archivo de etiquetas:", csvPath);
    return;
  }
  const existingAnalyses = new Set(
    (await prisma.netnographyAnalysis.findMany({ select: { id: true } })).map((a) => a.id)
  );
  const existingComments = new Set(
    (await prisma.netnographyComment.findMany({ select: { id: true } })).map((c) => c.id)
  );
  let total = 0;

  await streamCsvRows(
    csvPath,
    async (rows) => {
      const data = [];
      for (const r of rows) {
        if (!r.id || !existingAnalyses.has(r.analysis_id) || !existingComments.has(r.comment_id)) continue;
        const rev = r.reviewed_at ? new Date(r.reviewed_at) : null;
        data.push({
          id: r.id,
          analysis_id: r.analysis_id,
          comment_id: r.comment_id,
          sentiment: normSent(r.sentiment),
          stance: r.stance || null,
          narrative: r.narrative || null,
          account_type: r.account_type || null,
          language: r.language || null,
          gender: r.gender || null,
          age: r.age || null,
          country: r.country || null,
          human_sentiment: normSent(r.human_sentiment),
          human_stance: r.human_stance || null,
          reviewed_at: rev && !isNaN(rev.getTime()) ? rev : null,
        });
      }
      if (data.length > 0) {
        const res = await prisma.netnographyCommentLabel.createMany({ data, skipDuplicates: true });
        total += res.count;
      }
    },
    1000
  );
  console.log(`[Netnografía] ${total} etiquetas de comentarios importadas.`);
}

async function main() {
  const wizrDir = process.argv[2];
  const radarDir = process.argv[3];
  const commentsCsv = process.argv[4];
  const owner = await ensureOwnerUser();
  console.log(`Usando usuario propietario: ${owner.email} (${owner.id})`);

  if (wizrDir && wizrDir !== "-") await importWizrProjects(wizrDir, owner.id);
  if (radarDir && radarDir !== "-") await importRadarStudies(radarDir, owner.id);
  if (commentsCsv && commentsCsv !== "-") await importCommentsCsv(commentsCsv);
  if (radarDir && radarDir !== "-") {
    await importCommentLabelsCsv(path.join(radarDir, "comment_labels.csv"));
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
