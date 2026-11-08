import { describe, expect, it } from 'vitest';
import { adaptLevel, sessionRatios } from './level';
import { shuffle } from './random';
import { percent, ratio, scoreOf } from './scoring';
import { planSession } from './sessionPlan';
import type { ResultRecord } from './db';

describe('puntaje', () => {
  it('Lo logró=1, Con ayuda=0.5, Aún no=0', () => {
    expect(scoreOf('full')).toBe(1);
    expect(scoreOf('help')).toBe(0.5);
    expect(scoreOf('not_yet')).toBe(0);
  });
  it('promedia y redondea', () => {
    expect(ratio(['full', 'help', 'not_yet'])).toBe(0.5);
    expect(percent(['full', 'full', 'help'])).toBe(83);
    expect(percent([])).toBeNull();
  });
});

describe('adaptLevel', () => {
  it('sube con >=80% en 3 sesiones seguidas', () => {
    expect(adaptLevel(1, [0.8, 0.9, 1], 3)).toEqual({ level: 2, change: 'up' });
  });
  it('no sube con 2 sesiones, con una floja en medio, ni en el nivel máximo', () => {
    expect(adaptLevel(1, [0.9, 0.9], 3).change).toBe('same');
    expect(adaptLevel(1, [0.9, 0.79, 0.9], 3).change).toBe('same');
    expect(adaptLevel(3, [1, 1, 1], 3)).toEqual({ level: 3, change: 'same' });
  });
  it('solo cuentan las 3 sesiones más recientes', () => {
    expect(adaptLevel(1, [0.5, 0.85, 0.9, 1], 3).change).toBe('up');
  });
  it('baja con <40% y repite si ya está en el nivel 1', () => {
    expect(adaptLevel(2, [0.9, 0.39], 3)).toEqual({ level: 1, change: 'down' });
    expect(adaptLevel(1, [0.2], 3)).toEqual({ level: 1, change: 'repeat' });
  });
  it('exactamente 40% no baja', () => {
    expect(adaptLevel(2, [0.4], 3).change).toBe('same');
  });
  it('sin historial no cambia nada', () => {
    expect(adaptLevel(2, [], 3)).toEqual({ level: 2, change: 'same' });
  });
});

function result(sessionId: string, at: number, score: number, level = 1, activityId = 'a'): ResultRecord {
  return {
    id: `${sessionId}-${at}`,
    sessionId,
    profileId: 'p',
    activityId,
    itemId: String(at),
    target: 't',
    area: 'x',
    level,
    rating: score === 1 ? 'full' : score === 0.5 ? 'help' : 'not_yet',
    score,
    at,
  };
}

describe('sessionRatios', () => {
  it('agrupa por sesión, filtra por actividad y nivel, y ordena por tiempo', () => {
    const rs = [
      result('s2', 20, 1),
      result('s2', 21, 1),
      result('s2', 22, 0),
      result('s1', 10, 1),
      result('s1', 11, 0.5),
      result('s1', 12, 0),
      result('s3', 30, 1, 2), // otro nivel
      result('s3', 31, 1, 2),
      result('s3', 32, 1, 2),
      result('s4', 40, 1, 1, 'otra'), // otra actividad
    ];
    expect(sessionRatios(rs, 'a', 1)).toEqual([0.5, 2 / 3]);
  });
  it('ignora sesiones con menos de 3 ítems', () => {
    expect(sessionRatios([result('s', 1, 0), result('s', 2, 0)], 'a', 1)).toEqual([]);
  });
});

describe('planSession', () => {
  const cands = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, minAge: 3 }));
  it('elige 3 o 4 actividades distintas', () => {
    for (const r of [0.1, 0.9]) {
      const ids = planSession(cands, { age: 4, lastPracticed: {} }, () => r);
      expect(ids.length).toBe(r < 0.5 ? 3 : 4);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it('prioriza las menos practicadas', () => {
    const ids = planSession(cands, { age: 4, lastPracticed: { a: 900, b: 800, c: 700, d: 100 } }, () => 0.1);
    expect(ids).toEqual(['e', 'd', 'c']); // e nunca practicada va primero
  });
  it('respeta la edad mínima y usa todas si hay pocas', () => {
    const mixed = [
      { id: 'x', minAge: 3 },
      { id: 'y', minAge: 5 },
    ];
    expect(planSession(mixed, { age: 3, lastPracticed: {} })).toEqual(['x']);
    expect(planSession(mixed, { age: 5, lastPracticed: {} }).sort()).toEqual(['x', 'y']);
  });
});

describe('shuffle', () => {
  it('conserva los elementos y no muta el original', () => {
    const src = [1, 2, 3, 4, 5];
    const out = shuffle(src, () => 0.3);
    expect([...out].sort()).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});
