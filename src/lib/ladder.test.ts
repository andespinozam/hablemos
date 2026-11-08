import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { LadderRecord, PronunciationItem, PronunciationRecord, ResultRecord } from './db';
import { resetDbConnection } from './db';
import {
  LADDER_ACTIVITY_ID,
  LADDER_STEPS,
  LAST_STEP,
  MAX_ACTIVE_LADDERS,
  SESSIONS_TO_ADVANCE,
  activeLadders,
  advanceLadders,
  applyLadderSuccess,
  exercisesFor,
  ladderContent,
  ladderItemId,
  ladderKey,
  parseLadderItemId,
  phraseOf,
  rebalance,
  syllablesOf,
  syncFromEvaluation,
} from './ladder';
import { applyLadderProgress, listLadders, setSubstitution, syncLaddersFromEvaluation } from './ladderStore';
import { PHONEMES, getPhoneme } from './phonemes';
import { AVATARS, deleteProfile, saveProfile } from './profiles';
import { addResult } from './progress';
import { analyzeSounds, buildPronunciationItems } from './pronunciation';
import { seeded } from './random';

const P = 'p1';
const mk = (phonemeId: string, o: Partial<LadderRecord> = {}): LadderRecord => ({
  key: ladderKey(P, phonemeId),
  profileId: P,
  phonemeId,
  state: 'active',
  order: 0,
  step: 0,
  successSessions: [],
  createdAt: 1,
  updatedAt: 1,
  ...o,
});

/** Evaluación en la que fallan los sonidos de `fail` (con sustitución opcional). */
function evaluation(age: number, fail: Record<string, string | undefined>): PronunciationRecord {
  const items: PronunciationItem[] = buildPronunciationItems(age, seeded(3));
  return {
    id: 'e1',
    profileId: P,
    kind: 'baseline',
    createdAt: 1,
    completedAt: 2,
    ageYears: age,
    items,
    responses: items.map((i) => {
      const failing = i.phonemeId !== undefined && i.phonemeId in fail;
      return failing
        ? {
            itemId: i.id,
            mode: 'espontanea' as const,
            status: fail[i.phonemeId!] ? ('sustituida' as const) : ('omitida' as const),
            substitution: fail[i.phonemeId!],
            at: 5,
          }
        : { itemId: i.id, mode: 'espontanea' as const, status: 'correcta' as const, at: 5 };
    }),
  };
}

describe('contenido de la escalera', () => {
  it('hay 6 escalones y todo sonido evaluable tiene su pose de boca y su pista', () => {
    expect(LADDER_STEPS.map((s) => s.id)).toEqual(['modelo', 'boca', 'aislado', 'silaba', 'palabra', 'frase']);
    for (const p of PHONEMES.filter((x) => x.kind === 'sound')) {
      const c = ladderContent(p.id);
      expect(c, p.id).toBeDefined();
      expect(c!.say.length, p.id).toBeGreaterThan(0);
      expect(c!.cue.length, p.id).toBeGreaterThan(10);
    }
  });
  it('l, s y r siguen las pistas pedidas', () => {
    expect(ladderContent('l')!.mouth.tongue).toBe('tip-up');
    expect(ladderContent('l')!.cue).toMatch(/punta de la lengua arriba, detrás de los dientes/);
    expect(ladderContent('s')!.mouth).toMatchObject({ lips: 'smile', air: 'stream' });
    expect(ladderContent('s')!.cue).toMatch(/serpiente/);
    expect(ladderContent('r')!.warmups!.length).toBeGreaterThanOrEqual(2);
    expect(ladderContent('r')!.warmups!.join(' ')).toMatch(/sin apretar/);
    expect(ladderContent('rr')!.warmups).toBeDefined();
  });
});

