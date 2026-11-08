import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_VERSION, exportBackup, importBackup, parseBackup, validateBackup } from './backup';
import { fromBase64, isBase64, toBase64 } from './base64';
import { deleteChildRecordings, listChildRecordings, saveChildRecording } from './childRecordingsStore';
import { getDb, resetDbConnection, type LadderRecord, type PronunciationRecord } from './db';
import { AVATARS, deleteProfile, saveProfile } from './profiles';
import { listPronunciation } from './pronunciationStore';
import { listLadders } from './ladderStore';

const today = new Date(2026, 10, 8);

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

const pron = (profileId: string): PronunciationRecord => ({
  id: 'pr1',
  profileId,
  kind: 'baseline',
  createdAt: 5,
  completedAt: 9,
  ageYears: 4,
  items: [{ id: 's/sapo', phonemeId: 's', word: 'sapo', syllables: ['sa', 'po'], emoji: '🐸', position: 'inicio', optional: false }],
  responses: [{ itemId: 's/sapo', mode: 'repetida', status: 'sustituida', substitution: 't', at: 6 }],
});
const ladder = (profileId: string): LadderRecord => ({
  key: `${profileId}:s`,
  profileId,
  phonemeId: 's',
  state: 'active',
  order: 0,
  step: 2,
  successSessions: ['a'],
  substitution: 't',
  substitutionSource: 'evaluacion',
  createdAt: 1,
  updatedAt: 2,
});

async function seedV2() {
  const p = await saveProfile({ name: 'Sofi', birthDate: '2022-05-10', avatar: AVATARS[0] }, { today, now: 1 });
  const db = await getDb();
  await db.put('pronunciation', pron(p.id));
  await db.put('ladders', ladder(p.id));
  await saveChildRecording({ profileId: p.id, text: 'sapo', source: 'evaluacion', data: new Uint8Array([1, 2, 3, 250]).buffer, mime: 'audio/webm', now: 7 });
  return p;
}

describe('base64', () => {
  it('ida y vuelta con bytes arbitrarios, también grandes', () => {
    const big = new Uint8Array(200_000).map((_, i) => (i * 31) % 256);
    expect([...new Uint8Array(fromBase64(toBase64(big.buffer)))]).toEqual([...big]);
    expect(isBase64(toBase64(new Uint8Array([1, 2]).buffer))).toBe(true);
    expect(isBase64('no es base64!')).toBe(false);
  });
});

describe('respaldo v2', () => {
  it('es la versión 2 e incluye pronunciación y escaleras, pero NO las grabaciones del niño por defecto', async () => {
    const p = await seedV2();
    const b = await exportBackup(10);
    expect(BACKUP_VERSION).toBe(2);
    expect(b.version).toBe(2);
    expect(b.data.pronunciation.map((x) => x.id)).toEqual(['pr1']);
    expect(b.data.ladders.map((x) => x.key)).toEqual([`${p.id}:s`]);
    expect(b.data.childRecordings).toBeUndefined();
    expect(JSON.stringify(b)).not.toContain('AQID'); // el audio (base64 de 1,2,3,250) no está
  });

  it('con la opción explícita incluye las grabaciones del niño en base64', async () => {
    await seedV2();
    const b = await exportBackup(10, { includeRecordings: true });
    expect(b.data.childRecordings).toHaveLength(1);
    expect(isBase64(b.data.childRecordings![0].data)).toBe(true);
    expect(b.data.childRecordings![0].text).toBe('sapo');
  });

  it('ida y vuelta completa (con grabaciones) en un dispositivo nuevo', async () => {
    await seedV2();
    const before = await exportBackup(1, { includeRecordings: true });
    await resetDbConnection();
    globalThis.indexedDB = new IDBFactory();
    const parsed = parseBackup(JSON.stringify(before));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toMatchObject({ pronunciation: 1, ladders: 1, childRecordings: 1 });
    await importBackup(parsed.backup, 'replace');
    expect(await exportBackup(1, { includeRecordings: true })).toEqual(before);
    const recs = await listChildRecordings(before.data.profiles[0].id);
    expect([...new Uint8Array(recs[0].data)]).toEqual([1, 2, 3, 250]);
  });

  it('sin la opción, la ida y vuelta conserva todo menos las grabaciones', async () => {
    const p = await seedV2();
    const before = await exportBackup(1);
    await resetDbConnection();
    globalThis.indexedDB = new IDBFactory();
    const parsed = parseBackup(JSON.stringify(before));
    if (!parsed.ok) throw new Error('debía ser válido');
    await importBackup(parsed.backup, 'replace');
    expect((await listPronunciation(p.id))[0]).toEqual(pron(p.id));
    expect((await listLadders(p.id))[0]).toEqual(ladder(p.id));
    expect(await listChildRecordings(p.id)).toEqual([]);
  });

  it('reemplazar borra las grabaciones del niño si el respaldo no las trae; combinar las conserva', async () => {
    const p = await seedV2();
    const without = await exportBackup(1);
    const parsed = parseBackup(JSON.stringify(without));
    if (!parsed.ok) throw new Error('debía ser válido');
    await importBackup(parsed.backup, 'merge');
    expect(await listChildRecordings(p.id)).toHaveLength(1);
    await importBackup(parsed.backup, 'replace');
    expect(await listChildRecordings(p.id)).toEqual([]);
  });

  it('una grabación con audio dañado se rechaza antes de tocar nada', async () => {
    const p = await seedV2();
    const b = JSON.parse(JSON.stringify(await exportBackup(1, { includeRecordings: true })));
    b.data.childRecordings[0].data = 'esto no es base64!';
    const out = validateBackup(b);
    expect(out.ok).toBe(false);
    expect(await listChildRecordings(p.id)).toHaveLength(1);
  });

  it('detecta pronunciación, escaleras y grabaciones mal formadas o de un perfil que no está', async () => {
    await seedV2();
    const base = JSON.parse(JSON.stringify(await exportBackup(1, { includeRecordings: true })));
    const bad = (mutate: (b: typeof base) => void) => {
      const c = JSON.parse(JSON.stringify(base));
      mutate(c);
      return validateBackup(c);
    };
    expect(bad((b) => (b.data.pronunciation[0].profileId = 'otro')).ok).toBe(false);
    expect(bad((b) => (b.data.pronunciation[0].responses[0].status = 'rara')).ok).toBe(false);
    expect(bad((b) => (b.data.ladders[0].step = 9)).ok).toBe(false);
    expect(bad((b) => (b.data.ladders[0].state = 'x')).ok).toBe(false);
    expect(bad((b) => (b.data.childRecordings[0].profileId = 'otro')).ok).toBe(false);
    expect(bad((b) => (b.data.ladders = 'no')).ok).toBe(false);
    expect(bad(() => undefined).ok).toBe(true);
  });

  it('rechaza una versión 3 (más nueva que esta app)', async () => {
    const b = JSON.parse(JSON.stringify(await exportBackup(1)));
    b.version = 3;
    expect(validateBackup(b).ok).toBe(false);
  });
});

