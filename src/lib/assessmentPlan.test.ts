import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { ASSESSMENT_AREAS } from './assessment';
import { buildAssessmentPlan, groupIntoSteps, phonemeScreening, planSize, shuffleForReassessment } from './assessmentPlan';
import { completeAssessment, createAssessment, getAssessment, hasBaseline, listAssessments } from './assessmentStore';
import { resetDbConnection } from './db';
import { getPhoneme } from './phonemes';
import { AVATARS, saveProfile } from './profiles';
import { addResult, applyAdaptation, getLevels, startSession } from './progress';
import { seeded } from './random';
import type { Rating } from './scoring';

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
const SEEDS = [1, 2, 3, 4, 5];

describe('buildAssessmentPlan', () => {
  it('cubre las 7 áreas, en orden, con la cantidad de ítems prevista (~34)', () => {
    for (const age of [3, 4, 5]) {
      const plan = buildAssessmentPlan(age, seeded(age));
      expect(plan).toHaveLength(planSize());
      expect(planSize()).toBe(34);
      const areas = [...new Set(plan.map((p) => p.area))];
      expect(areas).toEqual(ASSESSMENT_AREAS.map((a) => a.id));
    }
  });
  it('mezcla nivel 1 y nivel 2 en las áreas con dos niveles; fonemas solo nivel 1', () => {
    const plan = buildAssessmentPlan(4, seeded(1));
    for (const area of ASSESSMENT_AREAS) {
      const levels = new Set(plan.filter((p) => p.area === area.id).map((p) => p.level));
      expect([...levels].sort()).toEqual(area.id === 'fonemas' ? [1] : [1, 2]);
    }
  });
  it('los ids son únicos y llevan el nivel; cada ítem lleva su nivel', () => {
    for (const seed of SEEDS) {
      const plan = buildAssessmentPlan(4, seeded(seed));
      expect(unique(plan.map((p) => p.item.id))).toBe(true);
      for (const p of plan) {
        expect(p.item.id.endsWith(`@${p.level}`)).toBe(true);
        expect(p.item.level).toBe(p.level);
      }
    }
  });
  it('se puede guardar como JSON sin perder nada (para repetirla en la reevaluación)', () => {
    const plan = buildAssessmentPlan(5, seeded(3));
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });
  it('es reproducible con la misma semilla', () => {
    expect(buildAssessmentPlan(4, seeded(9))).toEqual(buildAssessmentPlan(4, seeded(9)));
  });
  it('la actividad de cada ítem corresponde a su área', () => {
    for (const p of buildAssessmentPlan(4, seeded(2))) {
      expect(ASSESSMENT_AREAS.find((a) => a.id === p.area)!.activityId).toBe(p.activityId);
    }
  });
});

describe('phonemeScreening', () => {
  it('8 fonemas distintos de la edad, sin avanzados, una palabra de cada uno', () => {
    for (const seed of SEEDS) {
      for (const age of [3, 4, 5]) {
        const items = phonemeScreening(age, 8, seeded(seed));
        expect(items).toHaveLength(8);
        const phs = items.map((i) => i.phoneme!);
        expect(unique(phs)).toBe(true);
        for (const id of phs) {
          expect(getPhoneme(id)!.age).toBeLessThanOrEqual(age);
          expect(getPhoneme(id)!.advanced).toBe(false);
        }
      }
    }
  });
  it('a los 3 años solo usa fonemas de 3 años', () => {
    for (const seed of SEEDS) for (const it of phonemeScreening(3, 8, seeded(seed))) expect(getPhoneme(it.phoneme!)!.age).toBe(3);
  });
});

describe('shuffleForReassessment', () => {
  const plan = buildAssessmentPlan(4, seeded(1));
  it('conserva exactamente los mismos ítems', () => {
    for (const seed of SEEDS) {
      const out = shuffleForReassessment(plan, seeded(seed));
      expect(out).toHaveLength(plan.length);
      expect(out.map((p) => p.item.id).sort()).toEqual(plan.map((p) => p.item.id).sort());
    }
  });
  it('cambia el orden y no modifica el original', () => {
    const copy = JSON.stringify(plan);
    const orders = SEEDS.map((s) => shuffleForReassessment(plan, seeded(s)).map((p) => p.item.id).join('|'));
    expect(new Set(orders).size).toBeGreaterThan(1);
    expect(orders.some((o) => o !== plan.map((p) => p.item.id).join('|'))).toBe(true);
    expect(JSON.stringify(plan)).toBe(copy);
  });
  it('cada área queda junta (una introducción por área)', () => {
    for (const seed of SEEDS) {
      const out = shuffleForReassessment(plan, seeded(seed));
      const steps = groupIntoSteps(out);
      expect(steps).toHaveLength(ASSESSMENT_AREAS.length);
      expect(unique(steps.map((s) => s.activityId))).toBe(true);
    }
  });
});

