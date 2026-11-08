import content from '../content/phonemes.json';
import type { PhonemeStat } from './phonemeStats';
import { shuffle, type Rng } from './random';

/** Dónde cae el fonema en la palabra ('palabra' = grupos sin fonema, p. ej. "3 sílabas"). */
export type Position = 'inicio' | 'medio' | 'final' | 'palabra';

export interface PhonemeWord {
  /** Palabra sin guiones: "pato". */
  word: string;
  syllables: string[];
  emoji: string;
  position: Position;
}

export interface Phoneme {
  id: string;
  /** Nombre para el adulto: "p", "r suave (pero)". */
  name: string;
  /** Edad (años) desde la que se trabaja. */
  age: 3 | 4 | 5;
  /** Avanzado u opcional (rr y grupos con r). */
  advanced: boolean;
  kind: 'sound' | 'syllables';
  /** Expresiones regulares (sobre la palabra sin acentos) de las letras que lo representan. */
  patterns: string[];
  words: PhonemeWord[];
}

interface RawPhoneme {
  id: string;
  name: string;
  age: number;
  advanced?: boolean;
  kind?: 'sound' | 'syllables';
  patterns: string[];
  words: string[];
}

const ACCENT_MAP: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' };

/** Quita acentos y diéresis letra por letra (misma longitud; la ñ se conserva). */
export function fold(text: string): string {
  return text.toLowerCase().replace(/[áéíóúü]/g, (c) => ACCENT_MAP[c]);
}

/** "pa-to 🦆" → { word, syllables, emoji }. El emoji es todo lo que sigue al primer espacio. */
export function parseEntry(entry: string): { word: string; syllables: string[]; emoji: string } {
  const space = entry.indexOf(' ');
  if (space < 0) throw new Error(`Entrada sin emoji: "${entry}"`);
  const syllables = entry.slice(0, space).split('-');
  return { word: syllables.join(''), syllables, emoji: entry.slice(space + 1).trim() };
}

interface Match {
  start: number;
  end: number;
}

function findMatches(word: string, patterns: readonly string[]): Match[] {
  if (patterns.length === 0) return [];
  const folded = fold(word);
  const re = new RegExp(patterns.map((p) => `(?:${p})`).join('|'), 'g');
  const out: Match[] = [];
  for (const m of folded.matchAll(re)) {
    if (m[0].length === 0) continue;
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Posición del fonema en la palabra, o null si la palabra no lo contiene. */
export function positionOf(word: string, patterns: readonly string[]): Position | null {
  const matches = findMatches(word, patterns);
  if (matches.length === 0) return null;
  if (matches.some((m) => m.start === 0)) return 'inicio';
  if (matches.some((m) => m.end === word.length)) return 'final';
  return 'medio';
}

export interface Segment {
  text: string;
  hit: boolean;
}

/** Parte la palabra en trozos y marca los que son el fonema objetivo (para resaltarlo). */
export function markWord(word: string, patterns: readonly string[]): Segment[] {
  const matches = findMatches(word, patterns);
  const out: Segment[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.start < pos) continue;
    if (m.start > pos) out.push({ text: word.slice(pos, m.start), hit: false });
    out.push({ text: word.slice(m.start, m.end), hit: true });
    pos = m.end;
  }
  if (pos < word.length) out.push({ text: word.slice(pos), hit: false });
  return out;
}

export const PHONEMES: Phoneme[] = (content.phonemes as RawPhoneme[]).map((p) => {
  const kind = p.kind ?? 'sound';
  return {
    id: p.id,
    name: p.name,
    age: p.age as 3 | 4 | 5,
    advanced: p.advanced === true,
    kind,
    patterns: p.patterns,
    words: p.words.map((entry): PhonemeWord => {
      const { word, syllables, emoji } = parseEntry(entry);
      // Si la palabra no contiene el fonema, la prueba de contenido lo detecta; aquí no se rompe la app.
      const position = kind === 'syllables' ? 'palabra' : (positionOf(word, p.patterns) ?? 'medio');
      return { word, syllables, emoji, position };
    }),
  };
});

export function getPhoneme(id: string): Phoneme | undefined {
  return PHONEMES.find((p) => p.id === id);
}

/**
 * Fonemas que corresponden a la edad. Los avanzados (rr y grupos con r) solo entran a los 5 años,
 * en el nivel 2 y cuando ya se practicaron todos los demás de su edad.
 */
export function eligiblePhonemes(
  age: number,
  level: number,
  stats: Record<string, PhonemeStat>,
  all: readonly Phoneme[] = PHONEMES,
): Phoneme[] {
  const regular = all.filter((p) => !p.advanced && p.age <= age);
  const allPracticed = regular.every((p) => (stats[p.id]?.n ?? 0) > 0);
  const advanced = age >= 5 && level >= 2 && allPracticed ? all.filter((p) => p.advanced && p.age <= age) : [];
  return [...regular, ...advanced];
}

/**
 * Elige `count` fonemas: primero los nunca practicados (al azar), luego los de menor logro
 * y, a igualdad, los practicados hace más tiempo. A lo sumo uno avanzado.
 */
export function pickPhonemes(
  eligible: readonly Phoneme[],
  stats: Record<string, PhonemeStat>,
  count: number,
  rng: Rng,
): Phoneme[] {
  const ranked = shuffle(eligible, rng).sort((a, b) => {
    const sa = stats[a.id];
    const sb = stats[b.id];
    if (!sa || !sb) return sa ? 1 : sb ? -1 : 0; // los nuevos primero
    return sa.ratio - sb.ratio || sa.last - sb.last;
  });
  const out: Phoneme[] = [];
  for (const p of ranked) {
    if (p.advanced && out.some((x) => x.advanced)) continue;
    out.push(p);
    if (out.length === count) break;
  }
  return out;
}

/**
 * Palabras de un fonema. Nivel 1: se prefiere el fonema al inicio (lo más fácil);
 * nivel 2: en medio y al final. Siempre distintas.
 */
export function pickWords(phoneme: Phoneme, level: number, count: number, rng: Rng): PhonemeWord[] {
  const preferred: Position[] = level >= 2 ? ['medio', 'final'] : ['inicio'];
  const first = shuffle(
    phoneme.words.filter((w) => preferred.includes(w.position)),
    rng,
  );
  const rest = shuffle(
    phoneme.words.filter((w) => !preferred.includes(w.position)),
    rng,
  );
  return [...first, ...rest].slice(0, count);
}
