/**
 * Todo lo que la app puede decir en voz alta, sin duplicados y con la indicación de cómo decirlo.
 * Lo usan `npm run audio:list`, el modo de grabación y el diagnóstico de textos sin audio.
 *
 * Fuentes: frases fijas, refuerzos, introducciones y conteo; los ejercicios de cada actividad
 * (se arman con muchas semillas, así que cubren casi todo el contenido); la escalera de
 * pronunciación; y todas las palabras de `phonemes.json`. Lo que se escape se descubre en uso:
 * `voice.noteMissing` anota cada texto pedido a `speak` que no tenía clip.
 */
import { ACTIVITIES } from '../activities/registry';
import type { BuildContext, Item } from '../activities/types';
import { COUNT_WORDS } from '../activities/praxias';
import { audioKey } from './audioKey';
import { LADDER_ACTIVITY_ID, LADDER_STEPS, exercisesFor, ladderContent } from './ladder';
import { MINIMAL_PAIRS } from './minimalPairs';
import { FINISH_PHRASE, PRAISES, lookAgain, listenAgain, retryPhrase } from './phrases';
import { PHONEMES } from './phonemes';
import { seeded } from './random';

export type AudioCategory = 'refuerzo' | 'frase' | 'intro' | 'sonido' | 'instruccion' | 'ejercicio' | 'repeticion' | 'palabra';

export interface AudioText {
  key: string;
  text: string;
  category: AudioCategory;
  /** Prioridad de grabación: 1 = primero. */
  priority: number;
  /** Cómo decirlo (para quien graba). */
  how: string;
}

export const CATEGORY_LABEL: Record<AudioCategory, string> = {
  refuerzo: 'Elogios',
  frase: 'Frases fijas y conteo',
  intro: 'Introducción de cada actividad',
  sonido: 'Sonidos',
  instruccion: 'Instrucciones de ejercicios',
  ejercicio: 'Escalera de pronunciación',
  repeticion: 'Repeticiones con calma',
  palabra: 'Palabras sueltas',
};

const BASE: Record<AudioCategory, { priority: number; how: string }> = {
  refuerzo: { priority: 1, how: 'Alegre y cálido, sin exagerar. Frase corta.' },
  frase: { priority: 1, how: 'Claro y amable, a ritmo lento y natural.' },
  intro: { priority: 1, how: 'Claro y amable, a ritmo lento.' },
  sonido: { priority: 2, how: 'Di el SONIDO, no el nombre de la letra: aislado, corto y limpio, sin vocal de más.' },
  instruccion: { priority: 3, how: 'Instrucción clara y lenta, tono amable. Marca bien cada palabra.' },
  ejercicio: { priority: 3, how: 'Clara y lenta. Si hay un sonido (como «sss»), dilo como SONIDO, no como nombre de letra.' },
  repeticion: { priority: 4, how: 'Con calma y paciencia, un poco más despacio. (El reintento usa este mismo clip a 0,9×).' },
  palabra: { priority: 5, how: 'Una palabra, clara y natural. Si trae guiones o comas, sepáralas con una pausa breve.' },
};

/** Cuántas semillas se usan para sacar los ejercicios de cada actividad. */
const SAMPLES = 60;

class Collector {
  private map = new Map<string, AudioText>();
  add(text: string, category: AudioCategory, how?: string): void {
    const t = text.trim();
    const key = audioKey(t);
    if (!key) return;
    const prev = this.map.get(key);
    const base = BASE[category];
    // Si el mismo texto aparece en dos categorías, manda la de mayor prioridad (número menor).
    if (prev && prev.priority <= base.priority) return;
    this.map.set(key, { key, text: t, category, priority: base.priority, how: how ?? base.how });
  }
  list(): AudioText[] {
    return [...this.map.values()].sort(
      (a, b) => a.priority - b.priority || a.category.localeCompare(b.category) || a.text.localeCompare(b.text, 'es'),
    );
  }
}