describe('migración: un respaldo v1 (archivo viejo) se sigue importando', () => {
  const v1 = (profileId: string) => ({
    format: 'hablemos-backup',
    version: 1,
    exportedAt: 5,
    dbVersion: 3,
    data: {
      profiles: [{ id: profileId, name: 'Luis', birthDate: '2021-03-04', avatar: '🐻', createdAt: 1 }],
      sessions: [{ id: 's1', profileId, startedAt: 2, activityIds: ['escucha-senala'] }],
      results: [{ id: 'r1', sessionId: 's1', profileId, activityId: 'escucha-senala', itemId: 'gato', target: 'gato', area: 'receptivo', level: 1, rating: 'full', score: 1, at: 3 }],
      levels: [{ key: `${profileId}:escucha-senala`, profileId, activityId: 'escucha-senala', level: 2, updatedAt: 4 }],
      assessments: [],
    },
  });

  it('se valida y se lee como v2 con las listas nuevas vacías', () => {
    const out = validateBackup(v1('p1'));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.backup.data.pronunciation).toEqual([]);
    expect(out.backup.data.ladders).toEqual([]);
    expect(out.summary).toMatchObject({ profiles: 1, results: 1, pronunciation: 0, ladders: 0, childRecordings: 0 });
  });

  it('combinar un v1 no borra la pronunciación ni las escaleras que ya había', async () => {
    const p = await seedV2();
    const out = validateBackup(v1('otro'));
    if (!out.ok) throw new Error('debía ser válido');
    await importBackup(out.backup, 'merge');
    expect(await listPronunciation(p.id)).toHaveLength(1);
    expect(await listLadders(p.id)).toHaveLength(1);
    expect(await listChildRecordings(p.id)).toHaveLength(1);
  });

  it('reemplazar con un v1 deja solo lo del v1 y la base queda en la versión actual', async () => {
    const p = await seedV2();
    const out = validateBackup(v1('otro'));
    if (!out.ok) throw new Error('debía ser válido');
    await importBackup(out.backup, 'replace');
    expect(await listPronunciation(p.id)).toEqual([]);
    expect(await listLadders(p.id)).toEqual([]);
    expect((await (await getDb()).getAll('profiles')).map((x) => x.name)).toEqual(['Luis']);
  });
});

describe('grabaciones del niño: borrado', () => {
  it('se borran por niño, y al eliminar el perfil', async () => {
    const a = await saveProfile({ name: 'Ana', birthDate: '2022-05-10', avatar: AVATARS[0] }, { today });
    const b = await saveProfile({ name: 'Beto', birthDate: '2022-05-10', avatar: AVATARS[1] }, { today });
    for (const p of [a, b]) {
      await saveChildRecording({ profileId: p.id, text: 'pato', source: 'escalera', data: new ArrayBuffer(4), mime: 'audio/mp4' });
      await saveChildRecording({ profileId: p.id, text: 'gato', source: 'escalera', data: new ArrayBuffer(4), mime: 'audio/mp4' });
    }
    expect(await deleteChildRecordings(a.id)).toBe(2);
    expect(await listChildRecordings(a.id)).toEqual([]);
    expect(await listChildRecordings(b.id)).toHaveLength(2);
    await deleteProfile(b.id);
    expect(await listChildRecordings(b.id)).toEqual([]);
  });
  it('las más recientes salen primero', async () => {
    const a = await saveProfile({ name: 'Ana', birthDate: '2022-05-10', avatar: AVATARS[0] }, { today });
    await saveChildRecording({ profileId: a.id, text: 'uno', source: 'evaluacion', data: new ArrayBuffer(1), mime: 'audio/webm', now: 1 });
    await saveChildRecording({ profileId: a.id, text: 'dos', source: 'evaluacion', data: new ArrayBuffer(1), mime: 'audio/webm', now: 2 });
    expect((await listChildRecordings(a.id)).map((r) => r.text)).toEqual(['dos', 'uno']);
  });
});
