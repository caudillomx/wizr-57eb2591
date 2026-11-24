import { Request, Response } from "express";
import prisma from "../config/prisma";
import { detectPlatformFromUrl } from "../lib/netnography/platforms";
import { startSourceExtraction, syncSourceExtraction } from "../lib/netnography/apify.service";
import {
  advanceAnalysis,
  assembleAndVerifyResult,
  startStudyAnalysis,
} from "../lib/netnography/processor.service";
import { assessAuthenticity, buildPseudonymizer } from "../lib/netnography/sampling";
import { fetchViralSignals } from "../lib/netnography/signals.service";
import { buildNetnographyInfographicSvg } from "../lib/netnography/infographic.service";

export const listStudies = async (req: Request, res: Response) => {
  try {
    const { projectId, clientId, kind } = req.query;
    const where: any = {};
    if (projectId) where.project_id = String(projectId);
    if (clientId) where.client_id = String(clientId);
    if (kind) where.kind = String(kind);

    const studies = await prisma.netnographyStudy.findMany({
      where,
      orderBy: { updated_at: "desc" },
      include: {
        sources: { select: { id: true, platform: true, status: true, comment_count: true, max_comments: true } },
        analyses: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            stage: true,
            comment_count: true,
            sample_size: true,
            effective_sample_size: true,
            result: true,
            validation_metrics: true,
            created_at: true,
            finished_at: true,
          },
        },
      },
    });
    res.json({ studies });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al listar estudios" });
  }
};

export const createStudy = async (req: Request, res: Response) => {
  try {
    const {
      kind = "deep",
      title,
      topic = "",
      central_question,
      secondary_questions = [],
      requester,
      decision_enabled,
      universe_definition,
      hypothesis,
      ethical_risk = "bajo",
      stance_target,
      project_id,
      client_id,
      urls = [],
      max_comments = 500,
      include_replies = true,
    } = req.body || {};

    if (!title && (!Array.isArray(urls) || urls.length === 0)) {
      return res.status(400).json({ error: "Se requiere un título o al menos una URL." });
    }

    const totalStudies = await prisma.netnographyStudy.count();
    const folio = `NET-${new Date().getFullYear()}-${String(totalStudies + 1).padStart(3, "0")}`;
    const userId = (req as any).user?.id || null;

    const study = await prisma.netnographyStudy.create({
      data: {
        folio,
        kind: kind === "quick" ? "quick" : "deep",
        title: title || (kind === "quick" ? `Pulso rápido · ${folio}` : `Estudio ${folio}`),
        topic,
        central_question: central_question || null,
        secondary_questions: Array.isArray(secondary_questions) ? secondary_questions : [],
        requester: requester || null,
        decision_enabled: decision_enabled || null,
        universe_definition: universe_definition || null,
        hypothesis: hypothesis || null,
        ethical_risk,
        stance_target: stance_target || null,
        project_id: project_id || null,
        client_id: client_id || null,
        user_id: userId,
      },
    });

    const createdSources = [];
    for (const rawUrl of Array.isArray(urls) ? urls : []) {
      const detected = detectPlatformFromUrl(String(rawUrl));
      if (!detected) continue;
      const src = await prisma.netnographySource.create({
        data: {
          study_id: study.id,
          url: detected.normalizedUrl,
          platform: detected.platform,
          post_id: detected.postId,
          max_comments: Number(max_comments) || 500,
          include_replies: Boolean(include_replies),
        },
      });
      createdSources.push(src);
    }

    res.status(201).json({ study, sources: createdSources });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al crear estudio" });
  }
};

export const getStudyDetail = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const study = await prisma.netnographyStudy.findUnique({
      where: { id: studyId },
      include: {
        sources: { orderBy: { created_at: "asc" } },
        analyses: { orderBy: { created_at: "desc" }, take: 3 },
      },
    });
    if (!study) return res.status(404).json({ error: "Estudio no encontrado" });
    res.json({ study });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al obtener estudio" });
  }
};

export const deleteStudy = async (req: Request, res: Response) => {
  try {
    await prisma.netnographyStudy.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al eliminar estudio" });
  }
};

