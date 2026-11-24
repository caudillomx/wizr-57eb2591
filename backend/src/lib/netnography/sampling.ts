import crypto from "crypto";

export const CENSUS_THRESHOLD = 20_000;

export interface SamplingRecord {
  id: string;
  stratum: string; // plataforma o subestrato
  authorKey: string;
  text: string;
  url?: string | null;
  publishedAt?: Date | string | null;
  likes?: number;
  raw?: Record<string, any> | null;
}

export interface AuthenticityAssessment {
  flag: "organic" | "suspicious" | "coordinated";
  signals: string[];
}

/**
 * Seudonimización determinista (U-0001...) para particulares.
 */
export function buildPseudonymizer(publicFigures: Set<string> = new Set()) {
  const map = new Map<string, string>();
  let counter = 0;
  return (rawAuthor: string | null | undefined): { alias: string; hash: string } => {
    const clean = (rawAuthor || "anonimo").trim();
    const hash = crypto.createHash("sha256").update(clean.toLowerCase()).digest("hex").slice(0, 16);
    if (publicFigures.has(clean.toLowerCase())) {
      return { alias: clean, hash };
    }
    if (!map.has(hash)) {
      counter += 1;
      map.set(hash, `U-${String(counter).padStart(4, "0")}`);
    }
    return { alias: map.get(hash)!, hash };
  };
}

/**
 * Tamaño de muestra con 95% de confianza (Z=1.96, p=0.5) y corrección por población finita.
 */
export function calculateSampleSize(
  populationN: number,
  marginError: number = 0.05,
  oversampleFactor: number = 1.15
): number {
  if (populationN <= 0) return 0;
  if (populationN < CENSUS_THRESHOLD && populationN <= 500) return populationN;
  const Z = 1.96;
  const p = 0.5;
  const n0 = (Z * Z * p * (1 - p)) / (marginError * marginError);
  const nFinite = n0 / (1 + (n0 - 1) / populationN);
  const withBuffer = Math.ceil(nFinite * oversampleFactor);
  return Math.min(populationN, withBuffer);
}

/**
 * PRNG determinista (Mulberry32) para garantizar muestras reproducibles con semilla.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Detección de copias coordinadas y cuentas sospechosas (Fase 4 v2.1).
 */
export function assessAuthenticity(records: SamplingRecord[]): Map<string, AuthenticityAssessment> {
  const result = new Map<string, AuthenticityAssessment>();
  const textAuthors = new Map<string, Set<string>>();

  for (const r of records) {
    const norm = r.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (norm.length >= 25) {
      if (!textAuthors.has(norm)) textAuthors.set(norm, new Set());
      textAuthors.get(norm)!.add(r.authorKey);
    }
  }

  for (const r of records) {
    const signals: string[] = [];
    const norm = r.text.toLowerCase().replace(/\s+/g, " ").trim();
    const sharedCount = textAuthors.get(norm)?.size || 0;
    if (sharedCount >= 3) {
      signals.push(`copia_coordinada_${sharedCount}_cuentas`);
    }

    // Heurísticas de cuenta sospechosa: nombre con >= 4 dígitos seguidos o sin avatar/perfil mínimo
    if (/\d{4,}$/.test(r.authorKey) || /^[a-z]+\d{5,}$/i.test(r.authorKey)) {
      signals.push("usuario_patron_numerico");
    }
    if (r.raw && r.raw.authorProfileIncomplete) {
      signals.push("perfil_incompleto");
    }

    let flag: "organic" | "suspicious" | "coordinated" = "organic";
    if (sharedCount >= 3) {
      flag = "coordinated";
    } else if (signals.length >= 2) {
      flag = "suspicious";
    }
    result.set(r.id, { flag, signals });
  }

  return result;
}

export interface StratifiedSampleResult {
  selectedIds: Set<string>;
  weightsById: Map<string, number>;
  effectiveSampleSize: number;
  isCensus: boolean;
  stratumSummary: Array<{
    stratum: string;
    populationN: number;
    sampleN: number;
    weight: number;
  }>;
}

/**
 * Muestreo aleatorio estratificado por plataforma/estrato con tope por autor (3-5) y ponderación w_h.
 */
