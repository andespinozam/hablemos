import { describe, expect, it } from 'vitest';
import {
  PHONEMES,
  eligiblePhonemes,
  fold,
  getPhoneme,
  markWord,
  parseEntry,
  pickPhonemes,
  pickWords,
  positionOf,
  type Phoneme,
} from './phonemes';
import { seeded } from './random';
import { countSyllables, hyphenationProblems } from './syllables';

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

describe('contenido: fonemas por edad', () => {
  const ids = (age: number, advanced = false) => PHONEMES.filter((p) => p.age === age && p.advanced === advanced).map((p) => p.id);

  it('3 años: vocales, p, m, n, ñ, t, k, f, b, d, g, y', () => {
    expect(ids(3).sort()).toEqual(['a', 'e', 'i', 'o', 'u', 'p', 'm', 'n', 'ñ', 't', 'k', 'f', 'b', 'd', 'g', 'y'].sort());
  });
  it('4 años: ch, l, s, j y palabras de 3 sílabas', () => {
    expect(ids(4).sort()).toEqual(['ch', 'l', 's', 'j', 'tres-silabas'].sort());
  });
  it('5 años: r suave, grupos con l y s final', () => {
    expect(ids(5).sort()).toEqual(['r', 'bl', 'pl', 'cl', 'fl', 'gl', 's-final'].sort());
  });
  it('rr y los grupos con r están marcados como avanzados', () => {
    expect(ids(5, true).sort()).toEqual(['rr', 'br', 'pr', 'cr', 'fr', 'gr', 'tr', 'dr'].sort());
    expect(PHONEMES.filter((p) => p.advanced).every((p) => p.age === 5)).toBe(true);
  });
  it('ids únicos', () => {
    expect(unique(PHONEMES.map((p) => p.id))).toBe(true);
  });
});

