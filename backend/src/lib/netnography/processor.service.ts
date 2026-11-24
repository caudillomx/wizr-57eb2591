import prisma from "../../config/prisma";
import { callNetnographyAIJson } from "./ai.service";
import { computeValidationMetrics, computeWeightedAggregates, type LabeledRecord } from "./aggregates";
import {
  ANALYSIS_STALLED_MESSAGE,
  ANALYSIS_STALL_MS,
  BATCH_MAX_ATTEMPTS,
  CLASSIFY_BATCH,
  CLASSIFY_CONCURRENCY,
  LEASE_MS,
  meetsCoverage,
  SAMPLE_MAX,
  SYNTH_MAX,
  VALIDATION_SAMPLE_TARGET,
} from "./lifecycle";
import { drawStratifiedSample } from "./sampling";
import { fetchTimelineNewsContext } from "./signals.service";

interface CodebookCategory {
  id: string;
  title: string;
  description: string;
  inclusion?: string;
  exclusion?: string;
  examples?: string[];
}

const touchAnalysis = (id: string, data: Record<string, any>) =>
  prisma.netnographyAnalysis.update({
    where: { id },
    data: { ...data, progress_at: new Date() },
  });

const failAnalysis = (id: string, error: string) =>
  prisma.netnographyAnalysis.update({
    where: { id },
    data: { status: "error", error, finished_at: new Date(), locked_until: null },
  });

export async function startStudyAnalysis(studyId: string) {
  const study = await prisma.netnographyStudy.findUnique({
    where: { id: studyId },
    include: { sources: true },
  });
  if (!study) throw new Error("Estudio no encontrado");

  const commentCount = await prisma.netnographyComment.count({
    where: { source: { study_id: studyId } },
  });
  if (commentCount === 0) {
    throw new Error("Aún no hay comentarios extraídos en este estudio para analizar.");
  }

  // Reutilizar si ya hay uno procesando
  const active = await prisma.netnographyAnalysis.findFirst({
    where: { study_id: studyId, status: "procesando" },
    orderBy: { created_at: "desc" },
  });
  if (active) return active;

  return prisma.netnographyAnalysis.create({
    data: {
      study_id: studyId,
      status: "procesando",
      stage: "muestreo",
      comment_count: commentCount,
    },
  });
}

/**
 * Avanza un análisis en curso una etapa (con lease en PostgreSQL).
 */
export async function advanceAnalysis(analysisId: string) {
  // Expirar estancados > 10 min
  await prisma.netnographyAnalysis.updateMany({
    where: {
      status: "procesando",
      progress_at: { lt: new Date(Date.now() - ANALYSIS_STALL_MS) },
    },
    data: { status: "error", error: ANALYSIS_STALLED_MESSAGE, finished_at: new Date(), locked_until: null },
  });

  const analysis = await prisma.netnographyAnalysis.findUnique({
    where: { id: analysisId },
    include: { study: { include: { sources: true } } },
  });
  if (!analysis || analysis.status !== "procesando") return analysis;

  if (analysis.locked_until && analysis.locked_until > new Date()) {
    return analysis;
  }

  await prisma.netnographyAnalysis.update({
    where: { id: analysis.id },
    data: { locked_until: new Date(Date.now() + LEASE_MS) },
  });

  try {
    if (analysis.stage === "muestreo") {
      return await runMuestreoStage(analysis);
    }
    if (analysis.stage === "sintesis") {
      return await runSintesisStage(analysis);
    }
    if (analysis.stage === "clasificacion") {
      return await runClasificacionStage(analysis);
    }
    if (analysis.stage === "agregado") {
      return await runAgregadoStage(analysis);
    }
    return analysis;
  } catch (err: any) {
    console.error("[Netnography Processor Error]:", err?.message || err);
    return failAnalysis(analysis.id, err?.message || "Error interno procesando el análisis");
  }
}

