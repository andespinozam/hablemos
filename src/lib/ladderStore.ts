import { getDb, type LadderRecord, type PronunciationRecord } from './db';
import { advanceLadders, syncFromEvaluation } from './ladder';
import { analyzeSounds } from './pronunciation';
import { listResults } from './progress';

export async function listLadders(profileId: string): Promise<LadderRecord[]> {
  const all = await (await getDb()).getAllFromIndex('ladders', 'byProfile', profileId);
  return all.sort((a, b) => a.order - b.order);
}

/** Guarda solo las escaleras que cambiaron (en una transacción). */
async function saveChanged(before: readonly LadderRecord[], after: readonly LadderRecord[]): Promise<void> {
  const old = new Map(before.map((l) => [l.key, l]));
  const changed = after.filter((l) => JSON.stringify(old.get(l.key)) !== JSON.stringify(l));
  if (changed.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('ladders', 'readwrite');
  await Promise.all(changed.map((l) => tx.store.put(l)));
  await tx.done;
}

/** Crea o actualiza las escaleras desde una evaluación de pronunciación terminada. */
export async function syncLaddersFromEvaluation(record: PronunciationRecord, now: number = Date.now()): Promise<LadderRecord[]> {
  const before = await listLadders(record.profileId);
  const after = syncFromEvaluation(before, analyzeSounds(record), record.ageYears, record.profileId, now);
  await saveChanged(before, after);
  return after.sort((a, b) => a.order - b.order);
}

/** Tras una sesión de práctica: sube de escalón los sonidos con "Lo logró" en 3 sesiones distintas. */
export async function applyLadderProgress(profileId: string, sessionId: string, now: number = Date.now()): Promise<LadderRecord[]> {
  const before = await listLadders(profileId);
  if (before.length === 0) return before;
  const results = await listResults(profileId);
  const after = advanceLadders(before, results, sessionId, now);
  await saveChanged(before, after);
  return after;
}

/** El adulto corrige la sustitución observada de un sonido (vacía = la borra). */
export async function setSubstitution(key: string, substitution: string | undefined, now: number = Date.now()): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('ladders', 'readwrite');
  const ladder = await tx.store.get(key);
  if (ladder) {
    const next: LadderRecord = { ...ladder, updatedAt: now };
    if (substitution) {
      next.substitution = substitution;
      next.substitutionSource = 'adulto';
    } else {
      delete next.substitution;
      next.substitutionSource = 'adulto';
    }
    await tx.store.put(next);
  }
  await tx.done;
}
