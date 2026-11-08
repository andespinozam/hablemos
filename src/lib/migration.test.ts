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
    expect([...db.objectStoreNames].sort()).toEqual(['assessments', 'levels', 'profiles', 'results', 'sessions']);
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

  it('una base nueva se crea directamente en la última versión', async () => {
    const db = await getDb();
    expect(db.version).toBe(DB_VERSION);
    expect([...db.objectStoreNames].sort()).toEqual(['assessments', 'levels', 'profiles', 'results', 'sessions']);
  });

  it('abrir una base ya migrada no vuelve a tocar los datos', async () => {
    const first = await getDb();
    await first.put('profiles', profile);
    await resetDbConnection();
    const again = await getDb();
    expect(await again.getAll('profiles')).toEqual([profile]);
  });
});
