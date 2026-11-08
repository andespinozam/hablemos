import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import { DB_NAME, DB_VERSION, getDb, resetDbConnection } from './db';

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

const profile = { id: 'p1', name: 'Sofi', birthDate: '2022-05-10', avatar: '🐰', createdAt: 1 };
const session = { id: 's1', profileId: 'p1', startedAt: 5, activityIds: ['escucha-senala'] };
const result = { id: 'r1', sessionId: 's1', profileId: 'p1', activityId: 'escucha-senala', itemId: 'gato', target: 'gato', area: 'receptivo', level: 1, rating: 'full', score: 1, at: 6 };
const level = { key: 'p1:escucha-senala', profileId: 'p1', activityId: 'escucha-senala', level: 2, updatedAt: 7 };

describe('migración de la base de datos (los datos de familias reales no se pueden perder)', () => {
  it('desde la versión 1 (solo perfiles): conserva el perfil y crea los almacenes nuevos', async () => {
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      },
    });
    await v1.put('profiles', profile);
    v1.close();

    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assessments', 'ladders', 'levels', 'profiles', 'pronunciation', 'recordings', 'results', 'sessions']);
    expect(await db.get('profiles', 'p1')).toEqual(profile);
    expect(await db.getAll('sessions')).toEqual([]);
  });

  it('desde la versión 2 (con progreso): conserva todo y agrega assessments', async () => {
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('results', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('levels', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
      },
    });
    await v2.put('profiles', profile);
    await v2.put('sessions', session);
    await v2.put('results', result);
    await v2.put('levels', level);
    v2.close();

    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect(await db.get('profiles', 'p1')).toEqual(profile);
    expect(await db.get('sessions', 's1')).toEqual(session);
    expect(await db.get('results', 'r1')).toEqual(result);
    expect(await db.get('levels', 'p1:escucha-senala')).toEqual(level);
    expect(db.objectStoreNames.contains('assessments')).toBe(true);
    // Los índices siguen funcionando después de migrar.
    expect(await db.getAllFromIndex('results', 'byProfile', 'p1')).toEqual([result]);
    expect(await db.getAllFromIndex('assessments', 'byProfile', 'p1')).toEqual([]);
  });

  it('desde la versión 3 (con evaluaciones): conserva todo y agrega pronunciation', async () => {
    const v3 = await openDB(DB_NAME, 3, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('results', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('levels', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('assessments', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
      },
    });
    const assessment = { id: 'a1', profileId: 'p1', kind: 'baseline', createdAt: 8, sessionId: 's1', ageYears: 3, items: [] };
    await v3.put('profiles', profile);
    await v3.put('results', result);
    await v3.put('assessments', assessment);
    v3.close();

    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect(await db.get('profiles', 'p1')).toEqual(profile);
    expect(await db.get('results', 'r1')).toEqual(result);
    expect(await db.get('assessments', 'a1')).toEqual(assessment);
    expect(db.objectStoreNames.contains('pronunciation')).toBe(true);
    expect(await db.getAllFromIndex('pronunciation', 'byProfile', 'p1')).toEqual([]);
    expect(await db.getAllFromIndex('assessments', 'byProfile', 'p1')).toEqual([assessment]);
  });

  it('desde la versión 4 (con pronunciación): conserva todo y agrega ladders', async () => {
    const v4 = await openDB(DB_NAME, 4, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('results', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('levels', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('assessments', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('pronunciation', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
      },
    });
    const pron = { id: 'pr1', profileId: 'p1', kind: 'baseline', createdAt: 9, ageYears: 4, items: [], responses: [] };
    await v4.put('profiles', profile);
    await v4.put('pronunciation', pron);
    v4.close();

    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect(await db.get('profiles', 'p1')).toEqual(profile);
    expect(await db.get('pronunciation', 'pr1')).toEqual(pron);
    expect(db.objectStoreNames.contains('ladders')).toBe(true);
    expect(await db.getAllFromIndex('ladders', 'byProfile', 'p1')).toEqual([]);
    expect(await db.getAllFromIndex('pronunciation', 'byProfile', 'p1')).toEqual([pron]);
  });

  it('desde la versión 5 (con escaleras): conserva todo y agrega recordings', async () => {
    const v5 = await openDB(DB_NAME, 5, {
      upgrade(db) {
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('results', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('levels', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('assessments', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('pronunciation', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
        db.createObjectStore('ladders', { keyPath: 'key' }).createIndex('byProfile', 'profileId');
      },
    });
    const ladder = { key: 'p1:s', profileId: 'p1', phonemeId: 's', state: 'active', order: 0, step: 2, successSessions: ['a'], createdAt: 1, updatedAt: 2 };
    await v5.put('profiles', profile);
    await v5.put('ladders', ladder);
    v5.close();

    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect(await db.get('profiles', 'p1')).toEqual(profile);
    expect(await db.get('ladders', 'p1:s')).toEqual(ladder);
    expect(db.objectStoreNames.contains('recordings')).toBe(true);
    expect(await db.getAll('recordings')).toEqual([]);
  });

  it('una base nueva se crea directamente en la última versión', async () => {
    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assessments', 'ladders', 'levels', 'profiles', 'pronunciation', 'recordings', 'results', 'sessions']);
  });

  it('abrir una base ya migrada no vuelve a tocar los datos', async () => {
    const first = await getDb();
    await first.put('profiles', profile);
    await resetDbConnection();
    const again = await getDb();
    expect(await again.getAll('profiles')).toEqual([profile]);
  });
});
