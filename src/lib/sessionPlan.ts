import { shuffle, type Rng } from './random';

export const ITEMS_PER_ACTIVITY = 4;
export const MIN_ACTIVITIES = 3;
export const MAX_ACTIVITIES = 4;

export interface PlanCandidate {
  id: string;
  /** Edad mínima en años. */
  minAge: number;
}

export interface PlanContext {
  /** Edad del niño en años cumplidos. */
  age: number;
  /** Última práctica por actividad (ms); las nunca practicadas no aparecen. */
  lastPracticed: Record<string, number>;
}

/**
 * Elige 3-4 actividades distintas adecuadas para la edad, empezando por las menos
 * practicadas (las nuevas primero). Con pocas actividades disponibles, usa todas.
 */
export function planSession(
  candidates: readonly PlanCandidate[],
  ctx: PlanContext,
  rng: Rng = Math.random,
  /** Actividades que siempre entran si son elegibles (p. ej. la escalera de pronunciación). */
  must: readonly string[] = [],
): string[] {
  const eligible = candidates.filter((c) => c.minAge <= ctx.age);
  const wanted = rng() < 0.5 ? MIN_ACTIVITIES : MAX_ACTIVITIES;
  // Se mezcla antes para que el desempate entre iguales sea aleatorio (sort es estable).
  const forced = eligible.filter((c) => must.includes(c.id)).map((c) => c.id);
  const others = shuffle(eligible.filter((c) => !must.includes(c.id)), rng)
    .sort((a, b) => (ctx.lastPracticed[a.id] ?? 0) - (ctx.lastPracticed[b.id] ?? 0))
    .map((c) => c.id);
  return [...forced, ...others].slice(0, Math.max(wanted, forced.length));
}
