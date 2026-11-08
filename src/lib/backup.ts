/**
 * Respaldo en JSON de todos los datos del dispositivo. El archivo contiene nombres y fechas de
 * nacimiento de los niños: debe guardarse y compartirse con cuidado.
 */
import { parseYMD } from './age';
import {
  DB_VERSION,
  getDb,
  type AssessmentRecord,
  type ChildProfile,
  type LevelRecord,
  type ResultRecord,
  type SessionRecord,
} from './db';

export const BACKUP_FORMAT = 'hablemos-backup';
/** Versión del formato del archivo (no de la base). */
export const BACKUP_VERSION = 1;

export interface BackupData {
  profiles: ChildProfile[];
  sessions: SessionRecord[];
  results: ResultRecord[];
  levels: LevelRecord[];
  assessments: AssessmentRecord[];
}

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
  names: string[];
}

export async function exportBackup(now: number = Date.now()): Promise<Backup> {
  const db = await getDb();
  const [profiles, sessions, results, levels, assessments] = await Promise.all([
    db.getAll('profiles'),
    db.getAll('sessions'),
    db.getAll('results'),
    db.getAll('levels'),
    db.getAll('assessments'),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    dbVersion: DB_VERSION,
    data: { profiles, sessions, results, levels, assessments },
  };
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
  const d = data as Record<keyof BackupData, unknown[]>;

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

  if (errors.length > 0) return { ok: false, errors };
  const backup = raw as unknown as Backup;
  return {
    ok: true,
    backup,
    summary: {
      profiles: backup.data.profiles.length,
      sessions: backup.data.sessions.length,
      results: backup.data.results.length,
      assessments: backup.data.assessments.length,
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
  const tx = db.transaction(['profiles', 'sessions', 'results', 'levels', 'assessments'], 'readwrite');
  if (mode === 'replace') {
    await Promise.all([
      tx.objectStore('profiles').clear(),
      tx.objectStore('sessions').clear(),
      tx.objectStore('results').clear(),
      tx.objectStore('levels').clear(),
      tx.objectStore('assessments').clear(),
    ]);
  }
  const { profiles, sessions, results, levels, assessments } = backup.data;
  await Promise.all([
    ...profiles.map((r) => tx.objectStore('profiles').put(r)),
    ...sessions.map((r) => tx.objectStore('sessions').put(r)),
    ...results.map((r) => tx.objectStore('results').put(r)),
    ...levels.map((r) => tx.objectStore('levels').put(r)),
    ...assessments.map((r) => tx.objectStore('assessments').put(r)),
  ]);
  await tx.done;
}
