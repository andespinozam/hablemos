/** Áreas, nivel recomendado y comparación de las evaluaciones. Lógica pura. */
import type { AssessmentRecord, ResultRecord } from './db';

export interface AssessmentArea {
  id: string;
  label: string;
  /** Actividad que se usa para evaluar el área. */
  activityId: string;
  /** Actividades de práctica cuyo nivel inicial se ajusta con el resultado de esta área. */
  levelFor: string[];
}

/** Las 7 áreas de la evaluación (brief), en el orden en que se aplican. */
export const ASSESSMENT_AREAS: readonly AssessmentArea[] = [
  { id: 'receptivo', label: 'Vocabulario receptivo', activityId: 'escucha-senala', levelFor: ['escucha-senala'] },
  { id: 'expresivo', label: 'Vocabulario expresivo', activityId: 'que-es-esto', levelFor: ['que-es-esto', 'onomatopeyas'] },
  { id: 'ordenes', label: 'Órdenes', activityId: 'sigue-orden', levelFor: ['sigue-orden'] },
  { id: 'conceptos', label: 'Conceptos', activityId: 'conceptos', levelFor: ['conceptos', 'categorias'] },
  { id: 'frases', label: 'Frases', activityId: 'arma-frase', levelFor: ['arma-frase'] },
  { id: 'fonemas', label: 'Fonemas (según la edad)', activityId: 'palabras-fonema', levelFor: ['palabras-fonema'] },
  { id: 'discriminacion', label: 'Discriminación auditiva', activityId: 'discriminacion', levelFor: ['discriminacion'] },
];

/** Etiquetas de todas las áreas que se registran (incluye las que no se evalúan al inicio). */
export const AREA_LABELS: Record<string, string> = {
  ...Object.fromEntries(ASSESSMENT_AREAS.map((a) => [a.id, a.label])),
  praxias: 'Praxias orofaciales',
  narrativa: 'Comprensión de cuentos',
};

export const REASSESSMENT_DAYS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Porcentaje entero 0..100 por área (null si no hay datos). */
export function areaPercents(results: readonly ResultRecord[]): Record<string, number | null> {
  const sums: Record<string, { n: number; score: number }> = {};
  for (const r of results) {
    const s = (sums[r.area] ??= { n: 0, score: 0 });
    s.n += 1;
    s.score += r.score;
  }
  return Object.fromEntries(Object.entries(sums).map(([area, s]) => [area, Math.round((s.score / s.n) * 100)]));
}

function ratioOf(results: readonly ResultRecord[]): number | null {
  if (results.length === 0) return null;
  return results.reduce((sum, r) => sum + r.score, 0) / results.length;
}

/**
 * Nivel inicial recomendado para un área. Con ítems de los dos niveles: nivel 2 si el logro en el
 * nivel 2 es >= 60 %. Si solo hubo nivel 1 (p. ej. fonemas): nivel 2 si el logro es >= 75 %.
 */
export function recommendLevel(l1: number | null, l2: number | null): 1 | 2 {
  if (l2 !== null) return l2 >= 0.6 ? 2 : 1;
  return l1 !== null && l1 >= 0.75 ? 2 : 1;
}

/** Nivel recomendado por actividad según los resultados de una evaluación inicial. */
export function recommendedLevels(
  results: readonly ResultRecord[],
  maxLevels: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const area of ASSESSMENT_AREAS) {
    const mine = results.filter((r) => r.area === area.id);
    if (mine.length === 0) continue;
    const l1 = ratioOf(mine.filter((r) => r.level === 1));
    const l2 = ratioOf(mine.filter((r) => r.level >= 2));
    const level = recommendLevel(l1, l2);
    for (const activityId of area.levelFor) out[activityId] = Math.min(level, maxLevels[activityId] ?? level);
  }
  return out;
}

export interface AreaComparison {
  area: string;
  label: string;
  baseline: number | null;
  current: number | null;
  /** current - baseline, o null si falta alguno. */
  delta: number | null;
}

export function compareAreas(
  baseline: Record<string, number | null>,
  current: Record<string, number | null>,
): AreaComparison[] {
  return ASSESSMENT_AREAS.map((a) => {
    const b = baseline[a.id] ?? null;
    const c = current[a.id] ?? null;
    return { area: a.id, label: a.label, baseline: b, current: c, delta: b !== null && c !== null ? c - b : null };
  });
}

export type ReassessmentState =
  | { state: 'none' }
  | { state: 'ok'; lastAt: number; dueAt: number; daysLeft: number }
  | { state: 'due'; lastAt: number; dueAt: number; daysOverdue: number };

/** Las evaluaciones se sugieren cada 4 semanas, contando desde la última completada. */
export function reassessmentStatus(assessments: readonly AssessmentRecord[], now: number): ReassessmentState {
  const done = assessments.filter((a) => a.completedAt !== undefined);
  if (done.length === 0) return { state: 'none' };
  const lastAt = Math.max(...done.map((a) => a.completedAt!));
  const dueAt = lastAt + REASSESSMENT_DAYS * DAY_MS;
  if (now >= dueAt) return { state: 'due', lastAt, dueAt, daysOverdue: Math.floor((now - dueAt) / DAY_MS) };
  return { state: 'ok', lastAt, dueAt, daysLeft: Math.ceil((dueAt - now) / DAY_MS) };
}

/** Evaluación inicial completada más reciente, si hay. */
export function latestBaseline(assessments: readonly AssessmentRecord[]): AssessmentRecord | undefined {
  return [...assessments]
    .filter((a) => a.kind === 'baseline' && a.completedAt !== undefined)
    .sort((a, b) => b.completedAt! - a.completedAt!)[0];
}

/** Última evaluación completada que no es la inicial (la reevaluación más reciente). */
export function latestReassessment(assessments: readonly AssessmentRecord[]): AssessmentRecord | undefined {
  return [...assessments]
    .filter((a) => a.kind === 'reassessment' && a.completedAt !== undefined)
    .sort((a, b) => b.completedAt! - a.completedAt!)[0];
}

/**
 * Aviso orientativo (no diagnóstico): varias áreas con logro bajo en una evaluación.
 * Devuelve las áreas con menos de 40 % si son 2 o más.
 */
export function lowAreas(percents: Record<string, number | null>): string[] {
  const low = ASSESSMENT_AREAS.filter((a) => {
    const p = percents[a.id];
    return p !== null && p !== undefined && p < 40;
  }).map((a) => a.id);
  return low.length >= 2 ? low : [];
}
