import { getDb, type PronunciationItem, type PronunciationRecord, type PronunciationResponse } from './db';
import { newId } from './ids';
import { completedPronunciation, upsertResponse, blockProgress } from './pronunciation';

/** Crea una evaluación nueva (la inicial si no hay ninguna terminada; si no, una reevaluación). */
export async function createPronunciation(input: {
  profileId: string;
  ageYears: number;
  items: PronunciationItem[];
  now?: number;
}): Promise<PronunciationRecord> {
  const previous = completedPronunciation(await listPronunciation(input.profileId));
  const record: PronunciationRecord = {
    id: newId(),
    profileId: input.profileId,
    kind: previous.length === 0 ? 'baseline' : 'reassessment',
    createdAt: input.now ?? Date.now(),
    ageYears: input.ageYears,
    items: input.items,
    responses: [],
  };
  await (await getDb()).put('pronunciation', record);
  return record;
}

export async function listPronunciation(profileId: string): Promise<PronunciationRecord[]> {
  const all = await (await getDb()).getAllFromIndex('pronunciation', 'byProfile', profileId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPronunciation(id: string): Promise<PronunciationRecord | undefined> {
  return (await getDb()).get('pronunciation', id);
}

/**
 * Guarda una respuesta (reemplaza la anterior del mismo ítem) en su propia transacción: así
 * una pausa o un cierre de la pestaña nunca pierde lo ya marcado. Si ya no falta ningún ítem,
 * la evaluación queda terminada.
 */
export async function saveResponse(
  id: string,
  response: PronunciationResponse,
  now: number = Date.now(),
): Promise<PronunciationRecord | undefined> {
  const db = await getDb();
  const tx = db.transaction('pronunciation', 'readwrite');
  const record = await tx.store.get(id);
  if (!record) {
    await tx.done;
    return undefined;
  }
  const responses = upsertResponse(record.responses, response);
  const next: PronunciationRecord = { ...record, responses };
  const done = blockProgress(next).done;
  if (done && next.completedAt === undefined) next.completedAt = now;
  if (!done) delete next.completedAt;
  await tx.store.put(next);
  await tx.done;
  return next;
}