describe('avance de la escalera: 3 sesiones distintas con "Lo logró"', () => {
  it('no sube con menos de 3 sesiones ni cuenta dos veces la misma', () => {
    let l = mk('s');
    l = applyLadderSuccess(l, 'a', 'full', 10);
    l = applyLadderSuccess(l, 'a', 'full', 11); // misma sesión
    l = applyLadderSuccess(l, 'b', 'full', 12);
    expect(l.step).toBe(0);
    expect(l.successSessions).toEqual(['a', 'b']);
    l = applyLadderSuccess(l, 'c', 'full', 13);
    expect(l.step).toBe(1);
    expect(l.successSessions).toEqual([]);
  });
  it('"Con ayuda" y "Aún no" no suman ni restan', () => {
    let l = mk('s', { step: 2, successSessions: ['a', 'b'] });
    expect(applyLadderSuccess(l, 'c', 'help', 1)).toBe(l);
    expect(applyLadderSuccess(l, 'c', 'not_yet', 1)).toBe(l);
    l = applyLadderSuccess(l, 'c', 'full', 1);
    expect(l.step).toBe(3);
  });
  it('al superar el último escalón la escalera termina', () => {
    let l = mk('s', { step: LAST_STEP, successSessions: ['a', 'b'] });
    l = applyLadderSuccess(l, 'c', 'full', 99);
    expect(l).toMatchObject({ state: 'done', completedAt: 99, step: LAST_STEP });
  });
  it('una escalera en espera o terminada no avanza', () => {
    expect(applyLadderSuccess(mk('s', { state: 'queued' }), 'a', 'full', 1).successSessions).toEqual([]);
    expect(applyLadderSuccess(mk('s', { state: 'done' }), 'a', 'full', 1).successSessions).toEqual([]);
  });
  it('solo cuentan los ítems del escalón en el que está cada sonido', () => {
    const res = (itemId: string, rating: ResultRecord['rating']): ResultRecord => ({
      id: itemId + rating,
      sessionId: 'S1',
      profileId: P,
      activityId: LADDER_ACTIVITY_ID,
      itemId,
      target: 'x',
      area: 'fonemas',
      level: 1,
      rating,
      score: rating === 'full' ? 1 : 0,
      at: 1,
    });
    const ladders = [mk('s', { step: 2 }), mk('l', { step: 0, order: 1 })];
    const out = advanceLadders(
      ladders,
      [res(ladderItemId('s', 1, 0), 'full'), res(ladderItemId('s', 2, 0), 'full'), res(ladderItemId('l', 0, 0), 'help')],
      'S1',
      5,
    );
    expect(out.find((l) => l.phonemeId === 's')!.successSessions).toEqual(['S1']); // el del escalón 2
    expect(out.find((l) => l.phonemeId === 'l')!.successSessions).toEqual([]);
  });
  it('ids de ítem: ida y vuelta, incluso con ids con guion', () => {
    expect(parseLadderItemId(ladderItemId('s-final', 3, 1))).toEqual({ phonemeId: 's-final', step: 3 });
    expect(parseLadderItemId('otra/cosa')).toBeNull();
  });
  it('SESSIONS_TO_ADVANCE es 3', () => {
    expect(SESSIONS_TO_ADVANCE).toBe(3);
  });
});

describe('activación desde la evaluación', () => {
  it('cada sonido "a estimular" tiene su escalera, tempranos primero, y se guarda la sustitución', () => {
    const ev = evaluation(5, { t: 'k', l: 'd', r: undefined });
    const out = syncFromEvaluation([], analyzeSounds(ev), 5, P, 10);
    const byId = Object.fromEntries(out.map((l) => [l.phonemeId, l]));
    expect(Object.keys(byId).sort()).toEqual(['l', 'r', 't']);
    expect(byId.t.substitution).toBe('k');
    expect(byId.t.substitutionSource).toBe('evaluacion');
    expect(byId.r.substitution).toBeUndefined();
    // t (3 años) y l (4) son tempranos para un niño de 5; r es de su edad.
    expect([...out].sort((a, b) => a.order - b.order).map((l) => l.phonemeId)).toEqual(['t', 'l', 'r']);
    expect(out.every((l) => l.step === 0)).toBe(true);
  });
  it('solo MAX_ACTIVE_LADDERS activas a la vez; el resto espera y entra cuando una termina', () => {
    const ev = evaluation(5, { t: 'k', l: 'd', p: 'b', m: 'n', s: 't' });
    let out = syncFromEvaluation([], analyzeSounds(ev), 5, P, 10);
    expect(out.filter((l) => l.state === 'active')).toHaveLength(MAX_ACTIVE_LADDERS);
    expect(out.filter((l) => l.state === 'queued')).toHaveLength(2);
    const first = activeLadders(out)[0];
    out = out.map((l) => (l.key === first.key ? { ...l, state: 'done' as const } : l));
    out = rebalance(out, 20);
    expect(out.filter((l) => l.state === 'active')).toHaveLength(MAX_ACTIVE_LADDERS);
    expect(out.filter((l) => l.state === 'queued')).toHaveLength(1);
  });
  it('los sonidos tardíos (esperables para su edad) no activan escalera', () => {
    const ev = evaluation(3, { ch: 't' }); // opcional de 4 años: esperable
    const out = syncFromEvaluation([], analyzeSounds(ev), 3, P, 10);
    expect(out.find((l) => l.phonemeId === 'ch')).toBeUndefined();
  });
  it('una reevaluación conserva el escalón, respeta la sustitución escrita a mano y cierra lo consolidado', () => {
    const first = syncFromEvaluation([], analyzeSounds(evaluation(4, { s: 't', l: 'd' })), 4, P, 10);
    const edited = first.map((l) =>
      l.phonemeId === 's' ? { ...l, step: 3, substitution: 'ch', substitutionSource: 'adulto' as const } : l,
    );
    const again = syncFromEvaluation(edited, analyzeSounds(evaluation(4, { s: 't' })), 4, P, 20);
    const s = again.find((l) => l.phonemeId === 's')!;
    expect(s.step).toBe(3);
    expect(s.substitution).toBe('ch'); // no se pisa lo que escribió el adulto
    const l = again.find((x) => x.phonemeId === 'l')!;
    expect(l.state).toBe('done'); // ahora lo dice bien
  });
  it('un sonido terminado que vuelve a salir "a estimular" se reabre', () => {
    const done = [mk('s', { state: 'done', completedAt: 5, step: 5 })];
    const out = syncFromEvaluation(done, analyzeSounds(evaluation(4, { s: 't' })), 4, P, 30);
    expect(out[0]).toMatchObject({ state: 'active', step: 5 });
    expect(out[0].completedAt).toBeUndefined();
  });
});

