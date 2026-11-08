/**
 * Respaldo en JSON de los datos del dispositivo. El archivo contiene nombres y fechas de
 * nacimiento de los niños: debe guardarse y compartirse con cuidado.
 *
 * Formato v2 (Fase 12): agrega evaluaciones de pronunciación (`pronunciation`) y escaleras
 * (`ladders`). Los archivos v1 siguen importándose (esas listas quedan vacías). Las grabaciones de la
 * voz del niño NO se incluyen salvo que se pida (`includeRecordings`): van como base64 y el archivo
 * puede ser grande. Las grabaciones de la voz del adulto (`recordings`) nunca entran: se exportan en ZIP.
 */
import { parseYMD } from './age';
import { fromBase64, isBase64, toBase64 } from './base64';
import {
  DB_VERSION,
  getDb,
  type AssessmentRecord,
  type ChildProfile,
  type ChildRecordingRecord,
  type LadderRecord,
  type LevelRecord,
  type PronunciationRecord,
  type ResultRecord,
  type SessionRecord,
} from './db';

export const BACKUP_FORMAT = 'hablemos-backup';
/** Versión del formato del archivo (no de la base). */
export const BACKUP_VERSION = 2;

export interface BackupData {
  profiles: ChildProfile[];
  sessions: SessionRecord[];
  results: ResultRecord[];
  levels: LevelRecord[];
  assessments: AssessmentRecord[];
  /** v2. En archivos v1 no existe: se lee como lista vacía. */
  pronunciation: PronunciationRecord[];
  ladders: LadderRecord[];
  /** Solo si se pidió incluirlas. */
  childRecordings?: BackupChildRecording[];
}

/** Grabación del niño dentro del respaldo: el audio va en base64. */
export type BackupChildRecording = Omit<ChildRecordingRecord, 'data'> & { data: string };

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  dbVersion: number;
  data: BackupData;
}

export interface BackupSummary {
  profiles: number;
  sessions: number;
  results: number;
  assessments: number;
  pronunciation: number;
  ladders: number;
  childRecordings: number;
  names: string[];
}

export interface ExportOptions {
  /** Incluir las grabaciones de la voz del niño (opción explícita; agranda el archivo). */
  includeRecordings?: boolean;
}

export async function exportBackup(now: number = Date.now(), options: ExportOptions = {}): Promise<Backup> {
  const db = await getDb();
  const [profiles, sessions, results, levels, assessments, pronunciation, ladders] = await Promise.all([
    db.getAll('profiles'),
    db.getAll('sessions'),
    db.getAll('results'),
    db.getAll('levels'),
    db.getAll('assessments'),
    db.getAll('pronunciation'),
    db.getAll('ladders'),
  ]);
  const data: BackupData = { profiles, sessions, results, levels, assessments, pronunciation, ladders };
  if (options.includeRecordings) {
    const recs = await db.getAll('childRecordings');
    data.childRecordings = recs.map((r) => ({ ...r, data: toBase64(r.data) }));
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now, dbVersion: DB_VERSION, data };
}

