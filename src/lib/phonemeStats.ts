import type { ResultRecord } from './db';

export interface PhonemeStat {
  /** Cuántos ítems se han trabajado. */
  n: number;
  /** Promedio 0..1 (Lo logró = 1, Con ayuda = 0.5, Aún no = 0). */
  ratio: number;
  /** Última práctica (ms). */
  last: number;
}

/** Resumen por fonema de todos los resultados que traen `phoneme`. */
export function summarizePhonemes(results: readonly ResultRecord[]): Record<string, PhonemeStat> {
  const sums: Record<string, { n: number; score: number; last: number }> = {};
  for (const r of results) {
    if (!r.phoneme) continue;
    const s = (sums[r.phoneme] ??= { n: 0, score: 0, last: 0 });
    s.n += 1;
    s.score += r.score;
    s.last = Math.max(s.last, r.at);
  }
  return Object.fromEntries(Object.entries(sums).map(([id, s]) => [id, { n: s.n, ratio: s.score / s.n, last: s.last }]));
}