function addItem(c: Collector, item: Item): void {
  c.add(item.prompt, 'instruccion');
  c.add(lookAgain(item.prompt), 'repeticion');
  c.add(retryPhrase(item.model ?? item.target), 'repeticion');
  if (item.model) c.add(listenAgain(item.model), 'repeticion');
  const data = (item.data ?? {}) as { syllables?: unknown; pages?: unknown; say?: unknown };
  if (Array.isArray(data.syllables) && data.syllables.every((s) => typeof s === 'string')) {
    c.add(data.syllables.join(', '), 'palabra', 'Separa las sílabas con una pausa breve (a ritmo lento).');
  }
  if (Array.isArray(data.pages)) {
    for (const p of data.pages as { text?: unknown }[]) if (typeof p.text === 'string') c.add(p.text, 'instruccion');
  }
  if (typeof data.say === 'string') c.add(data.say, 'sonido', 'Imita el sonido del animal o del objeto, corto y natural.');
}

/** Textos de todo lo que la app puede decir. Determinista: mismas entradas, misma lista. */
export function collectAudioTexts(): AudioText[] {
  const c = new Collector();

  for (const p of PRAISES) c.add(p, 'refuerzo');
  c.add(FINISH_PHRASE, 'frase');
  for (const w of COUNT_WORDS) if (w) c.add(w, 'frase', 'Una sola palabra, como al contar con un niño.');

  for (const a of ACTIVITIES) {
    c.add(a.intro, 'intro');
    if (a.id === LADDER_ACTIVITY_ID) continue; // se enumera aparte, directamente
    for (let level = 1; level <= a.maxLevel; level++) {
      for (let seed = 1; seed <= SAMPLES; seed++) {
        const ctx: BuildContext = { age: 5, phonemes: {}, ladders: [] };
        for (const item of a.buildItems(level, a.itemCount ?? 4, seeded(seed * 7919 + level), ctx)) addItem(c, item);
      }
    }
  }

  // Pares mínimos: todas las palabras (por si alguna no salió en el muestreo).
  for (const p of MINIMAL_PAIRS) {
    for (const w of [p.a, p.b]) {
      c.add(`Toca ${w.word}.`, 'instruccion');
      c.add(listenAgain(w.word), 'repeticion');
      c.add(w.word, 'palabra');
    }
  }

  // Escalera: cada sonido, cada escalón, varias semillas.
  for (const p of PHONEMES.filter((x) => x.kind === 'sound')) {
    const info = ladderContent(p.id);
    if (!info) continue;
    c.add(info.say, 'sonido');
    for (const w of info.warmups ?? []) c.add(w, 'ejercicio');
    c.add(info.cue, 'ejercicio');
    for (let step = 0; step < LADDER_STEPS.length; step++) {
      for (let seed = 1; seed <= 12; seed++) {
        for (const ex of exercisesFor({ phonemeId: p.id, step }, seeded(seed))) {
          c.add(ex.prompt, 'ejercicio');
          c.add(retryPhrase(ex.model), 'repeticion');
        }
      }
    }
  }

  // Todas las palabras de los fonemas (evaluación de pronunciación y escalera).
  for (const p of PHONEMES) for (const w of p.words) c.add(w.word, 'palabra');

  return c.list();
}

export interface Coverage {
  total: number;
  withAudio: number;
  missing: AudioText[];
  byCategory: Record<AudioCategory, { total: number; withAudio: number }>;
}

/** Cobertura: cuántos textos ya tienen clip (según `hasAudio`). */
export function coverage(texts: readonly AudioText[], hasAudio: (t: AudioText) => boolean): Coverage {
  const byCategory = Object.fromEntries(
    (Object.keys(CATEGORY_LABEL) as AudioCategory[]).map((k) => [k, { total: 0, withAudio: 0 }]),
  ) as Coverage['byCategory'];
  const missing: AudioText[] = [];
  let withAudio = 0;
  for (const t of texts) {
    byCategory[t.category].total += 1;
    if (hasAudio(t)) {
      withAudio += 1;
      byCategory[t.category].withAudio += 1;
    } else missing.push(t);
  }
  return { total: texts.length, withAudio, missing, byCategory };
}

/** CSV con comillas (para abrir en una hoja de cálculo y entregar al locutor). */
export function toCsv(texts: readonly AudioText[]): string {
  const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = texts.map((t) => [t.key, t.priority, t.category, t.text, t.how].map(q).join(','));
  return ['clave,prioridad,categoria,texto,como_decirlo', ...rows].join('\n') + '\n';
}
