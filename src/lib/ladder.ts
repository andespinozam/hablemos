/**
 * Escalera de pronunciación: cada sonido "a estimular" trabaja 6 escalones (escuchar el modelo,
 * mirar la boca, sonido aislado, sílaba, palabra y frase corta). Solo se sube de escalón con
 * "Lo logró" en 3 sesiones distintas. Lógica pura: sin React ni base de datos.
 * La app NO califica la pronunciación: califica el adulto.
 */
import content from '../content/ladder.json';
import type { LadderRecord, LadderState, ResultRecord } from './db';
import { getPhoneme, pickWords, positionOf, type Phoneme } from './phonemes';
import type { PhonemeResult } from './pronunciation';
import { workOrder } from './pronunciation';
import { shuffle, type Rng } from './random';
import type { Rating } from './scoring';

/** Id permanente de la actividad (se guarda en sesiones y resultados). */
export const LADDER_ACTIVITY_ID = 'escalera-sonido';

export interface LadderStep {
  id: string;
  title: string;
  short: string;
}
export const LADDER_STEPS: readonly LadderStep[] = content.steps;
export const LAST_STEP = LADDER_STEPS.length - 1;
/** Sesiones distintas con "Lo logró" necesarias para subir de escalón. */
export const SESSIONS_TO_ADVANCE = 3;
/** Cuántas escaleras se trabajan a la vez; las demás esperan su turno. */
export const MAX_ACTIVE_LADDERS = 3;

export interface Mouth {
  lips: 'closed' | 'open' | 'smile' | 'round' | 'teeth';
  tongue: 'rest' | 'tip-up' | 'tip-teeth' | 'tip-down' | 'mid' | 'back' | 'tap';
  air: 'none' | 'stream' | 'burst' | 'nose';
  voice: boolean;
}

export interface PhonemeLadderContent {
  say: string;
  mouth: Mouth;
  cue: string;
  warmups?: string[];
}

export function ladderContent(phonemeId: string): PhonemeLadderContent | undefined {
  return (content.phonemes as Record<string, PhonemeLadderContent>)[phonemeId];
}

export const ladderKey = (profileId: string, phonemeId: string) => `${profileId}:${phonemeId}`;

// ---------- Ids de ítem (el escalón viaja en el id del resultado) ----------

export function ladderItemId(phonemeId: string, step: number, n: number): string {
  return `escalera/${phonemeId}/${step}/${n}`;
}

export function parseLadderItemId(id: string): { phonemeId: string; step: number } | null {
  const m = /^escalera\/(.+)\/(\d+)\/\d+$/.exec(id);
  if (!m) return null;
  return { phonemeId: m[1], step: Number(m[2]) };
}

// ---------- Estado de las escaleras ----------

/**
 * Deja como máximo `MAX_ACTIVE_LADDERS` activas (las de menor `order`) y las demás en espera.
 * Las terminadas no se tocan. Cuando una termina, la siguiente en espera pasa a activa.
 */
export function rebalance(ladders: readonly LadderRecord[], now: number): LadderRecord[] {
  const open = ladders.filter((l) => l.state !== 'done').sort((a, b) => a.order - b.order);
  const states = new Map<string, LadderState>(open.map((l, i) => [l.key, i < MAX_ACTIVE_LADDERS ? 'active' : 'queued']));
  return ladders.map((l) => {
    const next = states.get(l.key);
    return next && next !== l.state ? { ...l, state: next, updatedAt: now } : l;
  });
}

/**
 * Crea o actualiza las escaleras a partir del resultado de una evaluación de pronunciación:
 * - cada sonido "a estimular" tiene su escalera, en el orden de trabajo (tempranos primero);
 * - los tardíos (esperables para su edad) no activan escalera por sí solos;
 * - un sonido que ya quedó consolidado cierra su escalera;
 * - la sustitución observada se guarda, salvo que el adulto ya la haya escrito a mano.
 */
