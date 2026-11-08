import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, backupFileName, exportBackup, importBackup, parseBackup, validateBackup } from './backup';
import { getDb, resetDbConnection } from './db';
import { AVATARS, listProfiles, saveProfile } from './profiles';
import { addResult, finishSession, listResults, listSessions, setLevel, startSession } from './progress';
import { createAssessment, listAssessments } from './assessmentStore';

const today = new Date(2026, 10, 8);

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

async function seed(name = 'Sofi') {
  const p = await saveProfile({ name, birthDate: '2022-05-10', avatar: AVATARS[0] }, { today, now: 1 });
  const s = await startSession(p.id, ['escucha-senala'], 10);
  await addResult({ sessionId: s.id, profileId: p.id, activityId: 'escucha-senala', itemId: 'gato', target: 'gato', area: 'receptivo', level: 1, rating: 'help' }, 11);
  await finishSession(s.id, 12);
  await setLevel(p.id, 'escucha-senala', 2, 13);
  const bs = await startSession(p.id, ['escucha-senala'], 20, 'baseline');
  await createAssessment({
    profileId: p.id,
    kind: 'baseline',
    sessionId: bs.id,
    ageYears: 4,
    now: 21,
    items: [{ area: 'receptivo', activityId: 'escucha-senala', level: 1, item: { id: 'gato@1', target: 'gato', prompt: 'Toca el gato.' } }],
  });
  return p;
}

describe('exportBackup', () => {
  it('incluye todo y se puede escribir como JSON', async () => {
    const p = await seed();
    const b = await exportBackup(99);
    expect(b).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: 99 });
    expect(b.data.profiles.map((x) => x.id)).toEqual([p.id]);
    expect(b.data.sessions).toHaveLength(2);
    expect(b.data.results).toHaveLength(1);
    expect(b.data.levels).toHaveLength(1);
    expect(b.data.assessments).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });
  it('con la base vacía exporta listas vacías', async () => {
    const b = await exportBackup();
    expect(b.data).toEqual({ profiles: [], sessions: [], results: [], levels: [], assessments: [], pronunciation: [], ladders: [] });
  });
});

describe('validateBackup', () => {
  async function valid() {
    await seed();
    return JSON.parse(JSON.stringify(await exportBackup()));
  }
  it('acepta un respaldo propio y resume su contenido', async () => {
    const out = validateBackup(await valid());
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.summary).toMatchObject({ profiles: 1, sessions: 2, results: 1, assessments: 1, names: ['Sofi'] });
  });
  it('rechaza lo que no es un respaldo, sin lanzar errores', () => {
    for (const bad of [null, 5, 'x', [], {}, { format: 'otra-cosa' }]) expect(validateBackup(bad).ok).toBe(false);
    expect(parseBackup('no es json').ok).toBe(false);
    expect(parseBackup('{"format":').ok).toBe(false);
  });
  it('rechaza una versión más nueva con un mensaje claro', async () => {
    const b = await valid();
    b.version = BACKUP_VERSION + 1;
    const out = validateBackup(b);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0]).toMatch(/versión más nueva/);
  });
  it('detecta datos mal formados', async () => {
    const mutate = async (fn: (b: any) => void) => {
      const b = await valid();
      fn(b);
      return validateBackup(b);
    };
    expect((await mutate((b) => delete b.data.results)).ok).toBe(false);
    expect((await mutate((b) => (b.data.profiles[0].birthDate = '2022-13-45'))).ok).toBe(false);
    expect((await mutate((b) => (b.data.results[0].rating = 'mal'))).ok).toBe(false);
    expect((await mutate((b) => (b.data.results[0].score = 7))).ok).toBe(false);
    expect((await mutate((b) => (b.data.results[0].profileId = 'fantasma'))).ok).toBe(false);
    expect((await mutate((b) => (b.data.assessments[0].items[0].item = 'x'))).ok).toBe(false);
    expect((await mutate((b) => (b.data.sessions[0].kind = 'raro'))).ok).toBe(false);
  });
  it('limita la cantidad de errores que reporta', async () => {
    const b = await valid();
    b.data.results = Array.from({ length: 50 }, () => ({ nope: true }));
    const out = validateBackup(b);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors.length).toBeLessThanOrEqual(8);
  });
});

describe('importBackup', () => {
  it('ida y vuelta: exportar, vaciar e importar deja todo igual', async () => {
    await seed();
    const before = await exportBackup(1);
    await resetDbConnection();
    globalThis.indexedDB = new IDBFactory(); // dispositivo nuevo
    expect(await listProfiles()).toEqual([]);

    const parsed = parseBackup(JSON.stringify(before));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await importBackup(parsed.backup, 'replace');
    expect(await exportBackup(1)).toEqual(before);
  });

  it('reemplazar borra lo que había', async () => {
    const original = await seed('Ana');
    const backup = await exportBackup();
    await saveProfile({ name: 'Extra', birthDate: '2021-01-01', avatar: AVATARS[1] }, { today });
    await importBackup(backup, 'replace');
    expect((await listProfiles()).map((p) => p.name)).toEqual(['Ana']);
    expect((await listProfiles())[0].id).toBe(original.id);
  });

  it('combinar conserva lo existente, agrega lo nuevo y pisa los ids repetidos', async () => {
    const ana = await seed('Ana');
    const backup = await exportBackup();
    backup.data.profiles[0] = { ...backup.data.profiles[0], name: 'Ana María' };
    const extra = await saveProfile({ name: 'Extra', birthDate: '2021-01-01', avatar: AVATARS[1] }, { today });

    await importBackup(backup, 'merge');
    const names = (await listProfiles()).map((p) => p.name).sort();
    expect(names).toEqual(['Ana María', 'Extra']);
    expect((await listProfiles()).find((p) => p.id === ana.id)!.name).toBe('Ana María');
    expect((await listProfiles()).some((p) => p.id === extra.id)).toBe(true);
    expect(await listResults(ana.id)).toHaveLength(1); // sin duplicar
    expect(await listSessions(ana.id)).toHaveLength(2);
    expect(await listAssessments(ana.id)).toHaveLength(1);
  });

  it('si algo falla a mitad, no queda nada a medias', async () => {
    await seed('Ana');
    const bad = await exportBackup();
    // Un registro sin la clave `id` hace fallar el put: la transacción entera se cancela.
    (bad.data.results as unknown[]).push({ nope: true });
    const db = await getDb();
    const before = (await db.getAll('results')).length;
    await expect(importBackup(bad, 'replace')).rejects.toThrow();
    expect((await (await getDb()).getAll('results')).length).toBe(before);
    expect((await listProfiles()).map((p) => p.name)).toEqual(['Ana']);
  });
});

describe('backupFileName', () => {
  it('lleva la fecha local', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('hablemos-respaldo-2026-01-05.json');
  });
});