export const addSourceToStudy = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const { url, community_name, max_comments = 500, include_replies = true } = req.body || {};
    const detected = detectPlatformFromUrl(String(url || ""));
    if (!detected) {
      return res.status(400).json({ error: "URL no reconocida (usa Instagram, TikTok, YouTube, Facebook o X)." });
    }

    const source = await prisma.netnographySource.upsert({
      where: { study_id_url: { study_id: studyId, url: detected.normalizedUrl } },
      update: { max_comments: Number(max_comments) || 500, include_replies: Boolean(include_replies), community_name },
      create: {
        study_id: studyId,
        url: detected.normalizedUrl,
        platform: detected.platform,
        post_id: detected.postId,
        community_name: community_name || null,
        max_comments: Number(max_comments) || 500,
        include_replies: Boolean(include_replies),
      },
    });
    res.status(201).json({ source });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al agregar fuente" });
  }
};

export const importCorpusRows = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const { sourceLabel = "Fanpage Karma Export", rows = [] } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Se requiere un arreglo de registros para importar." });
    }

    const syntheticUrl = `urn:wizr:fk:${studyId}:${Date.now()}`;
    const source = await prisma.netnographySource.create({
      data: {
        study_id: studyId,
        url: syntheticUrl,
        platform: "fanpage_karma",
        community_name: sourceLabel,
        status: "extraida",
        max_comments: rows.length,
        comment_count: rows.length,
        finished_at: new Date(),
      },
    });

    const pseudo = buildPseudonymizer();
    const assessment = assessAuthenticity(
      rows.map((r: any, idx: number) => ({
        id: String(r.id || idx),
        stratum: String(r.platform || "fanpage_karma"),
        authorKey: String(r.author || "anonimo"),
        text: String(r.text || r.message || ""),
      }))
    );

    let inserted = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const text = String(r.text || r.message || r.description || "").trim();
      if (!text) continue;
      const extId = String(r.id || r.external_id || `fk-${i}`);
      const { alias, hash } = pseudo(r.author);
      const auth = assessment.get(String(r.id || i)) || { flag: "organic", signals: [] };
      const pubDate = r.published_at || r.date ? new Date(r.published_at || r.date) : null;

      await prisma.netnographyComment.upsert({
        where: { source_id_external_id: { source_id: source.id, external_id: extId } },
        update: {},
        create: {
          source_id: source.id,
          external_id: extId,
          author_alias: alias,
          author_hash: hash,
          text,
          published_at: pubDate && !isNaN(pubDate.getTime()) ? pubDate : null,
          likes: Number(r.likes || 0) || 0,
          replies_count: Number(r.replies || 0) || 0,
          shares_count: Number(r.shares || 0) || 0,
          url: r.url || null,
          authenticity_flag: auth.flag,
          authenticity_signals: auth.signals,
          stratum: String(r.platform || "fanpage_karma").toLowerCase(),
          raw: r,
        },
      });
      inserted += 1;
    }

    await prisma.netnographySource.update({
      where: { id: source.id },
      data: { comment_count: inserted },
    });

    res.status(201).json({ source, imported: inserted });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al importar corpus" });
  }
};

export const extractStudySources = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const { action = "sync" } = req.body || {};
    const sources = await prisma.netnographySource.findMany({ where: { study_id: studyId } });

    const updated = [];
    for (const src of sources) {
      if (action === "start" && (src.status === "pendiente" || src.status === "error")) {
        updated.push(await startSourceExtraction(src.id));
      } else if (src.status === "extrayendo" || src.status === "iniciando") {
        updated.push(await syncSourceExtraction(src.id));
      } else {
        updated.push(src);
      }
    }
    res.json({ sources: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error en extracción" });
  }
};

export const triggerOrAdvanceAnalysis = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const { analysisId, startNew = false } = req.body || {};

    let analysis;
    if (analysisId && !startNew) {
      analysis = await advanceAnalysis(String(analysisId));
    } else {
      const created = await startStudyAnalysis(studyId);
      analysis = await advanceAnalysis(created.id);
    }
    res.json({ analysis });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Error al analizar estudio" });
  }
};

