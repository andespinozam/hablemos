import { audioKey } from './audioKey';
import { getDb, type RecordingRecord } from './db';
import { clearAllLocalClips, clearLocalClip, setLocalClip } from './voice';

/** Guarda la grabación de un texto (reemplaza la anterior) y la deja lista para sonar. */
export async function saveRecording(text: string, data: ArrayBuffer, mime: string, now: number = Date.now()): Promise<RecordingRecord> {
  const key = audioKey(text);
  if (!key) throw new Error('Texto vacío');
  const record: RecordingRecord = { key, text, mime, data, at: now };
  await (await getDb()).put('recordings', record);
  setLocalClip(key, data, mime);
  return record;
}

export async function listRecordings(): Promise<RecordingRecord[]> {
  return (await getDb()).getAll('recordings');
}

export async function deleteRecording(key: string): Promise<void> {
  await (await getDb()).delete('recordings', key);
  clearLocalClip(key);
}

/** Borra todas las grabaciones del dispositivo. */
export async function deleteAllRecordings(): Promise<void> {
  await (await getDb()).clear('recordings');
  clearAllLocalClips();
}

/** Para `initVoice`: las grabaciones guardadas, en el formato que usa la voz. */
export async function loadRecordingsForVoice(): Promise<{ key: string; data: ArrayBuffer; mime: string }[]> {
  return (await listRecordings()).map((r) => ({ key: r.key, data: r.data, mime: r.mime }));
}