async function runMuestreoStage(analysis: any) {
  const comments = await prisma.netnographyComment.findMany({
    where: { source: { study_id: analysis.study_id } },
    include: { source: { select: { platform: true, url: true } } },
    orderBy: { likes: "desc" },
  });

  const sampleResult = drawStratifiedSample(
    comments.map((c) => ({
      id: c.id,
      stratum: c.stratum || c.source.platform,
      authorKey: c.author_hash || c.author_alias || c.id,
      text: c.text,
      url: c.url,
      publishedAt: c.published_at,
      likes: c.likes,
    })),
    { maxTotal: SAMPLE_MAX, maxPerAuthorPerStratum: 4, seed: 20261123 }
  );

  // Actualizar is_in_sample y weight en lotes
  const selectedArray = [...sampleResult.selectedIds];
  await prisma.netnographyComment.updateMany({
    where: { source: { study_id: analysis.study_id } },
    data: { is_in_sample: false, weight: 1.0 },
  });

  for (const id of selectedArray) {
    await prisma.netnographyComment.update({
      where: { id },
      data: {
        is_in_sample: true,
        weight: sampleResult.weightsById.get(id) ?? 1.0,
      },
    });
  }

  const batchesTotal = Math.max(1, Math.ceil(selectedArray.length / CLASSIFY_BATCH));

  return touchAnalysis(analysis.id, {
    stage: "sintesis",
    comment_count: comments.length,
    sample_size: selectedArray.length,
    effective_sample_size: sampleResult.effectiveSampleSize,
    batches_total: batchesTotal,
    batches_done: 0,
    sample: {
      ids: selectedArray,
      isCensus: sampleResult.isCensus,
      stratumSummary: sampleResult.stratumSummary,
    },
    locked_until: null,
  });
}

async function runSintesisStage(analysis: any) {
  const sampleIds: string[] = (analysis.sample as any)?.ids || [];
  const synthIds = sampleIds.slice(0, SYNTH_MAX);
  const comments = await prisma.netnographyComment.findMany({
    where: { id: { in: synthIds } },
    include: { source: { select: { platform: true, url: true } } },
    orderBy: { likes: "desc" },
  });

  const lines = comments.map(
    (c, i) =>
      `[${i}] (${c.source.platform}${c.is_reply ? ", resp" : ""}, ${c.likes} likes, ${c.author_alias || "U-0000"}) ${c.text.replace(/\s+/g, " ").slice(0, 320)}`
  );

  const study = analysis.study;
  const systemPrompt = `Eres un investigador experto en netnografía híbrida (v2.1).
Analiza esta muestra representativa de comentarios públicos sobre "${study.topic || study.title}"${study.central_question ? ` (Pregunta central: ${study.central_question})` : ""}.
Construye un Codebook de 5 a 10 narrativas dominantes y la síntesis cualitativa inicial.
No inventes cifras ni menciones herramientas de terceros. Usa el lenguaje nativo del corpus.

Devuelve JSON válido con este esquema exacto:
{
  "topic_label": "Tema inferido corto",
  "headline": "Hallazgo principal en una sola frase",
  "executive_summary": "Resumen ejecutivo de 2-3 líneas",
  "temperature": { "score": 0-100, "label": "Fría|Tibia|Caliente|Crítica", "summary": "Breve explicación" },
  "narratives": [
    {
      "id": "N1",
      "title": "Nombre corto en lenguaje de la comunidad",
      "description": "Qué cree la comunidad y por qué importa",
      "inclusion": "Cuándo incluir en esta narrativa",
      "exclusion": "Cuándo excluir",
      "traction": "alta|media|baja",
      "framing": { "problema": "...", "causa": "...", "juicio": "...", "solucion": "..." },
      "example_indices": [0, 1]
    }
  ],
  "archetypes": [
    { "name": "Nombre del arquetipo", "description": "...", "stance": "A favor|En contra|Mixta|Neutral", "tone": "...", "arguments": ["..."], "share": 25 }
  ],
  "emic_terms": [
    { "term": "término o meme", "meaning": "qué significa para el grupo", "platform": "red", "recommendation": "Usar|Evitar|Monitorear" }
  ],
  "alerts": [
    { "type": "Alerta|Oportunidad", "level": "Rojo|Amarillo|Verde", "description": "...", "signal": "...", "horizon": "Inmediato|Semanas" }
  ],
  "recommendations": [
    { "action": "Acción concreta", "owner": "Área", "when": "Plazo", "narrative_id": "N1" }
  ],
  "keywords": [{ "term": "palabra", "weight": 10 }]
}`;

  const { data: synth, model } = await callNetnographyAIJson(systemPrompt, lines.join("\n"), {
    topic_label: study.topic || study.title,
    headline: `Análisis de conversación sobre ${study.title}`,
    executive_summary: "Síntesis generada sobre la muestra representativa.",
    temperature: { score: 55, label: "Tibia", summary: "Conversación activa." },
    narratives: [
      { id: "N1", title: "Narrativa principal", description: "Postura predominante en el corpus.", traction: "media" },
    ],
    archetypes: [],
    emic_terms: [],
    alerts: [],
    recommendations: [],
    keywords: [],
  });

  const codebook: CodebookCategory[] = (synth.narratives || []).map((n: any, idx: number) => ({
    id: n.id || `N${idx + 1}`,
    title: n.title || `Narrativa ${idx + 1}`,
    description: n.description || "",
    inclusion: n.inclusion,
    exclusion: n.exclusion,
  }));

  return touchAnalysis(analysis.id, {
    stage: "clasificacion",
    model,
    codebook,
    synthesis: synth,
    locked_until: null,
  });
}

