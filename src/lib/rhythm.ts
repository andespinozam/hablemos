/** Ritmos de golpes cortos (s) y largos (l), y la lógica de contar sílabas con palmadas. */
import { shuffle, type Rng } from './random';

export type Beat = 's' | 'l';
export type Pattern = readonly Beat[];

export const SHORT_MS = 180;
export const LONG_MS = 560;
export const GAP_MS = 240;

export interface ScheduledBeat {
  /** Inicio en ms. */
  at: number;
  /** Duración en ms. */
  dur: number;
}

export function rhythmSchedule(pattern: Pattern): ScheduledBeat[] {
  const out: ScheduledBeat[] = [];
  let t = 0;
  for (const beat of pattern) {
    const dur = beat === 's' ? SHORT_MS : LONG_MS;
    out.push({ at: t, dur });
    t += dur + GAP_MS;
  }
  return out;
}

export function rhythmDuration(pattern: Pattern): number {
  const s = rhythmSchedule(pattern);
  const last = s[s.length - 1];
  return last ? last.at + last.dur : 0;
}

/** Todos los patrones de `length` golpes. */
export function allPatterns(length: number): Beat[][] {
  const out: Beat[][] = [[]];
  for (let i = 0; i < length; i++) {
    const next: Beat[][] = [];
    for (const p of out) {
      next.push([...p, 's'], [...p, 'l']);
    }
    out.length = 0;
    out.push(...next);
  }
  return out;
}

function differences(a: Pattern, b: Pattern): number {
  return a.reduce((n, x, i) => n + (x === b[i] ? 0 : 1), 0);
}

/** Un ritmo al azar con al menos un golpe corto y uno largo. */
export function randomPattern(length: number, rng: Rng): Beat[] {
  const candidates = allPatterns(length).filter((p) => p.includes('s') && p.includes('l'));
  return shuffle(candidates, rng)[0];
}

/**
 * Distractores del mismo largo. Nivel 1: lo más distintos posible; nivel 2: difieren en un solo golpe.
 */
export function rhythmDistractors(correct: Pattern, level: number, count: number, rng: Rng): Beat[][] {
  const others = allPatterns(correct.length).filter((p) => differences(p, correct) > 0);
  const wantClose = level >= 2;
  const ranked = shuffle(others, rng).sort((a, b) => {
    const da = differences(a, correct);
    const db = differences(b, correct);
    return wantClose ? da - db : db - da;
  });
  return ranked.slice(0, count);
}

export type ClapVerdict = 'correct' | 'retry' | 'reveal';

/** Máximo de intentos antes de mostrar la respuesta contando juntos. */
export const MAX_CLAP_ATTEMPTS = 2;

/**
 * @param attempt intento actual contando desde 1
 * Nunca hay castigo: tras fallar se reintenta y, a la segunda, se muestra la respuesta.
 */
export function evaluateClaps(claps: number, expected: number, attempt: number): ClapVerdict {
  if (claps === expected) return 'correct';
  return attempt >= MAX_CLAP_ATTEMPTS ? 'reveal' : 'retry';
}
