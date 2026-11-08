/**
 * Plan de la evaluación inicial (~15 min): ítems de cada área, mezclando nivel 1 y nivel 2
 * para poder recomendar el nivel de partida. Se guarda completo en la base de datos para
 * que la reevaluación use exactamente los mismos ítems.
 */
import { getActivity } from '../activities/registry';
import { phonemeItem } from '../activities/phonemeWords';
import type { BuildContext, Item } from '../activities/types';
import { ASSESSMENT_AREAS } from './assessment';
import type { AssessmentItem } from './db';
import { eligiblePhonemes, pickWords } from './phonemes';
import { shuffle, type Rng } from './random';

/** Ítems por área: [nivel 1, nivel 2]. Fonemas se arma aparte (uno por fonema de la edad). */
export const ITEMS_PER_AREA: Record<string, [number, number]> = {
  receptivo: [2, 2],
  expresivo: [2, 2],
  ordenes: [2, 2],
  conceptos: [2, 2],
  frases: [2, 2],
  discriminacion: [3, 3],
};

/** Cuántos fonemas distintos se exploran (una palabra de cada uno). */
export const PHONEME_SCREENING_COUNT = 8;

function tag(item: Item, level: number, area: string): Item {
  // El id lleva el área y el nivel: la misma palabra puede salir en dos áreas o en los dos niveles.
  return { ...item, id: `${area}/${item.id}@${level}`, level };
}

/** Un ítem por cada uno de varios fonemas de la edad (sin avanzados). */
export function phonemeScreening(age: number, count: number, rng: Rng): Item[] {
  const eligible = eligiblePhonemes(age, 1, {}).filter((p) => !p.advanced);
  return shuffle(eligible, rng)
    .slice(0, count)
    .map((ph) => tag(phonemeItem(ph, pickWords(ph, 1, 1, rng)[0]), 1, 'fonemas'));
}

/** Arma la evaluación inicial para un niño de `age` años. */
export function buildAssessmentPlan(age: number, rng: Rng): AssessmentItem[] {
  const ctx: BuildContext = { age, phonemes: {} };
  const out: AssessmentItem[] = [];
  for (const area of ASSESSMENT_AREAS) {
    const activity = getActivity(area.activityId);
    if (!activity) continue;
    if (area.id === 'fonemas') {
      for (const item of phonemeScreening(age, PHONEME_SCREENING_COUNT, rng)) {
        out.push({ area: area.id, activityId: activity.id, level: 1, item });
      }
      continue;
    }
    const [n1, n2] = ITEMS_PER_AREA[area.id];
    for (const [level, n] of [
      [1, n1],
      [2, n2],
    ] as const) {
      for (const item of activity.buildItems(level, n, rng, ctx).slice(0, n)) {
        out.push({ area: area.id, activityId: activity.id, level, item: tag(item, level, area.id) });
      }
    }
  }
  return out;
}

/**
 * Reevaluación: los mismos ítems en otro orden. Se mezclan los ítems dentro de cada área y también
 * el orden de las áreas, pero cada área queda junta (cada una abre con su propia introducción).
 */
export function shuffleForReassessment(items: readonly AssessmentItem[], rng: Rng): AssessmentItem[] {
  const byArea = new Map<string, AssessmentItem[]>();
  for (const it of items) {
    const list = byArea.get(it.area) ?? [];
    list.push(it);
    byArea.set(it.area, list);
  }
  return shuffle([...byArea.values()], rng).flatMap((list) => shuffle(list, rng));
}

/** Agrupa ítems consecutivos de la misma actividad en pasos para el motor de sesiones. */
export function groupIntoSteps(items: readonly AssessmentItem[]): { activityId: string; items: AssessmentItem[] }[] {
  const steps: { activityId: string; items: AssessmentItem[] }[] = [];
  for (const it of items) {
    const last = steps[steps.length - 1];
    if (last && last.activityId === it.activityId) last.items.push(it);
    else steps.push({ activityId: it.activityId, items: [it] });
  }
  return steps;
}

/** Ítems totales de una evaluación (para estimar la duración). */
export function planSize(): number {
  return ASSESSMENT_AREAS.reduce((n, a) => n + (a.id === 'fonemas' ? PHONEME_SCREENING_COUNT : ITEMS_PER_AREA[a.id].reduce((x, y) => x + y, 0)), 0);
}

