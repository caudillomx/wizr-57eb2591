export const ANALYSIS_STALL_MS = 10 * 60_000;
export const LEASE_MS = 3 * 60_000;
export const MIN_COVERAGE = 0.8;
export const CLASSIFY_BATCH = 25;
export const CLASSIFY_CONCURRENCY = 3;
export const BATCH_MAX_ATTEMPTS = 3;
export const SAMPLE_MAX = 2000;
export const SYNTH_MAX = 400;
export const VALIDATION_SAMPLE_TARGET = 175; // Submuestra aleatoria 150-200 registros (Paso 9 v2.1)

export const ANALYSIS_STALLED_MESSAGE =
  "El análisis se detuvo sin progreso durante más de 10 minutos. Puedes reintentarlo.";

export function meetsCoverage(classified: number, requested: number): boolean {
  if (requested <= 0) return false;
  return classified / requested >= MIN_COVERAGE;
}