describe('contenido: palabras de cada fonema', () => {
  it('al menos 12 palabras distintas por fonema, cada una con su dibujo', () => {
    for (const p of PHONEMES) {
      expect(p.words.length, `${p.id} tiene ${p.words.length}`).toBeGreaterThanOrEqual(12);
      expect(unique(p.words.map((w) => w.word)), `${p.id} repite palabras`).toBe(true);
      for (const w of p.words) expect(w.emoji, `${p.id}/${w.word} sin emoji`).toBeTruthy();
    }
  });

  it('toda palabra contiene realmente el fonema de su lista', () => {
    const bad: string[] = [];
    for (const p of PHONEMES) {
      if (p.kind === 'syllables') continue;
      for (const w of p.words) if (positionOf(w.word, p.patterns) === null) bad.push(`${p.id}: ${w.word}`);
    }
    expect(bad).toEqual([]);
  });

  it('la separación en sílabas es coherente con la cuenta de vocales y sin cortes imposibles', () => {
    const bad: string[] = [];
    for (const p of PHONEMES) {
      for (const w of p.words) {
        const hyph = w.syllables.join('-');
        if (countSyllables(w.word) !== w.syllables.length) bad.push(`${p.id}: ${hyph} (cuenta ${countSyllables(w.word)})`);
        for (const problem of hyphenationProblems(hyph)) bad.push(`${p.id}: ${hyph} → ${problem}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('"palabras de 3 sílabas" son todas de 3 sílabas', () => {
    const p = getPhoneme('tres-silabas')!;
    expect(p.words.every((w) => w.syllables.length === 3)).toBe(true);
  });

  it('r suave no incluye rr ni palabras que empiezan con r', () => {
    const p = getPhoneme('r')!;
    for (const w of p.words) {
      expect(w.word, w.word).not.toMatch(/rr/);
      expect(w.word.startsWith('r'), w.word).toBe(false);
    }
  });

  it('s final: todas terminan en s; solo hay posición "final"', () => {
    const p = getPhoneme('s-final')!;
    expect(p.words.every((w) => w.word.endsWith('s') && w.position === 'final')).toBe(true);
  });

  it('los fonemas que pueden ir al inicio tienen palabras con el fonema al inicio y en medio', () => {
    for (const id of ['p', 'm', 't', 'k', 'f', 'b', 'd', 'g', 'y', 'ch', 'l', 's', 'j']) {
      const pos = new Set(getPhoneme(id)!.words.map((w) => w.position));
      expect(pos.has('inicio'), `${id} sin inicio`).toBe(true);
      expect(pos.has('medio'), `${id} sin medio`).toBe(true);
    }
  });

  it('los emojis son de versiones antiguas (sin Emoji 13+, que fallan en tablets viejas)', () => {
    // Lista de emojis modernos que se evitan a propósito.
    const modern = ['🪟', '🪞', '🪜', '🪗', '🦭', '🦬', '🪶', '🫔', '🛖', '🪹', '🛟', '🫐', '🪆', '🪅', '🪵', '🪙', '🪈', '🪧'];
    for (const p of PHONEMES) for (const w of p.words) expect(modern.some((m) => w.emoji.includes(m)), `${p.id}/${w.word}`).toBe(false);
  });
});

describe('funciones de fonemas', () => {
  it('parseEntry separa sílabas y emoji (incluye emojis con espacios internos o dobles)', () => {
    expect(parseEntry('pa-to 🦆')).toEqual({ word: 'pato', syllables: ['pa', 'to'], emoji: '🦆' });
    expect(parseEntry('pies 🦶🦶').emoji).toBe('🦶🦶');
    expect(() => parseEntry('pato')).toThrow();
  });
  it('fold quita acentos y diéresis sin cambiar la longitud ni la ñ', () => {
    expect(fold('cigüeña')).toBe('cigueña');
    expect(fold('árbol')).toBe('arbol');
    expect(fold('pingüino')).toBe('pinguino');
    expect(fold('ñandú')).toBe('ñandu');
    expect(fold('cigüeña')).toHaveLength('cigüeña'.length);
  });
  it('positionOf: inicio, medio y final', () => {
    expect(positionOf('pato', ['p(?![lr])'])).toBe('inicio');
    expect(positionOf('sopa', ['p(?![lr])'])).toBe('medio');
    expect(positionOf('mar', ['r'])).toBe('final');
    expect(positionOf('gato', ['p'])).toBeNull();
  });
  it('positionOf: p no cuenta dentro de pl/pr (son otros fonemas)', () => {
    expect(positionOf('plato', ['p(?![lr])'])).toBeNull();
    expect(positionOf('plato', ['pl'])).toBe('inicio');
  });
  it('markWord resalta el fonema y conserva el texto original con acentos', () => {
    expect(markWord('pato', ['p'])).toEqual([
      { text: 'p', hit: true },
      { text: 'ato', hit: false },
    ]);
    const segs = markWord('lápiz', ['l', 'p']);
    expect(segs.map((s) => s.text).join('')).toBe('lápiz');
    expect(segs.filter((s) => s.hit).map((s) => s.text)).toEqual(['l', 'p']);
    expect(markWord('sol', [])).toEqual([{ text: 'sol', hit: false }]);
  });
});

describe('eligiblePhonemes', () => {
  const none = {};
  it('solo incluye fonemas de la edad o menores, sin avanzados', () => {
    const at3 = eligiblePhonemes(3, 1, none).map((p) => p.id);
    expect(at3).toContain('p');
    expect(at3).not.toContain('ch');
    expect(at3).not.toContain('bl');
    const at4 = eligiblePhonemes(4, 1, none).map((p) => p.id);
    expect(at4).toContain('ch');
    expect(at4).not.toContain('r');
  });
  it('los avanzados requieren 5 años, nivel 2 y haber practicado todos los demás', () => {
    const regular = PHONEMES.filter((p) => !p.advanced && p.age <= 5);
    const allDone = Object.fromEntries(regular.map((p) => [p.id, { n: 1, ratio: 1, last: 1 }]));
    expect(eligiblePhonemes(5, 2, none).some((p) => p.advanced)).toBe(false);
    expect(eligiblePhonemes(5, 1, allDone).some((p) => p.advanced)).toBe(false);
    expect(eligiblePhonemes(4, 2, allDone).some((p) => p.advanced)).toBe(false);
    expect(eligiblePhonemes(5, 2, allDone).some((p) => p.advanced)).toBe(true);
  });
});

describe('pickPhonemes', () => {
  const pool = ['p', 'm', 'n', 't'].map((id) => getPhoneme(id)!);
  it('prioriza los nunca practicados', () => {
    const stats = { p: { n: 4, ratio: 0.2, last: 5 }, m: { n: 4, ratio: 0.3, last: 5 } };
    for (const seed of SEEDS) {
      const ids = pickPhonemes(pool, stats, 2, seeded(seed)).map((p) => p.id);
      expect(ids.sort()).toEqual(['n', 't']);
    }
  });
  it('entre los practicados, el de menor logro primero y luego el más antiguo', () => {
    const stats = {
      p: { n: 3, ratio: 0.9, last: 10 },
      m: { n: 3, ratio: 0.3, last: 50 },
      n: { n: 3, ratio: 0.3, last: 20 },
      t: { n: 3, ratio: 0.6, last: 5 },
    };
    expect(pickPhonemes(pool, stats, 3, seeded(1)).map((p) => p.id)).toEqual(['n', 'm', 't']);
  });
  it('a lo sumo un fonema avanzado por sesión', () => {
    const adv = PHONEMES.filter((p) => p.advanced);
    for (const seed of SEEDS) {
      expect(pickPhonemes(adv, {}, 2, seeded(seed))).toHaveLength(1);
    }
  });
});

describe('pickWords', () => {
  const p = getPhoneme('p') as Phoneme;
  it('nivel 1 prefiere el fonema al inicio; nivel 2, en medio o al final', () => {
    for (const seed of SEEDS) {
      expect(pickWords(p, 1, 3, seeded(seed)).every((w) => w.position === 'inicio')).toBe(true);
      expect(pickWords(p, 2, 3, seeded(seed)).every((w) => w.position !== 'inicio')).toBe(true);
    }
  });
  it('devuelve palabras distintas y completa con otras posiciones si faltan', () => {
    const many = pickWords(p, 1, 99, seeded(1));
    expect(many).toHaveLength(p.words.length);
    expect(unique(many.map((w) => w.word))).toBe(true);
    expect(many[0].position).toBe('inicio');
  });
});