describe('groupIntoSteps', () => {
  it('agrupa ítems consecutivos de la misma actividad', () => {
    const mk = (activityId: string) => ({ area: activityId, activityId, level: 1, item: { id: activityId, target: '', prompt: '' } });
    const steps = groupIntoSteps([mk('a'), mk('a'), mk('b'), mk('a')]);
    expect(steps.map((s) => [s.activityId, s.items.length])).toEqual([
      ['a', 2],
      ['b', 1],
      ['a', 1],
    ]);
  });
});

// ---- almacenamiento y efecto sobre los niveles ----
const today = new Date(2026, 10, 8);

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

async function kid() {
  return saveProfile({ name: 'Sofi', birthDate: '2022-05-10', avatar: AVATARS[0] }, { today });
}

async function runAssessment(profileId: string, kind: 'baseline' | 'reassessment', rating: (area: string, level: number) => Rating, now: number) {
  const plan = buildAssessmentPlan(4, seeded(1));
  const session = await startSession(profileId, ['x'], now, kind);
  const record = await createAssessment({ profileId, kind, sessionId: session.id, ageYears: 4, items: plan, now });
  let t = now;
  for (const p of plan) {
    await addResult(
      {
        sessionId: session.id,
        profileId,
        activityId: p.activityId,
        itemId: p.item.id,
        target: p.item.target,
        area: p.item.area ?? p.area,
        phoneme: p.item.phoneme,
        level: p.level,
        rating: rating(p.area, p.level),
      },
      (t += 1),
    );
  }
  return completeAssessment(record.id, { 'escucha-senala': 2, 'que-es-esto': 2, onomatopeyas: 2, 'sigue-orden': 2, conceptos: 2, categorias: 2, 'arma-frase': 2, 'palabras-fonema': 2, discriminacion: 2 }, now + 1000);
}

describe('evaluación inicial: niveles', () => {
  it('fija el nivel de partida de cada actividad según el logro por área', async () => {
    const p = await kid();
    // Receptivo: todo logrado (sube a 2); frases: nada en nivel 2 (se queda en 1); el resto, a medias.
    const done = await runAssessment(p.id, 'baseline', (area, level) => (area === 'receptivo' ? 'full' : area === 'frases' && level === 2 ? 'not_yet' : level === 1 ? 'full' : 'help'), 1000);
    const levels = await getLevels(p.id);
    expect(levels['escucha-senala']).toBe(2);
    expect(levels['arma-frase']).toBe(1);
    expect(levels['sigue-orden']).toBe(1); // en el nivel 2 solo "con ayuda" = 50 %, menos del 60 % que se pide
    expect(done!.recommendedLevels).toMatchObject({ 'escucha-senala': 2, 'arma-frase': 1 });
    expect(done!.completedAt).toBe(2000);
    expect(await hasBaseline(p.id)).toBe(true);
  });

  it('una evaluación a medias no cuenta como inicial', async () => {
    const p = await kid();
    const s = await startSession(p.id, [], 1, 'baseline');
    await createAssessment({ profileId: p.id, kind: 'baseline', sessionId: s.id, ageYears: 4, items: [] });
    expect(await hasBaseline(p.id)).toBe(false);
    expect(await listAssessments(p.id)).toHaveLength(1);
  });

  it('la reevaluación NO cambia los niveles', async () => {
    const p = await kid();
    await runAssessment(p.id, 'baseline', () => 'not_yet', 1000);
    const before = await getLevels(p.id);
    await runAssessment(p.id, 'reassessment', () => 'full', 9000);
    expect(await getLevels(p.id)).toEqual(before);
  });

  it('la reevaluación repite los mismos ítems guardados', async () => {
    const p = await kid();
    const base = await runAssessment(p.id, 'baseline', () => 'full', 1000);
    const stored = await getAssessment(base!.id);
    const again = shuffleForReassessment(stored!.items, seeded(7));
    expect(again.map((i) => i.item.id).sort()).toEqual(stored!.items.map((i) => i.item.id).sort());
  });
});

describe('las evaluaciones no alteran la adaptación de nivel de la práctica', () => {
  it('sus resultados no cuentan para subir ni bajar de nivel', async () => {
    const p = await kid();
    // Evaluación inicial con todo "Aún no" en el área receptiva: si contara, forzaría "bajar/repetir".
    await runAssessment(p.id, 'baseline', () => 'not_yet', 1000);
    // Tres sesiones de práctica perfectas en nivel 1.
    let last: Awaited<ReturnType<typeof applyAdaptation>> = [];
    for (let i = 0; i < 3; i++) {
      const s = await startSession(p.id, ['escucha-senala'], 5000 + i * 100);
      for (let k = 0; k < 4; k++) {
        await addResult({ sessionId: s.id, profileId: p.id, activityId: 'escucha-senala', itemId: `i${k}`, target: 't', area: 'receptivo', level: 1, rating: 'full' }, 5000 + i * 100 + k + 1);
      }
      last = await applyAdaptation(p.id, s.id, { 'escucha-senala': 2 }, 6000 + i);
    }
    expect(last[0]).toMatchObject({ activityId: 'escucha-senala', level: 2, change: 'up' });
  });
});
