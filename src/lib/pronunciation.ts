/**
 * Evaluación de pronunciación (zona de adultos). Lógica pura: sin React y sin base de datos.
 * La app NO califica la pronunciación: el adulto marca cada palabra y aquí solo se ordena y resume.
 * Aleatoriedad y fecha actual se reciben como parámetros.
 */
import settings from '../content/pronunciation.json';
import substitutionsContent from '../content/substitutions.json';
import { REASSESSMENT_DAYS, type ReassessmentState } from './assessment';
import type { PronunciationItem, PronunciationRecord, PronunciationResponse, PronunciationStatus } from './db';
import { PHONEMES, getPhoneme, type Phoneme, type PhonemeWord, type Position } from './phonemes';
import { shuffle, type Rng } from './random';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Edades con fonemas definidos (3 a 5): fuera de ese rango se usa el extremo más cercano. */
export const MIN_SCREEN_AGE = 3;
export const MAX_SCREEN_AGE = 5;
/** Ejercicios por bloque: unos 5 minutos a ~25 s cada uno. */
export const BLOCK_TARGET = 12;
/** Fonemas de la edad siguiente (o avanzados) que se ofrecen como opcionales. */
export const OPTIONAL_PHONEMES = 2;
/** Palabras por proceso en la mini revisión. */
export const PROCESS_WORDS = 3;
/** Con este porcentaje de aciertos o más, el sonido se considera consolidado. */
export const CONSOLIDATED_RATIO = 0.8;

export const STATUS_LABEL: Record<PronunciationStatus, string> = {
  correcta: 'Correcta',
  sustituida: 'Sustituida',
  omitida: 'Omitida',
  distorsionada: 'Distorsionada',
};
export const POSITION_LABEL: Record<Position, string> = {
  inicio: 'al inicio',
  medio: 'en medio',
  final: 'al final',
  palabra: 'en la palabra',
};
export const PROCESS_LABEL = {
  silabas: 'Omisión de sílabas átonas',
  grupos: 'Reducción de grupos consonánticos',
} as const;

const POSITION_ORDER: Position[] = ['inicio', 'medio', 'final', 'palabra'];

export function clampAge(ageYears: number): number {
  return Math.min(MAX_SCREEN_AGE, Math.max(MIN_SCREEN_AGE, Math.floor(ageYears)));
}

function toItem(phoneme: Phoneme, w: PhonemeWord, optional: boolean): PronunciationItem {
  return {
    id: `${phoneme.id}/${w.word}`,
    phonemeId: phoneme.id,
    word: w.word,
    syllables: w.syllables,
    emoji: w.emoji,
    position: w.position,
    optional,
  };
}

/**
 * Elige palabras de un fonema cubriendo inicio, medio y final (las que existan): 3 palabras si
 * hay palabras en 3 posiciones; si no, 2. Primero una de cada posición y luego se completa.
 */
export function pickWordsByPosition(phoneme: Phoneme, rng: Rng, max = 3): PhonemeWord[] {
  const byPos = new Map<Position, PhonemeWord[]>();
  for (const w of shuffle(phoneme.words, rng)) {
    const list = byPos.get(w.position) ?? [];
    list.push(w);
    byPos.set(w.position, list);
  }
  const positions = POSITION_ORDER.filter((p) => byPos.has(p));
  const count = Math.min(max, positions.length >= 3 ? 3 : 2, phoneme.words.length);
  const out: PhonemeWord[] = [];
  for (const p of positions) {
    if (out.length === count) break;
    out.push(byPos.get(p)![0]);
  }
  for (const p of positions) {
    for (const w of byPos.get(p)!.slice(1)) {
      if (out.length === count) break;
      out.push(w);
    }
  }
  return out.sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
}

const excluded = new Set<string>(settings.excluded);
const clusterIds = new Set<string>(settings.clusterPhonemes);

const isSound = (p: Phoneme) => p.kind === 'sound' && !excluded.has(p.id);

/** Fonemas que se evalúan como parte de la edad (todos los de la edad o menos, sin avanzados). */
export function requiredPhonemes(ageYears: number, all: readonly Phoneme[] = PHONEMES): Phoneme[] {
  const age = clampAge(ageYears);
  return all.filter((p) => isSound(p) && !p.advanced && p.age <= age);
}