export function syncFromEvaluation(
  existing: readonly LadderRecord[],
  results: readonly PhonemeResult[],
  ageYears: number,
  profileId: string,
  now: number,
): LadderRecord[] {
  const work = workOrder(results, ageYears).filter((w) => !w.soft);
  const byKey = new Map(existing.map((l) => [l.key, l]));
  const touched = new Set<string>();

  work.forEach((w, order) => {
    const key = ladderKey(profileId, w.phonemeId);
    touched.add(key);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        key,
        profileId,
        phonemeId: w.phonemeId,
        state: 'queued',
        order,
        step: 0,
        successSessions: [],
        substitution: w.substitution,
        substitutionSource: w.substitution ? 'evaluacion' : undefined,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }
    const next: LadderRecord = { ...prev, order, updatedAt: now };
    if (prev.state === 'done') {
      // El sonido volvió a salir "a estimular": se reabre en el mismo escalón.
      next.state = 'queued';
      next.successSessions = [];
      delete next.completedAt;
    }
    if (prev.substitutionSource !== 'adulto' && w.substitution) {
      next.substitution = w.substitution;
      next.substitutionSource = 'evaluacion';
    }
    byKey.set(key, next);
  });

  for (const r of results) {
    if (r.classification !== 'consolidado') continue;
    const key = ladderKey(profileId, r.phonemeId);
    const prev = byKey.get(key);
    if (prev && prev.state !== 'done') byKey.set(key, { ...prev, state: 'done', completedAt: now, updatedAt: now });
  }
  // Las que no entraron en esta evaluación se quedan donde estaban, detrás de las del orden nuevo.
  const base = work.length;
  const rest = [...byKey.values()].filter((l) => !touched.has(l.key)).sort((a, b) => a.order - b.order);
  rest.forEach((l, i) => {
    if (l.state !== 'done') byKey.set(l.key, { ...l, order: base + i });
  });
  return rebalance([...byKey.values()], now);
}

/** Registra el resultado de un escalón: "Lo logró" cuenta una vez por sesión; lo demás no resta. */
export function applyLadderSuccess(ladder: LadderRecord, sessionId: string, rating: Rating, now: number): LadderRecord {
  if (ladder.state !== 'active' || rating !== 'full' || ladder.successSessions.includes(sessionId)) return ladder;
  const sessions = [...ladder.successSessions, sessionId];
  if (sessions.length < SESSIONS_TO_ADVANCE) return { ...ladder, successSessions: sessions, updatedAt: now };
  if (ladder.step >= LAST_STEP) return { ...ladder, successSessions: sessions, state: 'done', completedAt: now, updatedAt: now };
  return { ...ladder, step: ladder.step + 1, successSessions: [], updatedAt: now };
}

/**
 * Aplica los resultados de UNA sesión de práctica a las escaleras: solo cuentan los ítems del
 * escalón en que está cada sonido. Devuelve todas las escaleras (rebalanceadas).
 */
export function advanceLadders(
  ladders: readonly LadderRecord[],
  sessionResults: readonly ResultRecord[],
  sessionId: string,
  now: number,
): LadderRecord[] {
  const own = sessionResults.filter((r) => r.activityId === LADDER_ACTIVITY_ID && r.sessionId === sessionId);
  const next = ladders.map((l) => {
    let cur = l;
    for (const r of own) {
      const p = parseLadderItemId(r.itemId);
      if (!p || p.phonemeId !== l.phonemeId || p.step !== l.step) continue;
      cur = applyLadderSuccess(cur, sessionId, r.rating, now);
    }
    return cur;
  });
  return rebalance(next, now);
}

/** Las escaleras en práctica, la menos practicada primero. */
export function activeLadders(ladders: readonly LadderRecord[], lastPracticed: Record<string, number> = {}): LadderRecord[] {
  return ladders
    .filter((l) => l.state === 'active')
    .sort((a, b) => (lastPracticed[a.phonemeId] ?? 0) - (lastPracticed[b.phonemeId] ?? 0) || a.order - b.order);
}

/** Cuántas sesiones faltan para subir de escalón. */
export function sessionsLeft(ladder: Pick<LadderRecord, 'successSessions'>): number {
  return Math.max(0, SESSIONS_TO_ADVANCE - ladder.successSessions.length);
}

// ---------- Ejercicios de cada escalón ----------