describe('ejercicios por escalón', () => {
  const l = (step: number, id = 's') => ({ phonemeId: id, step });
  it('cada escalón produce 1-2 ejercicios con ids que llevan el escalón', () => {
    for (const p of PHONEMES.filter((x) => x.kind === 'sound')) {
      for (let step = 0; step <= LAST_STEP; step++) {
        const ex = exercisesFor(l(step, p.id), seeded(step + 1));
        expect(ex.length, `${p.id}@${step}`).toBeGreaterThanOrEqual(1);
        expect(ex.length).toBeLessThanOrEqual(2);
        for (const e of ex) {
          expect(parseLadderItemId(e.id)).toEqual({ phonemeId: p.id, step });
          expect(e.prompt.length).toBeGreaterThan(3);
          expect(e.model.length).toBeGreaterThan(0);
        }
        expect(new Set(ex.map((e) => e.id)).size).toBe(ex.length);
      }
    }
  });
  it('sílabas del propio sonido; palabras y frases con el sonido', () => {
    const p = getPhoneme('l')!;
    expect(syllablesOf(p).length).toBeGreaterThanOrEqual(2);
    expect(syllablesOf(p).every((s) => s.length <= 3)).toBe(true);
    const words = exercisesFor(l(4, 'l'), seeded(2)).map((e) => e.shown);
    expect(new Set(words).size).toBe(words.length);
    expect(p.words.map((w) => w.word)).toEqual(expect.arrayContaining(words));
    for (const e of exercisesFor(l(5, 'l'), seeded(2))) {
      expect(e.shown).toMatch(/^mi \S+ y mi \S+$/);
      expect(e.emojis).toHaveLength(2);
    }
    expect(phraseOf(['pato', 'sapo'])).toBe('mi pato y mi sapo');
  });
  it('en r, el escalón de la boca trae ejercicios previos de lengua', () => {
    const [e] = exercisesFor(l(1, 'r'), seeded(1));
    expect(e.warmups!.length).toBeGreaterThanOrEqual(2);
    expect(e.model).toMatch(/lengua|caballito/);
    expect(exercisesFor(l(1, 's'), seeded(1))[0].warmups).toBeUndefined();
  });
  it('es reproducible con la misma semilla', () => {
    expect(exercisesFor(l(4), seeded(5))).toEqual(exercisesFor(l(4), seeded(5)));
  });
});

describe('almacén de escaleras', () => {
  beforeEach(async () => {
    await resetDbConnection();
    globalThis.indexedDB = new IDBFactory();
  });

  it('se crean al terminar la evaluación, avanzan con 3 sesiones y la sustitución se corrige', async () => {
    const ev = evaluation(4, { s: 't' });
    const created = await syncLaddersFromEvaluation(ev, 10);
    expect(created.map((x) => x.phonemeId)).toEqual(['s']);
    expect((await listLadders(P))[0]).toMatchObject({ state: 'active', substitution: 't' });

    for (const sid of ['S1', 'S2', 'S3']) {
      await addResult({
        sessionId: sid,
        profileId: P,
        activityId: LADDER_ACTIVITY_ID,
        itemId: ladderItemId('s', 0, 0),
        target: 'x',
        area: 'fonemas',
        level: 1,
        rating: 'full',
      });
      await applyLadderProgress(P, sid, 20);
    }
    const after = (await listLadders(P))[0];
    expect(after.step).toBe(1);
    expect(after.successSessions).toEqual([]);

    await setSubstitution(after.key, 'ch');
    expect((await listLadders(P))[0]).toMatchObject({ substitution: 'ch', substitutionSource: 'adulto' });
    await setSubstitution(after.key, undefined);
    expect((await listLadders(P))[0].substitution).toBeUndefined();
  });

  it('borrar el perfil borra también sus escaleras', async () => {
    const profile = await saveProfile({ name: 'Sofi', birthDate: '2022-05-10', avatar: AVATARS[0] }, { today: new Date(2026, 10, 8) });
    const ev = { ...evaluation(4, { s: 't' }), profileId: profile.id };
    await syncLaddersFromEvaluation(ev, 10);
    expect(await listLadders(profile.id)).toHaveLength(1);
    await deleteProfile(profile.id);
    expect(await listLadders(profile.id)).toEqual([]);
  });
});