/** Opcionales: 1-2 de la edad siguiente; a los 5 años, avanzados (metas suaves). */
export function optionalPhonemes(ageYears: number, rng: Rng, all: readonly Phoneme[] = PHONEMES): Phoneme[] {
  const age = clampAge(ageYears);
  let pool = all.filter((p) => isSound(p) && !p.advanced && p.age === age + 1);
  if (pool.length === 0) pool = all.filter((p) => isSound(p) && p.advanced && p.age <= age);
  return shuffle(pool, rng)
    .slice(0, OPTIONAL_PHONEMES)
    .sort((a, b) => all.indexOf(a) - all.indexOf(b));
}

/** Mini revisión de procesos: palabras largas (sílabas átonas) y palabras con grupos consonánticos. */
export function processItems(rng: Rng, all: readonly Phoneme[] = PHONEMES): PronunciationItem[] {
  const seen = new Set<string>();
  const long: PhonemeWord[] = [];
  const clusters: { w: PhonemeWord; id: string }[] = [];
  for (const p of all) {
    for (const w of p.words) {
      if (seen.has(w.word)) continue;
      seen.add(w.word);
      if (w.syllables.length >= 3) long.push(w);
      if (clusterIds.has(p.id)) clusters.push({ w, id: p.id });
    }
  }
  const make = (process: 'silabas' | 'grupos', w: PhonemeWord): PronunciationItem => ({
    id: `proceso-${process}/${w.word}`,
    process,
    word: w.word,
    syllables: w.syllables,
    emoji: w.emoji,
    position: 'palabra',
    optional: false,
  });
  // Los grupos se reparten entre distintos fonemas (bl, tr…) para no repetir el mismo.
  const usedIds = new Set<string>();
  const chosen: PhonemeWord[] = [];
  for (const c of shuffle(clusters, rng)) {
    if (usedIds.has(c.id)) continue;
    usedIds.add(c.id);
    chosen.push(c.w);
    if (chosen.length === PROCESS_WORDS) break;
  }
  return [
    ...shuffle(long, rng).slice(0, PROCESS_WORDS).map((w) => make('silabas', w)),
    ...chosen.map((w) => make('grupos', w)),
  ];
}

/**
 * Arma todos los ítems: por cada fonema de la edad, 2-3 palabras; luego los opcionales y,
 * al final, la mini revisión de procesos. Los ítems de un mismo fonema quedan juntos.
 */
export function buildPronunciationItems(ageYears: number, rng: Rng, all: readonly Phoneme[] = PHONEMES): PronunciationItem[] {
  const items: PronunciationItem[] = [];
  for (const p of requiredPhonemes(ageYears, all)) {
    for (const w of pickWordsByPosition(p, rng)) items.push(toItem(p, w, false));
  }
  for (const p of optionalPhonemes(ageYears, rng, all)) {
    for (const w of pickWordsByPosition(p, rng)) items.push(toItem(p, w, true));
  }
  items.push(...processItems(rng, all));
  return items;
}

function groupKey(item: PronunciationItem): string {
  return item.process ? `proceso-${item.process}` : (item.phonemeId ?? item.id);
}

