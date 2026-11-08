import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbConnection } from './db';
import { buildPronunciationItems, blockProgress, pendingPronunciation } from './pronunciation';
import { createPronunciation, getPronunciation, listPronunciation, saveResponse } from './pronunciationStore';
import { AVATARS, deleteProfile, saveProfile } from './profiles';
import { getDb } from './db';
import { seeded } from './random';
import { listSessions, listResults, getLevels } from './progress';

beforeEach(async () => {
  await resetDbConnection();
  globalThis.indexedDB = new IDBFactory();
});

describe('almacén de evaluaciones de pronunciación', () => {
  it('crea la inicial, guarda cada respuesta y se retoma con lo ya marcado', async () => {
    const items = buildPronunciationItems(3, seeded(1));
    const rec = await createPronunciation({ profileId: 'p1', ageYears: 3, items, now: 5 });
    expect(rec.kind).toBe('baseline');
    await saveResponse(rec.id, { itemId: items[0].id, mode: 'espontanea', status: 'correcta', at: 6 });
    await saveResponse(rec.id, { itemId: items[1].id, mode: 'repetida', status: 'sustituida', substitution: 't', at: 7 });
    // "Otro día": se vuelve a leer de la base.
    await resetDbConnection();
    const again = await getPronunciation(rec.id);
    expect(again!.responses).toHaveLength(2);
    expect(again!.completedAt).toBeUndefined();
    expect(pendingPronunciation(await listPronunciation('p1'))!.id).toBe(rec.id);
    expect(blockProgress(again!).answered).toBe(2);
  });

  it('al responder todo queda terminada; la siguiente es una reevaluación', async () => {
    const items = buildPronunciationItems(3, seeded(1));
    const rec = await createPronunciation({ profileId: 'p1', ageYears: 3, items, now: 5 });
    let last;
    for (const [i, item] of items.entries()) {
      last = await saveResponse(rec.id, { itemId: item.id, mode: 'espontanea', status: 'correcta', at: 10 + i }, 99);
    }
    expect(last!.completedAt).toBe(99);
    const next = await createPronunciation({ profileId: 'p1', ageYears: 3, items, now: 200 });
    expect(next.kind).toBe('reassessment');
  });

  it('cambiar una respuesta no duplica y no cuenta como práctica (sin sesiones, resultados ni niveles)', async () => {
    const items = buildPronunciationItems(3, seeded(1));
    const rec = await createPronunciation({ profileId: 'p1', ageYears: 3, items });
    await saveResponse(rec.id, { itemId: items[0].id, mode: 'espontanea', status: 'omitida', at: 1 });
    const after = await saveResponse(rec.id, { itemId: items[0].id, mode: 'repetida', status: 'correcta', at: 2 });
    expect(after!.responses).toEqual([{ itemId: items[0].id, mode: 'repetida', status: 'correcta', at: 2 }]);
    expect(await listSessions('p1')).toEqual([]);
    expect(await listResults('p1')).toEqual([]);
    expect(await getLevels('p1')).toEqual({});
  });

  it('guardar en una evaluación que no existe devuelve undefined', async () => {
    expect(await saveResponse('nada', { itemId: 'x', mode: 'espontanea', status: 'correcta', at: 1 })).toBeUndefined();
  });

  it('borrar el perfil borra también sus evaluaciones de pronunciación', async () => {
    const profile = await saveProfile({ name: 'Sofi', birthDate: '2022-05-10', avatar: AVATARS[0] }, { today: new Date(2026, 10, 8) });
    const other = await saveProfile({ name: 'Luis', birthDate: '2022-05-10', avatar: AVATARS[1] }, { today: new Date(2026, 10, 8) });
    const items = buildPronunciationItems(3, seeded(1));
    await createPronunciation({ profileId: profile.id, ageYears: 3, items });
    await createPronunciation({ profileId: other.id, ageYears: 3, items });
    await deleteProfile(profile.id);
    expect(await listPronunciation(profile.id)).toEqual([]);
    expect(await listPronunciation(other.id)).toHaveLength(1);
    expect((await (await getDb()).getAll('pronunciation')).length).toBe(1);
  });
});