export const getValidationQueue = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const latest = await prisma.netnographyAnalysis.findFirst({
      where: { study_id: studyId, status: "completado" },
      orderBy: { created_at: "desc" },
    });
    if (!latest) return res.json({ analysisId: null, items: [], metrics: null });

    const items = await prisma.netnographyCommentLabel.findMany({
      where: { analysis_id: latest.id, is_validation_sample: true },
      include: {
        comment: {
          select: {
            id: true,
            author_alias: true,
            text: true,
            likes: true,
            published_at: true,
            source: { select: { platform: true } },
          },
        },
      },
      orderBy: [{ reviewed_at: "asc" }, { created_at: "asc" }],
      take: 200,
    });

    // En revisión ciega no enviamos la predicción de la IA hasta que reviewed_at exista
    const sanitized = items.map((it) => ({
      id: it.id,
      comment_id: it.comment_id,
      comment: it.comment,
      human_sentiment: it.human_sentiment,
      human_stance: it.human_stance,
      human_narrative: it.human_narrative,
      reviewed_at: it.reviewed_at,
      ai_sentiment: it.reviewed_at ? it.sentiment : null,
      ai_stance: it.reviewed_at ? it.stance : null,
      ai_narrative: it.reviewed_at ? it.narrative : null,
    }));

    res.json({
      analysisId: latest.id,
      codebook: latest.codebook || [],
      metrics: latest.validation_metrics,
      items: sanitized,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al cargar cola de validación" });
  }
};

export const submitManualLabel = async (req: Request, res: Response) => {
  try {
    const labelId = String(req.params.labelId);
    const { human_sentiment, human_stance, human_narrative } = req.body || {};
    const userId = (req as any).user?.email || (req as any).user?.id || "analista";

    const updated = await prisma.netnographyCommentLabel.update({
      where: { id: labelId },
      data: {
        human_sentiment: human_sentiment || undefined,
        human_stance: human_stance || undefined,
        human_narrative: human_narrative || undefined,
        reviewed_at: new Date(),
        reviewed_by: userId,
      },
    });
    res.json({ label: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al guardar revisión manual" });
  }
};

export const recomputeAnalysis = async (req: Request, res: Response) => {
  try {
    const analysisId = String(req.params.analysisId);
    const updated = await assembleAndVerifyResult(analysisId);
    res.json({ analysis: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al recomputar estudio" });
  }
};

export const updateFieldDiary = async (req: Request, res: Response) => {
  try {
    const analysisId = String(req.params.analysisId);
    const { field_diary = "" } = req.body || {};
    const updated = await prisma.netnographyAnalysis.update({
      where: { id: analysisId },
      data: { field_diary },
    });
    res.json({ analysis: updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al guardar diario de campo" });
  }
};

export const getViralSignals = async (req: Request, res: Response) => {
  try {
    const geo = String(req.query.geo || "MX");
    const signals = await fetchViralSignals(geo);
    res.json({ geo, signals });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al consultar señales virales" });
  }
};

export const getStudyInfographicSvg = async (req: Request, res: Response) => {
  try {
    const studyId = String(req.params.id);
    const study = await prisma.netnographyStudy.findUnique({
      where: { id: studyId },
      include: {
        analyses: {
          where: { status: "completado" },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });
    if (!study) return res.status(404).json({ error: "Estudio no encontrado" });
    const latest = study.analyses[0];
    if (!latest || !latest.result) {
      return res.status(400).json({ error: "El estudio aún no tiene un análisis completado." });
    }
    const r: any = latest.result;
    const svg = buildNetnographyInfographicSvg({
      folio: study.folio,
      title: study.title,
      topic: study.topic,
      headline: r.headline || study.title,
      executiveSummary: r.executive_summary || "",
      totalComments: r.total_comments || 0,
      effectiveSampleSize: r.effective_sample_size || 0,
      temperature: r.temperature || { score: 50, label: "Tibia" },
      sentiment: r.sentiment || { positive: 0, neutral: 100, negative: 0 },
      stance: r.stance,
      narratives: r.narratives || [],
      authenticity: r.authenticity,
      emicTerms: r.emic_terms || [],
      generatedAt: r.methodology?.generated_at,
    });
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.send(svg);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Error al generar infografía" });
  }
};
