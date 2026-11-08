import { getDb, type ChildRecordingRecord, type ChildRecordingSource } from './db';
import { newId } from './ids';

export async function saveChildRecording(input: {
  profileId: string;
  text: string;
  source: ChildRecordingSource;
  data: ArrayBuffer;
  mime: string;
  now?: number;
}): Promise<ChildRecordingRecord> {
  const record: ChildRecordingRecord = {
    id: newId(),
    profileId: input.profileId,
    text: input.text,
    source: input.source,
    mime: input.mime,
    data: input.data,
    at: input.now ?? Date.now(),
  };
  await (await getDb()).put('childRecordings', record);
  return record;
}

/** Las más recientes primero. */
export async function listChildRecordings(profileId: string): Promise<ChildRecordingRecord[]> {
  const all = await (await getDb()).getAllFromIndex('childRecordings', 'byProfile', profileId);
  return all.sort((a, b) => b.at - a.at);
}

export async function deleteChildRecording(id: string): Promise<void> {
  await (await getDb()).delete('childRecordings', id);
}

/** Borra todas las grabaciones de un niño. Devuelve cuántas eran. */
export async function deleteChildRecordings(profileId: string): Promise<number> {
  const db = await getDb();
  const tx = db.transaction('childRecordings', 'readwrite');
  const keys = await tx.store.index('byProfile').getAllKeys(profileId);
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
  return keys.length;
}

export function totalBytes(records: readonly ChildRecordingRecord[]): number {
  return records.reduce((n, r) => n + r.data.byteLength, 0);
}