/** Nombre de archivo, p. ej. `hablemos-respaldo-2026-11-08.json`. */
export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `hablemos-respaldo-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export type ValidationResult = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const RATINGS = new Set(['full', 'help', 'not_yet']);
const MAX_ERRORS = 8;

/** Revisa que el archivo tenga la forma esperada antes de tocar la base. Nunca lanza. */
export function validateBackup(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (msg: string) => {
    if (errors.length < MAX_ERRORS) errors.push(msg);
  };

  if (!isObj(raw)) return { ok: false, errors: ['El archivo no es un respaldo de Hablemos.'] };
  if (raw.format !== BACKUP_FORMAT) return { ok: false, errors: ['El archivo no es un respaldo de Hablemos.'] };
  if (!isNum(raw.version) || raw.version > BACKUP_VERSION) {
    return { ok: false, errors: ['El respaldo es de una versión más nueva de la app. Actualiza Hablemos e inténtalo de nuevo.'] };
  }
  const data = raw.data;
  if (!isObj(data)) return { ok: false, errors: ['Al respaldo le falta la sección de datos.'] };
  for (const key of ['profiles', 'sessions', 'results', 'levels', 'assessments'] as const) {
    if (!Array.isArray(data[key])) return { ok: false, errors: [`Al respaldo le falta la lista "${key}".`] };
  }
  // v1 no trae estas listas; v2 sí. Si vienen, deben ser listas.
  for (const key of ['pronunciation', 'ladders', 'childRecordings'] as const) {
    if (data[key] !== undefined && !Array.isArray(data[key])) return { ok: false, errors: [`La lista "${key}" del respaldo no es válida.`] };
  }
  const d = data as Record<'profiles' | 'sessions' | 'results' | 'levels' | 'assessments', unknown[]>;
  const extra = data as { pronunciation?: unknown[]; ladders?: unknown[]; childRecordings?: unknown[] };

  const profileIds = new Set<string>();
  d.profiles.forEach((p, i) => {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !isStr(p.avatar) || !isNum(p.createdAt) || !isStr(p.birthDate) || !parseYMD(p.birthDate)) {
      fail(`Perfil ${i + 1} incompleto o con datos inválidos.`);
    } else profileIds.add(p.id);
  });
  const known = (id: unknown) => isStr(id) && profileIds.has(id);

  d.sessions.forEach((s, i) => {
    if (!isObj(s) || !isStr(s.id) || !known(s.profileId) || !isNum(s.startedAt) || !Array.isArray(s.activityIds)) fail(`Sesión ${i + 1} inválida o de un perfil que no está en el respaldo.`);
    else if (s.kind !== undefined && !['practice', 'baseline', 'reassessment'].includes(s.kind as string)) fail(`Sesión ${i + 1} con tipo desconocido.`);
  });
  d.results.forEach((r, i) => {
    if (
      !isObj(r) || !isStr(r.id) || !isStr(r.sessionId) || !known(r.profileId) || !isStr(r.activityId) || !isStr(r.itemId) ||
      !isStr(r.area) || !isNum(r.level) || !RATINGS.has(r.rating as string) || !isNum(r.score) || r.score < 0 || r.score > 1 || !isNum(r.at)
    ) fail(`Resultado ${i + 1} inválido.`);
  });
  d.levels.forEach((l, i) => {
    if (!isObj(l) || !isStr(l.key) || !known(l.profileId) || !isStr(l.activityId) || !isNum(l.level)) fail(`Nivel ${i + 1} inválido.`);
  });
  d.assessments.forEach((a, i) => {
    const itemsOk = isObj(a) && Array.isArray(a.items) && a.items.every((x) => isObj(x) && isStr(x.area) && isStr(x.activityId) && isNum(x.level) && isObj(x.item) && isStr(x.item.id) && typeof x.item.prompt === 'string' && typeof x.item.target === 'string');
    if (!isObj(a) || !isStr(a.id) || !known(a.profileId) || !['baseline', 'reassessment'].includes(a.kind as string) || !isStr(a.sessionId) || !isNum(a.createdAt) || !itemsOk) fail(`Evaluación ${i + 1} inválida.`);
  });

  (extra.pronunciation ?? []).forEach((p, i) => {
    const ok =
      isObj(p) && isStr(p.id) && known(p.profileId) && ['baseline', 'reassessment'].includes(p.kind as string) && isNum(p.createdAt) && isNum(p.ageYears) &&
      Array.isArray(p.items) && p.items.every((x) => isObj(x) && isStr(x.id) && isStr(x.word) && Array.isArray(x.syllables)) &&
      Array.isArray(p.responses) &&
      p.responses.every(
        (x) =>
          isObj(x) && isStr(x.itemId) && ['espontanea', 'repetida'].includes(x.mode as string) &&
          ['correcta', 'sustituida', 'omitida', 'distorsionada'].includes(x.status as string),
      );
    if (!ok) fail(`Evaluación de pronunciación ${i + 1} inválida.`);
  });
  (extra.ladders ?? []).forEach((l, i) => {
    const ok =
      isObj(l) && isStr(l.key) && known(l.profileId) && isStr(l.phonemeId) && ['active', 'queued', 'done'].includes(l.state as string) && isNum(l.order) &&
      isNum(l.step) && l.step >= 0 && l.step <= 5 && Array.isArray(l.successSessions) && isNum(l.createdAt) && isNum(l.updatedAt);
    if (!ok) fail(`Escalera ${i + 1} inválida.`);
  });
  (extra.childRecordings ?? []).forEach((r, i) => {
    const ok =
      isObj(r) && isStr(r.id) && known(r.profileId) && isStr(r.text) && ['evaluacion', 'escalera'].includes(r.source as string) &&
      isStr(r.mime) && isNum(r.at) && isBase64(r.data);
    if (!ok) fail(`Grabación ${i + 1} inválida.`);
  });

  if (errors.length > 0) return { ok: false, errors };
  const input = raw as unknown as Backup;
  // Normaliza: un respaldo v1 se lee como v2 con las listas nuevas vacías.
  const backup: Backup = {
    ...input,
    data: {
      ...input.data,
      pronunciation: (extra.pronunciation ?? []) as PronunciationRecord[],
      ladders: (extra.ladders ?? []) as LadderRecord[],
    },
  };
  return {
    ok: true,
    backup,
    summary: {
      profiles: backup.data.profiles.length,
      sessions: backup.data.sessions.length,
      results: backup.data.results.length,
      assessments: backup.data.assessments.length,
      pronunciation: backup.data.pronunciation.length,
      ladders: backup.data.ladders.length,
      childRecordings: backup.data.childRecordings?.length ?? 0,
      names: backup.data.profiles.map((p) => p.name),
    },
  };
}

/** Texto -> respaldo validado. Nunca lanza. */
export function parseBackup(text: string): ValidationResult {
  try {
    return validateBackup(JSON.parse(text));
  } catch {
    return { ok: false, errors: ['El archivo no se pudo leer: no es un JSON válido.'] };
  }
}

/**
 * 'replace' borra todo lo que hay y deja solo el respaldo; 'merge' agrega y, si un registro ya existe
 * (mismo id), lo reemplaza con el del respaldo. Todo ocurre en una sola transacción: o entra todo o nada.
 */
export async function importBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<void> {
  const db = await getDb();
  const stores = ['profiles', 'sessions', 'results', 'levels', 'assessments', 'pronunciation', 'ladders', 'childRecordings'] as const;
  // Se decodifica ANTES de abrir la transacción: si el audio está dañado, no se toca nada.
  const recordings: ChildRecordingRecord[] = (backup.data.childRecordings ?? []).map((r) => ({ ...r, data: fromBase64(r.data) }));
  const tx = db.transaction([...stores], 'readwrite');
  if (mode === 'replace') {
    // Reemplazar deja SOLO el respaldo: también las grabaciones del niño (si el respaldo no las trae, se borran).
    await Promise.all(stores.map((name) => tx.objectStore(name).clear()));
  }
  const { profiles, sessions, results, levels, assessments, pronunciation, ladders } = backup.data;
  await Promise.all([
    ...profiles.map((r) => tx.objectStore('profiles').put(r)),
    ...sessions.map((r) => tx.objectStore('sessions').put(r)),
    ...results.map((r) => tx.objectStore('results').put(r)),
    ...levels.map((r) => tx.objectStore('levels').put(r)),
    ...assessments.map((r) => tx.objectStore('assessments').put(r)),
    ...pronunciation.map((r) => tx.objectStore('pronunciation').put(r)),
    ...ladders.map((r) => tx.objectStore('ladders').put(r)),
    ...recordings.map((r) => tx.objectStore('childRecordings').put(r)),
  ]);
  await tx.done;
}
