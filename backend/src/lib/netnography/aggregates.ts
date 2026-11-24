export interface LabeledRecord {
  commentId: string;
  platform: string;
  weight: number;
  authenticityFlag: string;
  sentiment: string | null;
  stance: string | null;
  narrative: string | null;
  emotion: string | null;
  accountType: string | null;
  gender: string | null;
  age: string | null;
  language: string | null;
  country: string | null;
  humanSentiment?: string | null;
  humanStance?: string | null;
  humanNarrative?: string | null;
  reviewedAt?: Date | string | null;
}

export interface StanceCell {
  share: number;
  count: number;
  moe: number;
}

export function marginOfError95(p: number, nEff: number): number {
  if (nEff <= 0) return 0;
  const val = 1.96 * Math.sqrt((p * (1 - p)) / nEff) * 100;
  return Math.round(val * 10) / 10;
}

export function effectiveN(weights: number[]): number {
  if (weights.length === 0) return 0;
  let sumW = 0;
  let sumW2 = 0;
  for (const w of weights) {
    sumW += w;
    sumW2 += w * w;
  }
  return sumW2 > 0 ? (sumW * sumW) / sumW2 : weights.length;
}

/**
 * Kappa de Cohen para dos evaluadores (IA vs Humano) sobre categorías nominales.
 */
export function computeCohenKappa(pairs: Array<[string, string]>): number | null {
  if (pairs.length === 0) return null;
  const n = pairs.length;
  let agree = 0;
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();

  for (const [a, b] of pairs) {
    if (a === b) agree += 1;
    freqA.set(a, (freqA.get(a) || 0) + 1);
    freqB.set(b, (freqB.get(b) || 0) + 1);
  }

  const po = agree / n;
  const categories = new Set([...freqA.keys(), ...freqB.keys()]);
  let pe = 0;
  for (const cat of categories) {
    pe += ((freqA.get(cat) || 0) / n) * ((freqB.get(cat) || 0) / n);
  }
  if (1 - pe === 0) return po === 1 ? 1 : 0;
  return Math.round(((po - pe) / (1 - pe)) * 1000) / 1000;
}

/**
 * Alfa de Krippendorff (datos nominales, 2 codificadores: IA y Humano).
 */
export function computeKrippendorffAlpha(pairs: Array<[string, string]>): number | null {
  if (pairs.length === 0) return null;
  const nUnits = pairs.length;
  const totalValues = nUnits * 2;
  let disagreements = 0;
  const counts = new Map<string, number>();

  for (const [a, b] of pairs) {
    if (a !== b) disagreements += 1;
    counts.set(a, (counts.get(a) || 0) + 1);
    counts.set(b, (counts.get(b) || 0) + 1);
  }

  const Do = disagreements / nUnits;
  let sumPairs = 0;
  for (const c of counts.values()) {
    sumPairs += c * (c - 1);
  }
  const totalPairs = totalValues * (totalValues - 1);
  if (totalPairs === 0) return 1;
  const De = 1 - sumPairs / totalPairs;
  if (De === 0) return Do === 0 ? 1 : 0;
  return Math.round((1 - Do / De) * 1000) / 1000;
}

export function computeValidationMetrics(rows: LabeledRecord[]) {
  const reviewed = rows.filter((r) => r.reviewedAt && r.humanSentiment && r.sentiment);
  if (reviewed.length === 0) {
    return {
      reviewedCount: 0,
      sentimentAgreement: null,
      sentimentKappa: null,
      sentimentAlpha: null,
      stanceKappa: null,
      narrativeKappa: null,
    };
  }

  const sentPairs: Array<[string, string]> = reviewed.map((r) => [r.sentiment!, r.humanSentiment!]);
  const sentAgree = sentPairs.filter(([a, b]) => a === b).length / sentPairs.length;

  const stancePairs: Array<[string, string]> = reviewed
    .filter((r) => r.stance && r.humanStance)
    .map((r) => [r.stance!, r.humanStance!]);

  const narrativePairs: Array<[string, string]> = reviewed
    .filter((r) => r.narrative && r.humanNarrative)
    .map((r) => [r.narrative!, r.humanNarrative!]);

  return {
    reviewedCount: reviewed.length,
    sentimentAgreement: Math.round(sentAgree * 1000) / 10,
    sentimentKappa: computeCohenKappa(sentPairs),
    sentimentAlpha: computeKrippendorffAlpha(sentPairs),
    stanceKappa: computeCohenKappa(stancePairs),
    narrativeKappa: computeCohenKappa(narrativePairs),
  };
}

