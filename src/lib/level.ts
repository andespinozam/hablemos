import type { ResultRecord } from './db';

/** Sube de nivel con >= 80 % en 3 sesiones seguidas; baja o repite con < 40 %. */
export const UP_THRESHOLD = 0.8;
export const DOWN_THRESHOLD = 0.4;
export const SESSIONS_TO_LEVEL_UP = 3;
/** Una sesión cuenta para adaptar solo si la actividad tuvo al menos estos ítems. */
export const MIN_ITEMS_FOR_ADAPT = 3;

export type LevelChange = 'up' | 'down' | 'repeat' | 'same';
export interface LevelOutcome {
  level: number;
  change: LevelChange;
}

/**
 * @param level nivel actual (1..maxLevel)
 * @param sessionRatios proporción 0..1 de cada sesión hecha en ESTE nivel, de la más antigua a la más reciente
 */
export function adaptLevel(level: number, sessionRatios: readonly number[], maxLevel: number): LevelOutcome {
  const last = sessionRatios[sessionRatios.length - 1];
  if (last !== undefined && last < DOWN_THRESHOLD) {
    return level > 1 ? { level: level - 1, change: 'down' } : { level, change: 'repeat' };
  }
  const recent = sessionRatios.slice(-SESSIONS_TO_LEVEL_UP);
  const earned = recent.length === SESSIONS_TO_LEVEL_UP && recent.every((r) => r >= UP_THRESHOLD);
  if (earned && level < maxLevel) return { level: level + 1, change: 'up' };
  return { level, change: 'same' };
}

/** Proporciones por sesión de una actividad en un nivel, ordenadas por tiempo. Ignora sesiones con pocos ítems. */
export function sessionRatios(
  results: readonly ResultRecord[],
  activityId: string,
  level: number,
  minItems = MIN_ITEMS_FOR_ADAPT,
): number[] {
  const groups = new Map<string, ResultRecord[]>();
  for (const r of results) {
    if (r.activityId !== activityId || r.level !== level) continue;
    const list = groups.get(r.sessionId) ?? [];
    list.push(r);
    groups.set(r.sessionId, list);
  }
  return [...groups.values()]
    .filter((list) => list.length >= minItems)
    .map((list) => ({
      at: Math.min(...list.map((r) => r.at)),
      ratio: list.reduce((sum, r) => sum + r.score, 0) / list.length,
    }))
    .sort((a, b) => a.at - b.at)
    .map((g) => g.ratio);
}
