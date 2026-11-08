import { describe, expect, it } from 'vitest';
import {
  GAP_MS,
  LONG_MS,
  MAX_CLAP_ATTEMPTS,
  SHORT_MS,
  allPatterns,
  evaluateClaps,
  randomPattern,
  rhythmDistractors,
  rhythmDuration,
  rhythmSchedule,
  type Beat,
} from './rhythm';
import { seeded } from './random';
import { summarizePhonemes } from './phonemeStats';
import type { ResultRecord } from './db';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const diff = (a: readonly Beat[], b: readonly Beat[]) => a.filter((x, i) => x !== b[i]).length;

describe('rhythmSchedule', () => {
  it('cada golpe empieza tras el anterior más la pausa', () => {
    expect(rhythmSchedule(['s', 'l', 's'])).toEqual([
      { at: 0, dur: SHORT_MS },
      { at: SHORT_MS + GAP_MS, dur: LONG_MS },
      { at: SHORT_MS + GAP_MS + LONG_MS + GAP_MS, dur: SHORT_MS },
    ]);
  });
  it('la duración total termina con el último golpe, sin pausa final', () => {
    expect(rhythmDuration(['s', 's'])).toBe(SHORT_MS + GAP_MS + SHORT_MS);
    expect(rhythmDuration([])).toBe(0);
  });
});

describe('patrones', () => {
  it('allPatterns da 2^n patrones distintos', () => {
    expect(allPatterns(1)).toHaveLength(2);
    expect(allPatterns(3)).toHaveLength(8);
    expect(new Set(allPatterns(4).map((p) => p.join(''))).size).toBe(16);
  });
  it('randomPattern tiene el largo pedido y al menos un golpe corto y uno largo', () => {
    for (const seed of SEEDS) {
      for (const n of [2, 3, 4]) {
        const p = randomPattern(n, seeded(seed));
        expect(p).toHaveLength(n);
        expect(p).toContain('s');
        expect(p).toContain('l');
      }
    }
  });
  it('nivel 1: los distractores son lo más distintos posible; nivel 2: difieren en un solo golpe', () => {
    for (const seed of SEEDS) {
      const correct: Beat[] = ['s', 'l', 's'];
      const far = rhythmDistractors(correct, 1, 2, seeded(seed));
      const near = rhythmDistractors(correct, 2, 2, seeded(seed));
      expect(far).toHaveLength(2);
      expect(near).toHaveLength(2);
      expect(Math.min(...far.map((p) => diff(p, correct)))).toBeGreaterThanOrEqual(2);
      expect(near.every((p) => diff(p, correct) === 1)).toBe(true);
      for (const p of [...far, ...near]) expect(p.join('')).not.toBe(correct.join(''));
    }
  });
});

describe('evaluateClaps', () => {
  it('correcto cuando coincide, en cualquier intento', () => {
    expect(evaluateClaps(3, 3, 1)).toBe('correct');
    expect(evaluateClaps(2, 2, 2)).toBe('correct');
  });
  it('si no coincide, se reintenta y a la segunda vez se muestra la respuesta (sin castigo)', () => {
    expect(evaluateClaps(1, 3, 1)).toBe('retry');
    expect(evaluateClaps(5, 3, 1)).toBe('retry');
    expect(evaluateClaps(1, 3, MAX_CLAP_ATTEMPTS)).toBe('reveal');
    expect(evaluateClaps(0, 2, 2)).toBe('reveal');
  });
});

function result(phoneme: string | undefined, score: number, at: number): ResultRecord {
  return {
    id: String(at),
    sessionId: 's',
    profileId: 'p',
    activityId: 'a',
    itemId: String(at),
    target: 't',
    area: 'fonemas',
    phoneme,
    level: 1,
    rating: score === 1 ? 'full' : score === 0.5 ? 'help' : 'not_yet',
    score,
    at,
  };
}

describe('summarizePhonemes', () => {
  it('agrupa por fonema con n, promedio y última práctica; ignora lo que no trae fonema', () => {
    const out = summarizePhonemes([result('p', 1, 10), result('p', 0, 30), result('m', 0.5, 20), result(undefined, 1, 40)]);
    expect(out).toEqual({
      p: { n: 2, ratio: 0.5, last: 30 },
      m: { n: 1, ratio: 0.5, last: 20 },
    });
  });
  it('sin resultados devuelve un objeto vacío', () => {
    expect(summarizePhonemes([])).toEqual({});
  });
});