export function computeWeightedAggregates(rows: LabeledRecord[], organicOnly = false) {
  const filtered = organicOnly ? rows.filter((r) => r.authenticityFlag === "organic") : rows;
  const totalWeight = filtered.reduce((acc, r) => acc + (r.weight || 1), 0);
  const nEff = effectiveN(filtered.map((r) => r.weight || 1));

  const effectiveSentiment = (r: LabeledRecord) => r.humanSentiment || r.sentiment || "neutral";
  const effectiveStance = (r: LabeledRecord) => r.humanStance || r.stance || "no_aplica";
  const effectiveNarrative = (r: LabeledRecord) => r.humanNarrative || r.narrative || "otra";

  // Sentimiento ponderado
  const sentWeights = { positive: 0, neutral: 0, negative: 0 };
  for (const r of filtered) {
    const s = effectiveSentiment(r);
    const w = r.weight || 1;
    if (s === "positive") sentWeights.positive += w;
    else if (s === "negative") sentWeights.negative += w;
    else sentWeights.neutral += w;
  }

  const sentiment =
    totalWeight > 0
      ? {
          positive: Math.round((sentWeights.positive / totalWeight) * 100),
          neutral: Math.round((sentWeights.neutral / totalWeight) * 100),
          negative: Math.round((sentWeights.negative / totalWeight) * 100),
        }
      : { positive: 0, neutral: 0, negative: 0 };

  // Stance con MoE 95%
  let noAplica = 0;
  let favor = 0;
  let contra = 0;
  let ambigua = 0;
  for (const r of filtered) {
    const st = effectiveStance(r);
    const w = r.weight || 1;
    if (st === "favor") favor += w;
    else if (st === "contra") contra += w;
    else if (st === "ambigua") ambigua += w;
    else noAplica += w;
  }
  const nBase = favor + contra + ambigua;
  const makeCell = (val: number): StanceCell => {
    const p = nBase > 0 ? val / nBase : 0;
    return {
      share: Math.round(p * 1000) / 10,
      count: Math.round(val),
      moe: marginOfError95(p, nBase),
    };
  };

  // Narrativas ponderadas
  const narrativeMap = new Map<string, number>();
  for (const r of filtered) {
    const nar = effectiveNarrative(r);
    narrativeMap.set(nar, (narrativeMap.get(nar) || 0) + (r.weight || 1));
  }
  const narrativeCounts = [...narrativeMap.entries()].map(([id, wCount]) => {
    const p = totalWeight > 0 ? wCount / totalWeight : 0;
    return {
      id,
      count: Math.round(wCount),
      share: Math.round(p * 1000) / 10,
      moe: marginOfError95(p, nEff),
    };
  });

  // Emociones
  const emotionMap = new Map<string, number>();
  for (const r of filtered) {
    const emo = r.emotion || "neutral";
    emotionMap.set(emo, (emotionMap.get(emo) || 0) + (r.weight || 1));
  }
  const emotions = [...emotionMap.entries()]
    .map(([key, count]) => ({
      key,
      count: Math.round(count),
      share: totalWeight > 0 ? Math.round((count / totalWeight) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRecords: filtered.length,
    effectiveSampleSize: Math.round(nEff * 10) / 10,
    sentiment,
    stance: {
      total: Math.round(totalWeight),
      no_aplica: Math.round(noAplica),
      n_base: Math.round(nBase),
      favor: makeCell(favor),
      contra: makeCell(contra),
      ambigua: makeCell(ambigua),
    },
    narrativeCounts,
    emotions,
  };
}
