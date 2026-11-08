import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_AREAS,
  REASSESSMENT_DAYS,
  areaPercents,
  compareAreas,
  latestBaseline,
  latestReassessment,
  lowAreas,
  recommendLevel,
  recommendedLevels,
  reassessmentStatus,
} from './assessment';
import type { AssessmentRecord, ResultRecord } from './db';

const DAY = 86400000;

function res(area: string, score: number, level = 1, at = 1): ResultRecord {
  return {
    id: `${area}${Math.random()}`,
    sessionId: 's',
    profileId: 'p',
    activityId: 'a',
    itemId: 'i',
    target: 't',
    area,
    level,
    rating: score === 1 ? 'full' : score === 0.5 ? 'help' : 'not_yet',
    score,
    at,
  };
}

function assessment(kind: 'baseline' | 'reassessment', completedAt?: number): AssessmentRecord {
  return { id: `${kind}${completedAt}`, profileId: 'p', kind, createdAt: 0, completedAt, sessionId: 's', ageYears: 4, items: [] };
}

describe('áreas', () => {
  it('son las 7 del brief', () => {
    expect(ASSESSMENT_AREAS.map((a) => a.id)).toEqual(['receptivo', 'expresivo', 'ordenes', 'conceptos', 'frases', 'fonemas', 'discriminacion']);
  });
});

describe('areaPercents', () => {
  it('Lo logró=1, Con ayuda=0.5, Aún no=0, redondeado', () => {
    const p = areaPercents([res('receptivo', 1), res('receptivo', 0.5), res('receptivo', 0), res('frases', 1)]);
    expect(p).toEqual({ receptivo: 50, frases: 100 });
  });
  it('sin resultados no inventa áreas', () => {
    expect(areaPercents([])).toEqual({});
  });
});

describe('recommendLevel', () => {
  it('con nivel 2: >= 60 % lo recomienda', () => {
    expect(recommendLevel(1, 0.6)).toBe(2);
    expect(recommendLevel(1, 0.59)).toBe(1);
    expect(recommendLevel(0.2, 0.8)).toBe(2);
  });
  it('solo nivel 1: >= 75 % para subir', () => {
    expect(recommendLevel(0.75, null)).toBe(2);
    expect(recommendLevel(0.74, null)).toBe(1);
    expect(recommendLevel(null, null)).toBe(1);
  });
});

describe('recommendedLevels', () => {
  it('asigna el nivel del área a cada actividad que le corresponde, sin pasar el máximo', () => {
    const results = [
      res('expresivo', 1, 1),
      res('expresivo', 1, 1),
      res('expresivo', 1, 2),
      res('expresivo', 0.5, 2),
      res('receptivo', 0, 1),
      res('receptivo', 0.5, 1),
      res('receptivo', 0, 2),
    ];
    const out = recommendedLevels(results, { 'que-es-esto': 2, onomatopeyas: 2, 'escucha-senala': 2 });
    expect(out['que-es-esto']).toBe(2);
    expect(out.onomatopeyas).toBe(2);
    expect(out['escucha-senala']).toBe(1);
    expect(recommendedLevels(results, { 'que-es-esto': 1, onomatopeyas: 1 })['que-es-esto']).toBe(1);
  });
  it('las áreas sin resultados no se tocan', () => {
    expect(recommendedLevels([res('frases', 1, 1), res('frases', 1, 2)], {})).toEqual({ 'arma-frase': 2 });
  });
  it('fonemas (solo nivel 1) usa el umbral de 75 %', () => {
    const good = recommendedLevels([res('fonemas', 1), res('fonemas', 1), res('fonemas', 0.5), res('fonemas', 1)], {});
    expect(good['palabras-fonema']).toBe(2); // 87.5 %
    const low = recommendedLevels([res('fonemas', 1), res('fonemas', 0), res('fonemas', 0.5), res('fonemas', 1)], {});
    expect(low['palabras-fonema']).toBe(1); // 62.5 %
  });
});

describe('compareAreas', () => {
  it('calcula la diferencia y deja null si falta un lado', () => {
    const rows = compareAreas({ receptivo: 50, frases: 40 }, { receptivo: 75 });
    const byId = Object.fromEntries(rows.map((r) => [r.area, r]));
    expect(byId.receptivo).toMatchObject({ baseline: 50, current: 75, delta: 25 });
    expect(byId.frases).toMatchObject({ baseline: 40, current: null, delta: null });
    expect(byId.fonemas).toMatchObject({ baseline: null, current: null, delta: null });
    expect(rows).toHaveLength(7);
  });
  it('una baja se ve como diferencia negativa', () => {
    expect(compareAreas({ ordenes: 80 }, { ordenes: 60 }).find((r) => r.area === 'ordenes')!.delta).toBe(-20);
  });
});

describe('reassessmentStatus', () => {
  const t0 = 1_000_000_000_000;
  it('sin evaluaciones completadas: none (una a medias no cuenta)', () => {
    expect(reassessmentStatus([], t0)).toEqual({ state: 'none' });
    expect(reassessmentStatus([assessment('baseline')], t0)).toEqual({ state: 'none' });
  });
  it('antes de 4 semanas: ok con los días que faltan', () => {
    const s = reassessmentStatus([assessment('baseline', t0)], t0 + 10 * DAY);
    expect(s).toMatchObject({ state: 'ok', daysLeft: REASSESSMENT_DAYS - 10 });
  });
  it('a las 4 semanas exactas ya toca; después cuenta el retraso', () => {
    expect(reassessmentStatus([assessment('baseline', t0)], t0 + REASSESSMENT_DAYS * DAY).state).toBe('due');
    expect(reassessmentStatus([assessment('baseline', t0)], t0 + (REASSESSMENT_DAYS + 5) * DAY)).toMatchObject({ state: 'due', daysOverdue: 5 });
  });
  it('se cuenta desde la última evaluación completada, no desde la inicial', () => {
    const list = [assessment('baseline', t0), assessment('reassessment', t0 + 30 * DAY)];
    expect(reassessmentStatus(list, t0 + 40 * DAY).state).toBe('ok');
  });
});

describe('latestBaseline / latestReassessment', () => {
  const b1 = assessment('baseline', 100);
  const b2 = assessment('baseline', 300);
  const r1 = assessment('reassessment', 200);
  const r2 = assessment('reassessment', 400);
  const partial = assessment('reassessment');
  it('elige la más reciente completada de cada tipo', () => {
    expect(latestBaseline([b1, b2, r1])).toBe(b2);
    expect(latestReassessment([b1, r1, r2, partial])).toBe(r2);
  });
  it('ignora las incompletas y devuelve undefined si no hay', () => {
    expect(latestBaseline([assessment('baseline')])).toBeUndefined();
    expect(latestReassessment([b1])).toBeUndefined();
  });
});

describe('lowAreas', () => {
  it('avisa solo si 2 o más áreas están bajo 40 %', () => {
    expect(lowAreas({ receptivo: 30, frases: 20, ordenes: 90 })).toEqual(['receptivo', 'frases']);
    expect(lowAreas({ receptivo: 30, frases: 60 })).toEqual([]);
    expect(lowAreas({ receptivo: 40, frases: 40 })).toEqual([]);
    expect(lowAreas({})).toEqual([]);
  });
});
