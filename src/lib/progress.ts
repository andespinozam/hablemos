import { getDb, type LevelRecord, type ResultRecord, type SessionKind, type SessionRecord } from './db';
import { newId } from './ids';
import { MIN_ITEMS_FOR_ADAPT, adaptLevel, sessionRatios, type LevelOutcome } from './level';
import { scoreOf, type Rating } from './scoring';

export async function startSession(
  profileId: string,
  activityIds: string[],
  now: number = Date.now(),
  kind: SessionKind = 'practice',
): Promise<SessionRecord> {
  const session: SessionRecord = { id: newId(), profileId, startedAt: now, activityIds };
  if (kind !== 'practice') session.kind = kind;
  await (await getDb()).put('sessions', session);
  return session;
}

export async function finishSession(id: string, now: number = Date.now()): Promise<void> {
  const db = await getDb();
  const session = await db.get('sessions', id);
  if (session) await db.put('sessions', { ...session, endedAt: now });
}

export interface ResultInput {
  sessionId: string;
  profileId: string;
  activityId: string;
  itemId: string;
  target: string;
  area: string;
  phoneme?: string;
  level: number;
  rating: Rating;
}

export async function addResult(input: ResultInput, now: number = Date.now()): Promise<ResultRecord> {
  const record: ResultRecord = { ...input, id: newId(), score: scoreOf(input.rating), at: now };
  await (await getDb()).put('results', record);
  return record;
}

export async function listResults(profileId: string): Promise<ResultRecord[]> {
  return (await getDb()).getAllFromIndex('results', 'byProfile', profileId);
}

export async function listSessions(profileId: string): Promise<SessionRecord[]> {
  const all = await (await getDb()).getAllFromIndex('sessions', 'byProfile', profileId);
  return all.sort((a, b) => a.startedAt - b.startedAt);
}

/** Nivel guardado por actividad; las que no aparecen están en el nivel 1. */
export async function getLevels(profileId: string): Promise<Record<string, number>> {
  const rows = await (await getDb()).getAllFromIndex('levels', 'byProfile', profileId);
  return Object.fromEntries(rows.map((r) => [r.activityId, r.level]));
}

export async function setLevel(profileId: string, activityId: string, level: number, now: number = Date.now()) {
  const row: LevelRecord = { key: `${profileId}:${activityId}`, profileId, activityId, level, updatedAt: now };
  await (await getDb()).put('levels', row);
}

/** Última práctica (ms) por actividad. */
export async function getLastPracticed(profileId: string): Promise<Record<string, number>> {
  const last: Record<string, number> = {};
  for (const r of await listResults(profileId)) {
    last[r.activityId] = Math.max(last[r.activityId] ?? 0, r.at);
  }
  return last;
}

export interface AdaptationResult extends LevelOutcome {
  activityId: string;
}

/**
 * Tras una sesión, ajusta el nivel de cada actividad jugada (con al menos 3 ítems en esa sesión):
 * sube con >= 80 % en 3 sesiones seguidas; baja o repite con < 40 %.
 */
export async function applyAdaptation(
  profileId: string,
  sessionId: string,
  maxLevels: Record<string, number>,
  now: number = Date.now(),
): Promise<AdaptationResult[]> {
  // Las evaluaciones no cuentan para subir o bajar de nivel: solo la práctica.
  const assessmentIds = new Set(
    (await listSessions(profileId)).filter((s) => s.kind === 'baseline' || s.kind === 'reassessment').map((s) => s.id),
  );
  const results = (await listResults(profileId)).filter((r) => !assessmentIds.has(r.sessionId));
  const outcomes: AdaptationResult[] = [];
  const activityIds = [...new Set(results.filter((r) => r.sessionId === sessionId).map((r) => r.activityId))];

  for (const activityId of activityIds) {
    const mine = results.filter((r) => r.sessionId === sessionId && r.activityId === activityId);
    if (mine.length < MIN_ITEMS_FOR_ADAPT) continue;
    const level = mine[0].level;
    const outcome = adaptLevel(level, sessionRatios(results, activityId, level), maxLevels[activityId] ?? level);
    if (outcome.level !== level) await setLevel(profileId, activityId, outcome.level, now);
    outcomes.push({ activityId, ...outcome });
  }
  return outcomes;
}

/** Borra todo lo del niño: sesiones, resultados y niveles (el perfil lo borra `deleteProfile`). */
export async function deleteProgress(profileId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'results', 'levels', 'assessments', 'pronunciation', 'ladders'], 'readwrite');
  const stores = [
    tx.objectStore('sessions'),
    tx.objectStore('results'),
    tx.objectStore('levels'),
    tx.objectStore('assessments'),
    tx.objectStore('pronunciation'),
    tx.objectStore('ladders'),
  ] as const;
  await Promise.all(
    stores.map(async (store) => {
      for (const key of await store.index('byProfile').getAllKeys(profileId)) await store.delete(key);
    }),
  );
  await tx.done;
}