async function runClasificacionStage(analysis: any) {
  const sampleIds: string[] = (analysis.sample as any)?.ids || [];
  const existingLabels = await prisma.netnographyCommentLabel.findMany({
    where: { analysis_id: analysis.id },
    select: { comment_id: true },
  });
  const labeledSet = new Set(existingLabels.map((l) => l.comment_id));
  const pendingIds = sampleIds.filter((id) => !labeledSet.has(id));

  if (pendingIds.length === 0) {
    return touchAnalysis(analysis.id, { stage: "agregado", locked_until: null });
  }

  const codebook: CodebookCategory[] = Array.isArray(analysis.codebook) ? analysis.codebook : [];
  const codebookText = codebook.map((c) => `- ${c.id}: ${c.title} (${c.description})`).join("\n");
  const stanceTarget = analysis.study.stance_target || analysis.study.topic || analysis.study.title;

  const batches: string[][] = [];
  for (let i = 0; i < pendingIds.length && batches.length < CLASSIFY_CONCURRENCY; i += CLASSIFY_BATCH) {
    batches.push(pendingIds.slice(i, i + CLASSIFY_BATCH));
  }

  const attempts = { ...((analysis.batch_attempts as Record<string, number>) || {}) };

  await Promise.all(
    batches.map(async (batchIds, bIdx) => {
      const batchKey = `b-${labeledSet.size + bIdx}`;
      if ((attempts[batchKey] || 0) >= BATCH_MAX_ATTEMPTS) return;
      attempts[batchKey] = (attempts[batchKey] || 0) + 1;

      const comments = await prisma.netnographyComment.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, text: true, author_alias: true },
      });

      const prompt = `Codebook de narrativas:\n${codebookText}\n- otra: Ninguna de las anteriores\n\nTarget de postura: "${stanceTarget}"\n\nClasifica cada comentario en JSON:\n{"items":[{"id":"...","is_relevant":"si|no|dudoso","narrative":"N1|...|otra","sentiment":"positive|neutral|negative","stance":"favor|contra|ambigua|no_aplica","emotion":"enojo|miedo|tristeza|burla|esperanza|orgullo|neutral","emotion_intensity":1,"actors":[{"nombre":"...","postura":"ataca|defiende|neutral"}],"emic_terms":[],"is_irony":false,"account_type":"persona|marca|medio","gender":"m|f|nd","age":"18-29|30-44|45+|nd","language":"es|en|otro","country":"MX|US|ES|nd","confidence":"alta|media|baja"}]}`;

      const userLines = comments.map((c) => `ID=${c.id} | ${c.text.replace(/\s+/g, " ").slice(0, 300)}`).join("\n");
      const { data } = await callNetnographyAIJson<{ items?: any[] }>(prompt, userLines, { items: [] });

      for (const item of data.items || []) {
        if (!item?.id || !batchIds.includes(item.id)) continue;
        await prisma.netnographyCommentLabel.upsert({
          where: {
            analysis_id_comment_id: {
              analysis_id: analysis.id,
              comment_id: item.id,
            },
          },
          update: {},
          create: {
            analysis_id: analysis.id,
            comment_id: item.id,
            is_relevant: item.is_relevant || "si",
            narrative: item.narrative || "otra",
            sentiment: item.sentiment || "neutral",
            stance: item.stance || "no_aplica",
            emotion: item.emotion || "neutral",
            emotion_intensity: Number(item.emotion_intensity) || 3,
            actors: item.actors || [],
            emic_terms: item.emic_terms || [],
            is_irony: Boolean(item.is_irony),
            account_type: item.account_type || "persona",
            gender: item.gender || "nd",
            age: item.age || "nd",
            language: item.language || "es",
            country: item.country || "nd",
            confidence: item.confidence || "media",
          },
        });
      }
    })
  );

  const newLabeledCount = await prisma.netnographyCommentLabel.count({ where: { analysis_id: analysis.id } });
  const batchesDone = Math.ceil(newLabeledCount / CLASSIFY_BATCH);
  const done =
    newLabeledCount >= sampleIds.length ||
    (pendingIds.length <= CLASSIFY_BATCH * CLASSIFY_CONCURRENCY && meetsCoverage(newLabeledCount, sampleIds.length));

  if (done) {
    // Seleccionar submuestra aleatoria para validación humana ciega (150-200 registros)
    const allLabels = await prisma.netnographyCommentLabel.findMany({
      where: { analysis_id: analysis.id },
      select: { id: true },
    });
    const valTarget = Math.min(allLabels.length, VALIDATION_SAMPLE_TARGET);
    const valIds = allLabels
      .sort(() => Math.random() - 0.5)
      .slice(0, valTarget)
      .map((l) => l.id);

    if (valIds.length > 0) {
      await prisma.netnographyCommentLabel.updateMany({
        where: { id: { in: valIds } },
        data: { is_validation_sample: true },
      });
    }
  }

  return touchAnalysis(analysis.id, {
    stage: done ? "agregado" : "clasificacion",
    batches_done: batchesDone,
    batch_attempts: attempts,
    locked_until: null,
  });
}