export function drawStratifiedSample(
  records: SamplingRecord[],
  options: {
    maxTotal?: number;
    maxPerAuthorPerStratum?: number;
    seed?: number;
    marginError?: number;
  } = {}
): StratifiedSampleResult {
  const maxTotal = options.maxTotal ?? 2000;
  const maxPerAuthor = options.maxPerAuthorPerStratum ?? 4;
  const rng = seededRandom(options.seed ?? 20261123);
  const marginError = options.marginError ?? 0.05;

  const N = records.length;
  const selectedIds = new Set<string>();
  const weightsById = new Map<string, number>();

  if (N === 0) {
    return { selectedIds, weightsById, effectiveSampleSize: 0, isCensus: true, stratumSummary: [] };
  }

  // Agrupar por estrato
  const byStratum = new Map<string, SamplingRecord[]>();
  for (const r of records) {
    const key = r.stratum || "general";
    if (!byStratum.has(key)) byStratum.set(key, []);
    byStratum.get(key)!.push(r);
  }

  // Si es menor a maxTotal y < CENSUS_THRESHOLD -> censo directo (peso 1)
  if (N <= maxTotal && N < CENSUS_THRESHOLD) {
    for (const r of records) {
      selectedIds.add(r.id);
      weightsById.set(r.id, 1);
    }
    const stratumSummary = [...byStratum.entries()].map(([stratum, items]) => ({
      stratum,
      populationN: items.length,
      sampleN: items.length,
      weight: 1,
    }));
    return {
      selectedIds,
      weightsById,
      effectiveSampleSize: N,
      isCensus: true,
      stratumSummary,
    };
  }

  const targetTotal = Math.min(maxTotal, calculateSampleSize(N, marginError, 1.15));
  const stratumCounts = new Map<string, number>();

  // Asignación proporcional con piso de 100 por estrato si alcanza y respeta targetTotal
  for (const [stratum, items] of byStratum.entries()) {
    const prop = Math.round((items.length / N) * targetTotal);
    const floor = Math.min(items.length, Math.min(100, Math.floor(targetTotal / byStratum.size)));
    const desired = Math.min(items.length, Math.max(floor, prop));
    stratumCounts.set(stratum, desired);
  }

  // Ajustar si el piso hizo superar targetTotal
  let sumDesired = [...stratumCounts.values()].reduce((a, b) => a + b, 0);
  if (sumDesired > targetTotal) {
    const sorted = [...stratumCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [stratum, val] of sorted) {
      if (sumDesired <= targetTotal) break;
      const excess = Math.min(val - 1, sumDesired - targetTotal);
      if (excess > 0) {
        stratumCounts.set(stratum, val - excess);
        sumDesired -= excess;
      }
    }
  }

  // Sortear dentro de cada estrato respetando tope por autor
  const sampledByStratum = new Map<string, SamplingRecord[]>();
  for (const [stratum, items] of byStratum.entries()) {
    const desired = stratumCounts.get(stratum) || items.length;
    const shuffled = [...items]
      .map((item) => ({ item, rand: rng() }))
      .sort((a, b) => a.rand - b.rand)
      .map((x) => x.item);

    const authorCounts = new Map<string, number>();
    const picked: SamplingRecord[] = [];
    for (const item of shuffled) {
      if (picked.length >= desired) break;
      const count = authorCounts.get(item.authorKey) || 0;
      if (count >= maxPerAuthor) continue;
      authorCounts.set(item.authorKey, count + 1);
      picked.push(item);
    }
    sampledByStratum.set(stratum, picked);
  }

  const totalSampled = [...sampledByStratum.values()].reduce((acc, xs) => acc + xs.length, 0);
  const stratumSummary: StratifiedSampleResult["stratumSummary"] = [];
  let sumW = 0;
  let sumW2 = 0;

  for (const [stratum, picked] of sampledByStratum.entries()) {
    const Nh = byStratum.get(stratum)!.length;
    const nh = picked.length;
    const wh = nh > 0 && totalSampled > 0 ? (Nh / N) / (nh / totalSampled) : 1;
    const roundedWeight = Math.round(wh * 1000) / 1000;
    for (const item of picked) {
      selectedIds.add(item.id);
      weightsById.set(item.id, roundedWeight);
      sumW += roundedWeight;
      sumW2 += roundedWeight * roundedWeight;
    }
    stratumSummary.push({
      stratum,
      populationN: Nh,
      sampleN: nh,
      weight: roundedWeight,
    });
  }

  const effectiveSampleSize = sumW2 > 0 ? Math.round(((sumW * sumW) / sumW2) * 10) / 10 : totalSampled;

  return {
    selectedIds,
    weightsById,
    effectiveSampleSize,
    isCensus: false,
    stratumSummary,
  };
}
