import { latestBaseline, recommendedLevels } from './assessment';
import { getDb, type AssessmentItem, type AssessmentRecord, type ResultRecord } from './db';
import { newId } from './ids';
import { listResults, setLevel } from './progress';

export async function createAssessment(input: {
  profileId: string;
  kind: 'baseline' | 'reassessment';
  sessionId: string;
  ageYears: number;
  items: AssessmentItem[];
  now?: number;
}): Promise<AssessmentRecord> {
  const record: AssessmentRecord = {
    id: newId(),
    profileId: input.profileId,
    kind: input.kind,
    createdAt: input.now ?? Date.now(),
    sessionId: input.sessionId,
    ageYears: input.ageYears,
    items: input.items,
  };
  await (await getDb()).put('assessments', record);
  return record;
}

export async function listAssessments(profileId: string): Promise<AssessmentRecord[]> {
  const all = await (await getDb()).getAllFromIndex('assessments', 'byProfile', profileId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAssessment(id: string): Promise<AssessmentRecord | undefined> {
  return (await getDb()).get('assessments', id);
}

export function resultsOfAssessment(results: readonly ResultRecord[], assessment: AssessmentRecord): ResultRecord[] {
  return results.filter((r) => r.sessionId === assessment.sessionId);
}

/**
 * Cierra la evaluación. La inicial fija el nivel de partida de cada actividad;
 * la reevaluación solo se registra para comparar (los niveles los sigue moviendo la práctica).
 */
export async function completeAssessment(
  id: string,
  maxLevels: Record<string, number>,
  now: number = Date.now(),
): Promise<AssessmentRecord | undefined> {
  const db = await getDb();
  const record = await db.get('assessments', id);
  if (!record) return undefined;
  const mine = resultsOfAssessment(await listResults(record.profileId), record);
  const levels = recommendedLevels(mine, maxLevels);
  const done: AssessmentRecord = { ...record, completedAt: now, recommendedLevels: levels };
  await db.put('assessments', done);
  if (record.kind === 'baseline') {
    for (const [activityId, level] of Object.entries(levels)) await setLevel(record.profileId, activityId, level, now);
  }
  return done;
}

/** ¿Ya se hizo (y terminó) la evaluación inicial? */
export async function hasBaseline(profileId: string): Promise<boolean> {
  return latestBaseline(await listAssessments(profileId)) !== undefined;
}