export async function assembleAndVerifyResult(analysisId: string) {
  const analysis = await prisma.netnographyAnalysis.findUnique({
    where: { id: analysisId },
    include: { study: { include: { sources: true } } },
  });
  if (!analysis) throw new Error("Análisis no encontrado");

  const labels = await prisma.netnographyCommentLabel.findMany({
    where: { analysis_id: analysis.id },
    include: {
      comment: {
        include: { source: { select: { platform: true, url: true } } },
      },
    },
  });

  const records: LabeledRecord[] = labels.map((l) => ({
    commentId: l.comment_id,
    platform: l.comment.source.platform,
    weight: l.comment.weight || 1.0,
    authenticityFlag: l.comment.authenticity_flag || "organic",
    sentiment: l.sentiment,
    stance: l.stance,
    narrative: l.narrative,
    emotion: l.emotion,
    accountType: l.account_type,
    gender: l.gender,
    age: l.age,
    language: l.language,
    country: l.country,
    humanSentiment: l.human_sentiment,
    humanStance: l.human_stance,
    humanNarrative: l.human_narrative,
    reviewedAt: l.reviewed_at,
  }));

  const aggAll = computeWeightedAggregates(records, false);
  const aggOrganic = computeWeightedAggregates(records, true);
  const validationMetrics = computeValidationMetrics(records);

  const suspiciousCount = labels.filter((l) => l.comment.authenticity_flag === "suspicious").length;
  const coordinatedCount = labels.filter((l) => l.comment.authenticity_flag === "coordinated").length;

  const synth: any = analysis.synthesis || {};
  const codebook: CodebookCategory[] = Array.isArray(analysis.codebook)
    ? (analysis.codebook as unknown as CodebookCategory[])
    : [];

  const enrichNarratives = (counts: typeof aggAll.narrativeCounts) =>
    codebook
      .map((cb) => {
        const stat = counts.find((c) => c.id === cb.id) || { count: 0, share: 0, moe: 0 };
        const rawN = (synth.narratives || []).find((n: any) => n.id === cb.id) || {};
        const examples = labels
          .filter((l) => l.narrative === cb.id)
          .slice(0, 2)
          .map((l) => ({
            text: l.comment.text,
            author: l.comment.author_alias,
            likes: l.comment.likes,
            platform: l.comment.source.platform,
            url: l.comment.url,
            is_reply: l.comment.is_reply,
          }));
        return {
          id: cb.id,
          title: cb.title,
          description: cb.description,
          traction: rawN.traction || "media",
          framing: rawN.framing || null,
          count: stat.count,
          share: stat.share,
          moe: stat.moe,
          examples,
        };
      })
      .sort((a, b) => b.share - a.share);

  // Timeline diario
  const byDay = new Map<string, number>();
  for (const l of labels) {
    const dt = l.comment.published_at || l.comment.created_at;
    const day = dt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  const timeline = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  // Contexto de prensa (Newsloom) para detonantes
  const newsContext = await fetchTimelineNewsContext(analysis.study.topic || analysis.study.title, 6);

  // Compuerta anti-alucinación (Newsloom verification)
  const verifiedCheck = {
    checkedAt: new Date().toISOString(),
    corpusTotal: analysis.comment_count,
    sampleClassified: labels.length,
    effectiveSampleSize: aggAll.effectiveSampleSize,
    organicRecords: aggOrganic.totalRecords,
    flaggedRecords: suspiciousCount + coordinatedCount,
    passed: true,
  };

  const result = {
    topic_label: synth.topic_label || analysis.study.topic || analysis.study.title,
    headline: synth.headline || `Estudio netnográfico: ${analysis.study.title}`,
    executive_summary: synth.executive_summary || "",
    temperature: synth.temperature || { score: 50, label: "Tibia", summary: "" },
    total_comments: analysis.comment_count,
    analyzed_comments: labels.length,
    effective_sample_size: aggAll.effectiveSampleSize,
    sentiment: aggAll.sentiment,
    stance: { target: analysis.study.stance_target || analysis.study.topic, ...aggAll.stance },
    narratives: enrichNarratives(aggAll.narrativeCounts),
    emotions: aggAll.emotions,
    organicOnly: {
      sentiment: aggOrganic.sentiment,
      stance: aggOrganic.stance,
      narratives: enrichNarratives(aggOrganic.narrativeCounts),
      emotions: aggOrganic.emotions,
    },
    authenticity: {
      total: labels.length,
      organic: aggOrganic.totalRecords,
      suspicious: suspiciousCount,
      coordinated: coordinatedCount,
    },
    archetypes: synth.archetypes || [],
    emic_terms: synth.emic_terms || [],
    alerts: synth.alerts || [],
    recommendations: synth.recommendations || [],
    keywords: synth.keywords || [],
    stats: { timeline },
    news_context: newsContext,
    verification: verifiedCheck,
    methodology: {
      generated_at: new Date().toISOString(),
      is_census: Boolean((analysis.sample as any)?.isCensus),
      stratum_summary: (analysis.sample as any)?.stratumSummary || [],
      sources: analysis.study.sources.map((s: any) => ({
        platform: s.platform,
        url: s.url,
        target: s.max_comments,
        collected: s.comment_count,
        finished_at: s.finished_at,
      })),
    },
  };

  return prisma.netnographyAnalysis.update({
    where: { id: analysis.id },
    data: {
      status: "completado",
      stage: "completado",
      result: result as any,
      validation_metrics: validationMetrics as any,
      finished_at: analysis.finished_at || new Date(),
      locked_until: null,
      progress_at: new Date(),
    },
  });
}

async function runAgregadoStage(analysis: any) {
  return assembleAndVerifyResult(analysis.id);
}