export interface LadderExercise {
  id: string;
  phonemeId: string;
  step: number;
  /** Instrucción hablada al abrir el ejercicio. */
  prompt: string;
  /** Lo que se repite con calma tras "Aún no". */
  model: string;
  /** Texto que ve el adulto (sílaba, palabra, frase…). */
  shown: string;
  emojis: string[];
  mouth: Mouth;
  cue: string;
  /** Solo en el escalón de la boca de r y rr: ejercicios previos de lengua sin presión. */
  warmups?: string[];
}

/** Sílabas del fonema tomadas de sus propias palabras (sin escribir sonidos fijos en el código). */
export function syllablesOf(phoneme: Phoneme): string[] {
  const seen = new Set<string>();
  const starts: string[] = [];
  const others: string[] = [];
  for (const w of phoneme.words) {
    for (const s of w.syllables) {
      const syl = s.toLowerCase();
      if (syl.length > 3 || seen.has(syl)) continue;
      const pos = positionOf(syl, phoneme.patterns);
      if (!pos) continue;
      seen.add(syl);
      (pos === 'inicio' ? starts : others).push(syl);
    }
  }
  return [...starts, ...others];
}

/** Frase corta sin artículos (sirve para cualquier género): "mi pato y mi pelota". */
export function phraseOf(words: readonly string[]): string {
  return words.map((w) => `mi ${w}`).join(' y ');
}

/** Ejercicios de un escalón para un sonido (1 a 2, según el escalón). */
export function exercisesFor(ladder: Pick<LadderRecord, 'phonemeId' | 'step'>, rng: Rng): LadderExercise[] {
  const phoneme = getPhoneme(ladder.phonemeId);
  const info = ladderContent(ladder.phonemeId);
  if (!phoneme || !info) return [];
  const step = Math.min(Math.max(ladder.step, 0), LAST_STEP);
  const base = { phonemeId: phoneme.id, step, mouth: info.mouth, cue: info.cue };
  const id = (n: number) => ladderItemId(phoneme.id, step, n);
  const words = pickWords(phoneme, 1, 4, rng);
  const first = words[0];

  switch (LADDER_STEPS[step].id) {
    case 'modelo':
      return [
        {
          ...base,
          id: id(0),
          prompt: `Escucha con atención: ${info.say}. Como en ${first.word}.`,
          model: `${info.say}. Como en ${first.word}.`,
          shown: info.say,
          emojis: [first.emoji],
        },
      ];
    case 'boca': {
      const warm = info.warmups ? shuffle(info.warmups, rng)[0] : undefined;
      const spoken = warm ?? info.cue;
      return [
        {
          ...base,
          id: id(0),
          prompt: `Mira la boca. ${spoken}`,
          model: spoken,
          shown: info.say,
          emojis: [],
          warmups: info.warmups,
        },
      ];
    }
    case 'aislado':
      return [0, 1].map((n) => ({
        ...base,
        id: id(n),
        prompt: `Ahora tú. ${info.say}.`,
        model: `${info.say}.`,
        shown: info.say,
        emojis: [],
      }));
    case 'silaba': {
      const syls = syllablesOf(phoneme);
      const chosen = shuffle(syls.slice(0, 4), rng).slice(0, 2);
      return chosen.map((s, n) => ({ ...base, id: id(n), prompt: `Repite conmigo: ${s}.`, model: `${s}.`, shown: s, emojis: [] }));
    }
    case 'palabra':
      return words.slice(0, 2).map((w, n) => ({
        ...base,
        id: id(n),
        prompt: `Di: ${w.word}.`,
        model: `${w.word}.`,
        shown: w.word,
        emojis: [w.emoji],
      }));
    default: {
      // frase: dos frases con dos palabras distintas cada una (si hay).
      const pool = words.length >= 4 ? words : [...words, ...words];
      return [0, 1].map((n) => {
        const pair = pool.slice(n * 2, n * 2 + 2);
        const phrase = phraseOf(pair.map((w) => w.word));
        return { ...base, id: id(n), prompt: `Di: ${phrase}.`, model: `${phrase}.`, shown: phrase, emojis: pair.map((w) => w.emoji) };
      });
    }
  }
}
