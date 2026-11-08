import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DB_VERSION, getDb, resetDbConnection } from './db';
import { AVATARS, deleteProfile, saveProfile } from './profiles';
import {
  addResult,
  applyAdaptation,
  finishSession,
  getLastPracticed,
  getLevels,
  listResults,
  listSessions,
  startSession,
  type ResultInput,
} from './progress';
import type { Rating } from './scoring';

const today = new Date(2026, 10, 8);
const MAX = { warm: 3 };
let t = 1000;

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
  t = 1000;
});

async function kid(name = 'Sofi') {
  return saveProfile({ name, birthDate: '2022-05-10', avatar: AVATARS[0] }, { today });
}

/** Juega una sesión de `ratings.length` ítems de la actividad "warm" y adapta el nivel. */
async function play(profileId: string, ratings: Rating[], level = 1) {
  const s = await startSession(profileId, ['warm'], (t += 100));
  for (const [i, rating] of ratings.entries()) {
    const input: ResultInput = {
      sessionId: s.id,
      profileId,
      activityId: 'warm',
      itemId: `i${i}`,
      target: 'pelota',
      area: 'expresivo',
      level,
      rating,
    };
    await addResult(input, (t += 10));
  }
  await finishSession(s.id, (t += 10));
  return applyAdaptation(profileId, s.id, MAX, t);
}

describe('esquema', () => {
  it('abre la base en la versión actual con todos los almacenes', async () => {
    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assessments', 'ladders', 'levels', 'profiles', 'pronunciation', 'recordings', 'results', 'sessions']);
  });
});

describe('sesiones y resultados', () => {
  it('guarda sesión y resultados con su puntaje', async () => {
    const p = await kid();
    const s = await startSession(p.id, ['warm'], 1);
    const r = await addResult(
      { sessionId: s.id, profileId: p.id, activityId: 'warm', itemId: 'a', target: 'gato', area: 'expresivo', level: 1, rating: 'help' },
      5,
    );
    expect(r.score).toBe(0.5);
    await finishSession(s.id, 9);
    expect(await listResults(p.id)).toEqual([r]);
    expect((await listSessions(p.id))[0]).toMatchObject({ id: s.id, endedAt: 9 });
    expect(await getLastPracticed(p.id)).toEqual({ warm: 5 });
  });

  it('separa los datos de cada niño', async () => {
    const a = await kid('Ana');
    const b = await kid('Beto');
    await play(a.id, ['full', 'full', 'full']);
    expect(await listResults(b.id)).toEqual([]);
    expect(await listResults(a.id)).toHaveLength(3);
  });
});

describe('adaptación de nivel', () => {
  it('sube tras 3 sesiones con >=80%', async () => {
    const p = await kid();
    expect((await play(p.id, ['full', 'full', 'full', 'help']))[0].change).toBe('same'); // 87%
    expect((await play(p.id, ['full', 'full', 'full', 'full']))[0].change).toBe('same');
    const third = await play(p.id, ['full', 'full', 'full', 'full']);
    expect(third[0]).toMatchObject({ activityId: 'warm', level: 2, change: 'up' });
    expect(await getLevels(p.id)).toEqual({ warm: 2 });
  });

  it('en el nuevo nivel el conteo empieza de cero', async () => {
    const p = await kid();
    for (let i = 0; i < 3; i++) await play(p.id, ['full', 'full', 'full', 'full']);
    const next = await play(p.id, ['full', 'full', 'full', 'full'], 2);
    expect(next[0]).toMatchObject({ level: 2, change: 'same' });
  });

  it('baja con <40% y repite en el nivel 1', async () => {
    const p = await kid();
    expect((await play(p.id, ['not_yet', 'not_yet', 'help', 'not_yet']))[0]).toMatchObject({ level: 1, change: 'repeat' });
    for (let i = 0; i < 3; i++) await play(p.id, ['full', 'full', 'full', 'full']);
    expect((await getLevels(p.id)).warm).toBe(2);
    expect((await play(p.id, ['not_yet', 'not_yet', 'not_yet', 'help'], 2))[0]).toMatchObject({ level: 1, change: 'down' });
    expect((await getLevels(p.id)).warm).toBe(1);
  });

  it('una sesión con menos de 3 ítems no adapta nada', async () => {
    const p = await kid();
    expect(await play(p.id, ['not_yet', 'not_yet'])).toEqual([]);
    expect(await getLevels(p.id)).toEqual({});
  });
});

describe('eliminar perfil', () => {
  it('borra sus sesiones, resultados y niveles, y deja los de otros', async () => {
    const a = await kid('Ana');
    const b = await kid('Beto');
    for (let i = 0; i < 3; i++) await play(a.id, ['full', 'full', 'full', 'full']);
    await play(b.id, ['full', 'full', 'full']);
    await deleteProfile(a.id);

    expect(await listResults(a.id)).toEqual([]);
    expect(await listSessions(a.id)).toEqual([]);
    expect(await getLevels(a.id)).toEqual({});
    expect(await listResults(b.id)).toHaveLength(3);
    expect(await listSessions(b.id)).toHaveLength(1);
  });
});
