import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbConnection } from './db';
import { AVATARS, deleteProfile, getProfile, listProfiles, saveProfile, validateProfile } from './profiles';

const today = new Date(2026, 10, 8);
const valid = { name: 'Sofi', birthDate: '2022-05-10', avatar: AVATARS[0] };

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory(); // base limpia en cada prueba
});

describe('validateProfile', () => {
  it('acepta datos válidos', () => {
    expect(validateProfile(valid, today)).toEqual({});
  });
  it('exige nombre y limita su largo', () => {
    expect(validateProfile({ ...valid, name: '   ' }, today).name).toBeDefined();
    expect(validateProfile({ ...valid, name: 'x'.repeat(21) }, today).name).toBeDefined();
  });
  it('valida fecha y rango de edad', () => {
    expect(validateProfile({ ...valid, birthDate: '' }, today).birthDate).toBeDefined();
    expect(validateProfile({ ...valid, birthDate: '2027-01-01' }, today).birthDate).toBeDefined();
    expect(validateProfile({ ...valid, birthDate: '2015-01-01' }, today).birthDate).toBeDefined();
  });
  it('exige un avatar de la lista', () => {
    expect(validateProfile({ ...valid, avatar: '💩' }, today).avatar).toBeDefined();
  });
});

describe('almacenamiento de perfiles', () => {
  it('crea, lista y recorta el nombre', async () => {
    const p = await saveProfile({ ...valid, name: '  Sofi ' }, { today, now: 1 });
    expect(p.name).toBe('Sofi');
    expect(await listProfiles()).toEqual([p]);
    expect(await getProfile(p.id)).toEqual(p);
  });
  it('lista en orden de creación', async () => {
    const a = await saveProfile(valid, { today, now: 20 });
    const b = await saveProfile({ ...valid, name: 'Leo' }, { today, now: 10 });
    expect((await listProfiles()).map((p) => p.id)).toEqual([b.id, a.id]);
  });
  it('edita conservando id y fecha de creación', async () => {
    const p = await saveProfile(valid, { today, now: 5 });
    const edited = await saveProfile({ ...valid, name: 'Sofía' }, { id: p.id, today, now: 99 });
    expect(edited.id).toBe(p.id);
    expect(edited.createdAt).toBe(5);
    expect(await listProfiles()).toHaveLength(1);
  });
  it('rechaza datos inválidos sin guardar nada', async () => {
    await expect(saveProfile({ ...valid, name: '' }, { today })).rejects.toThrow();
    expect(await listProfiles()).toEqual([]);
  });
  it('elimina perfiles', async () => {
    const p = await saveProfile(valid, { today });
    await deleteProfile(p.id);
    expect(await listProfiles()).toEqual([]);
  });
});