/** Parte los ítems en bloques de ~5 minutos sin separar las palabras de un mismo grupo. */
export function chunkBlocks(items: readonly PronunciationItem[], target = BLOCK_TARGET): PronunciationItem[][] {
  const groups: PronunciationItem[][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && groupKey(last[0]) === groupKey(item)) last.push(item);
    else groups.push([item]);
  }
  const blocks: PronunciationItem[][] = [];
  let current: PronunciationItem[] = [];
  for (const g of groups) {
    if (current.length > 0 && current.length + g.length > target) {
      blocks.push(current);
      current = [];
    }
    current.push(...g);
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

/**
 * Los mismos ítems en otro orden (reevaluación): se mezclan los grupos y las palabras de cada
 * grupo; los opcionales siguen después de los obligatorios y los procesos al final.
 */
export function shuffleForRepeat(items: readonly PronunciationItem[], rng: Rng): PronunciationItem[] {
  const groups = new Map<string, PronunciationItem[]>();
  for (const item of items) {
    const k = groupKey(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  const lists = [...groups.values()];
  const part = (pred: (g: PronunciationItem[]) => boolean) =>
    shuffle(lists.filter(pred), rng).flatMap((g) => shuffle(g, rng));
  return [
    ...part((g) => !g[0].process && !g[0].optional),
    ...part((g) => !g[0].process && g[0].optional),
    ...part((g) => g[0].process === 'silabas'),
    ...part((g) => g[0].process === 'grupos'),
  ];
}

// ---------- Avance y pausa ----------

/** Reemplaza (o agrega) la respuesta de un ítem. */
export function upsertResponse(responses: readonly PronunciationResponse[], next: PronunciationResponse): PronunciationResponse[] {
  return [...responses.filter((r) => r.itemId !== next.itemId), next];
}

export function responseOf(responses: readonly PronunciationResponse[], itemId: string): PronunciationResponse | undefined {
  return responses.find((r) => r.itemId === itemId);
}

export interface BlockProgress {
  total: number;
  answered: number;
  /** Índice del primer bloque con ítems sin responder (-1 si todo está respondido). */
  nextBlock: number;
  blocks: number;
  done: boolean;
}

export function blockProgress(record: Pick<PronunciationRecord, 'items' | 'responses'>): BlockProgress {
  const blocks = chunkBlocks(record.items);
  const answered = new Set(record.responses.map((r) => r.itemId));
  const nextBlock = blocks.findIndex((b) => b.some((i) => !answered.has(i.id)));
  const count = record.items.filter((i) => answered.has(i.id)).length;
  return { total: record.items.length, answered: count, nextBlock, blocks: blocks.length, done: nextBlock === -1 };
}

/** Normaliza lo que escribe el adulto como sustitución: sin espacios, minúsculas, corto. */
export function cleanSubstitution(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '').slice(0, 8);
}

/** Sustituciones sugeridas para un fonema (lista ampliable en `content/substitutions.json`). */
export function substitutionOptions(phonemeId: string): string[] {
  const map = substitutionsContent.substitutions as Record<string, string[]>;
  return map[phonemeId] ?? [];
}

// ---------- Resultados ----------

export type Consistency = 'constante' | 'variable';
export type Classification = 'esperable' | 'estimular' | 'consolidado';

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  esperable: 'Esperable para su edad',
  estimular: 'A estimular',
  consolidado: 'Consolidado',
};

export interface PositionResult {
  position: Position;
  n: number;
  correct: number;
  /** Estado de la posición: correcta si todas lo fueron. */
  state: 'correcta' | 'con-errores';
  /** Sustitución más frecuente (si la hubo). */
  substitution?: string;
  /** null si todo fue correcto. */
  consistency: Consistency | null;
}

export interface PhonemeResult {
  phonemeId: string;
  name: string;
  age: number;
  advanced: boolean;
  optional: boolean;
  n: number;
  correct: number;
  /** 0..1 */
  accuracy: number;
  /** Cuántas respuestas fueron tras escuchar al adulto. */
  repeated: number;
  substitution?: string;
  consistency: Consistency | null;
  positions: PositionResult[];
  classification: Classification;
}

/** Firma de una respuesta: dos respuestas iguales (mismo estado y sustitución) son "constantes". */
function signature(r: PronunciationResponse): string {
  return r.status === 'correcta' ? 'correcta' : `${r.status}:${r.substitution ?? ''}`;
}

function consistencyOf(rs: readonly PronunciationResponse[]): Consistency | null {
  if (rs.length === 0 || rs.every((r) => r.status === 'correcta')) return null;
  return new Set(rs.map(signature)).size === 1 ? 'constante' : 'variable';
}

/** Sustitución más repetida; a igualdad gana la que apareció primero. */
export function dominantSubstitution(rs: readonly PronunciationResponse[]): string | undefined {
  const counts = new Map<string, number>();
  for (const r of rs) if (r.status === 'sustituida' && r.substitution) counts.set(r.substitution, (counts.get(r.substitution) ?? 0) + 1);
  let best: string | undefined;
  let bestN = 0;
  for (const [s, n] of counts) {
    if (n > bestN) {
      best = s;
      bestN = n;
    }
  }
  return best;
}

/**
 * Clasificación orientativa:
 * - consolidado: logro >= 80 %;
 * - esperable para su edad: aún no consolidado, pero es un sonido de edades mayores o avanzado;
 * - a estimular: aún no consolidado y ya corresponde a su edad o a una menor.
 */
export function classify(phoneme: Pick<Phoneme, 'age' | 'advanced'>, ageYears: number, accuracy: number): Classification {
  if (accuracy >= CONSOLIDATED_RATIO) return 'consolidado';
  if (phoneme.advanced || phoneme.age > clampAge(ageYears)) return 'esperable';
  return 'estimular';
}

/** Resultados por sonido y posición (solo de los ítems ya respondidos y que no son de proceso). */
export function analyzeSounds(record: Pick<PronunciationRecord, 'items' | 'responses' | 'ageYears'>): PhonemeResult[] {
  const order = new Map(PHONEMES.map((p, i) => [p.id, i]));
  const byPhoneme = new Map<string, { optional: boolean; entries: { item: PronunciationItem; r: PronunciationResponse }[] }>();
  for (const item of record.items) {
    if (!item.phonemeId) continue;
    const r = responseOf(record.responses, item.id);
    if (!r) continue;
    const g = byPhoneme.get(item.phonemeId) ?? { optional: item.optional, entries: [] };
    g.entries.push({ item, r });
    byPhoneme.set(item.phonemeId, g);
  }
  const out: PhonemeResult[] = [];
  for (const [phonemeId, g] of byPhoneme) {
    const phoneme = getPhoneme(phonemeId);
    if (!phoneme) continue; // el contenido pudo cambiar: se ignora el sonido que ya no existe
    const rs = g.entries.map((e) => e.r);
    const correct = rs.filter((r) => r.status === 'correcta').length;
    const accuracy = correct / rs.length;
    const positions: PositionResult[] = POSITION_ORDER.filter((pos) => g.entries.some((e) => e.item.position === pos)).map((pos) => {
      const prs = g.entries.filter((e) => e.item.position === pos).map((e) => e.r);
      const pc = prs.filter((r) => r.status === 'correcta').length;
      return {
        position: pos,
        n: prs.length,
        correct: pc,
        state: pc === prs.length ? 'correcta' : 'con-errores',
        substitution: dominantSubstitution(prs),
        consistency: consistencyOf(prs),
      };
    });
    out.push({
      phonemeId,
      name: phoneme.name,
      age: phoneme.age,
      advanced: phoneme.advanced,
      optional: g.optional,
      n: rs.length,
      correct,
      accuracy,
      repeated: rs.filter((r) => r.mode === 'repetida').length,
      substitution: dominantSubstitution(rs),
      consistency: consistencyOf(rs),
      positions,
      classification: classify(phoneme, record.ageYears, accuracy),
    });
  }
  return out.sort((a, b) => (order.get(a.phonemeId) ?? 0) - (order.get(b.phonemeId) ?? 0));
}

export interface WorkItem {
  phonemeId: string;
  name: string;
  group: 'temprano' | 'edad' | 'tardio';
  /** Los tardíos son metas suaves y opcionales. */
  soft: boolean;
  accuracy: number;
  substitution?: string;
}

export const WORK_GROUP_LABEL: Record<WorkItem['group'], string> = {
  temprano: 'Primero: sonidos tempranos que aún no logra',
  edad: 'Luego: sonidos de su edad',
  tardio: 'Al final, como metas suaves y opcionales: sonidos más tardíos',
};

/**
 * Orden de trabajo: primero los sonidos de edades menores que falla, luego los de su edad y,
 * al final, los tardíos (de edades mayores o avanzados) como metas suaves. Los consolidados no entran.
 */
export function workOrder(results: readonly PhonemeResult[], ageYears: number): WorkItem[] {
  const age = clampAge(ageYears);
  const rank = { temprano: 0, edad: 1, tardio: 2 } as const;
  const items: WorkItem[] = [];
  for (const r of results) {
    if (r.classification === 'consolidado') continue;
    items.push({
      phonemeId: r.phonemeId,
      name: r.name,
      group: r.classification === 'esperable' ? 'tardio' : r.age < age ? 'temprano' : 'edad',
      soft: r.classification === 'esperable',
      accuracy: r.accuracy,
      substitution: r.substitution,
    });
  }
  const order = new Map(PHONEMES.map((p, i) => [p.id, i]));
  return items.sort(
    (a, b) =>
      rank[a.group] - rank[b.group] ||
      a.accuracy - b.accuracy ||
      (order.get(a.phonemeId) ?? 0) - (order.get(b.phonemeId) ?? 0),
  );
}

export interface ProcessResult {
  process: 'silabas' | 'grupos';
  n: number;
  /** Palabras en las que se omitió o redujo. */
  affected: number;
  words: string[];
  level: 'no-observado' | 'ocasional' | 'frecuente';
}

/** Mini revisión: "frecuente" si 2 o más de las palabras mostraron el proceso. */
export function analyzeProcesses(record: Pick<PronunciationRecord, 'items' | 'responses'>): ProcessResult[] {
  const out: ProcessResult[] = [];
  for (const process of ['silabas', 'grupos'] as const) {
    const answered = record.items
      .filter((i) => i.process === process)
      .map((item) => ({ item, r: responseOf(record.responses, item.id) }))
      .filter((e): e is { item: PronunciationItem; r: PronunciationResponse } => e.r !== undefined);
    if (answered.length === 0) continue;
    const hit = answered.filter((e) => e.r.status !== 'correcta');
    out.push({
      process,
      n: answered.length,
      affected: hit.length,
      words: hit.map((e) => e.item.word),
      level: hit.length === 0 ? 'no-observado' : hit.length >= 2 ? 'frecuente' : 'ocasional',
    });
  }
  return out;
}

export interface SoundChange {
  phonemeId: string;
  name: string;
  before: number | null;
  after: number | null;
  /** Puntos porcentuales; null si falta alguno de los dos. */
  delta: number | null;
  beforeClass: Classification | null;
  afterClass: Classification | null;
}

const pct = (x: number) => Math.round(x * 100);

/** Compara dos evaluaciones sonido por sonido. */
export function compareSounds(before: readonly PhonemeResult[], after: readonly PhonemeResult[]): SoundChange[] {
  const ids = [...new Set([...before.map((r) => r.phonemeId), ...after.map((r) => r.phonemeId)])];
  const order = new Map(PHONEMES.map((p, i) => [p.id, i]));
  return ids
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map((id) => {
      const b = before.find((r) => r.phonemeId === id);
      const a = after.find((r) => r.phonemeId === id);
      return {
        phonemeId: id,
        name: (a ?? b)!.name,
        before: b ? pct(b.accuracy) : null,
        after: a ? pct(a.accuracy) : null,
        delta: a && b ? pct(a.accuracy) - pct(b.accuracy) : null,
        beforeClass: b?.classification ?? null,
        afterClass: a?.classification ?? null,
      };
    });
}

// ---------- Selección de evaluaciones y fechas ----------

export function completedPronunciation(records: readonly PronunciationRecord[]): PronunciationRecord[] {
  return records.filter((r) => r.completedAt !== undefined).sort((a, b) => a.completedAt! - b.completedAt!);
}

export function latestPronunciation(records: readonly PronunciationRecord[]): PronunciationRecord | undefined {
  return completedPronunciation(records).at(-1);
}

/** La primera evaluación terminada: referencia para comparar con la última. */
export function firstPronunciation(records: readonly PronunciationRecord[]): PronunciationRecord | undefined {
  return completedPronunciation(records)[0];
}

/** La evaluación a medias más reciente, si hay (para retomarla). */
export function pendingPronunciation(records: readonly PronunciationRecord[]): PronunciationRecord | undefined {
  return records.filter((r) => r.completedAt === undefined).sort((a, b) => b.createdAt - a.createdAt)[0];
}

/** Reevaluación sugerida 28 días después de la última evaluación de pronunciación terminada. */
export function pronunciationStatus(records: readonly PronunciationRecord[], now: number): ReassessmentState {
  const last = latestPronunciation(records);
  if (!last) return { state: 'none' };
  const lastAt = last.completedAt!;
  const dueAt = lastAt + REASSESSMENT_DAYS * DAY_MS;
  if (now >= dueAt) return { state: 'due', lastAt, dueAt, daysOverdue: Math.floor((now - dueAt) / DAY_MS) };
  return { state: 'ok', lastAt, dueAt, daysLeft: Math.ceil((dueAt - now) / DAY_MS) };
}

/** Cuenta de sonidos por clasificación (para el resumen de Seguimiento). */
export function countByClass(results: readonly PhonemeResult[]): Record<Classification, number> {
  const out: Record<Classification, number> = { esperable: 0, estimular: 0, consolidado: 0 };
  for (const r of results) out[r.classification] += 1;
  return out;
}
