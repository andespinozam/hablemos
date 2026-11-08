import { describe, expect, it } from 'vitest';
import { VOCAB } from './listenPoint';
import { naming } from './naming';
import { PHRASES, phrase, shuffleTiles } from './phrase';
import { CATEGORIES, sorting } from './sorting';
import { seeded } from '../lib/random';

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('contenido: categorías', () => {
  it('cada categoría del vocabulario tiene su ficha, y viceversa', () => {
    const inVocab = [...new Set(VOCAB.map((w) => w.category))].sort();
    expect(CATEGORIES.map((c) => c.id).sort()).toEqual(inVocab);
    expect(unique(CATEGORIES.map((c) => c.id))).toBe(true);
    for (const c of CATEGORIES) {
      expect(c.label).toBeTruthy();
      expect(c.phrase).toBeTruthy();
      expect(c.emoji).toBeTruthy();
    }
  });
  it('cada categoría tiene al menos 2 palabras de nivel 1 para armar el grupo', () => {
    for (const c of CATEGORIES) {
      expect(VOCAB.filter((w) => w.category === c.id && w.level === 1).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('contenido: frases', () => {
  it('ids únicos; 2-4 fichas; texto y emoji en cada una', () => {
    expect(unique(PHRASES.map((p) => p.id))).toBe(true);
    for (const p of PHRASES) {
      expect([1, 2]).toContain(p.level);
      expect(p.tiles.length).toBeGreaterThanOrEqual(2);
      expect(p.tiles.length).toBeLessThanOrEqual(4);
      expect(p.spoken).toMatch(/\.$/);
      expect(p.scene).toBeTruthy();
      for (const t of p.tiles) {
        expect(t.text.trim()).toBeTruthy();
        expect(t.emoji).toBeTruthy();
      }
    }
  });
  it('hay al menos 6 por nivel; el nivel 2 tiene frases de 3 y 4 fichas', () => {
    for (const lv of [1, 2]) expect(PHRASES.filter((p) => p.level === lv).length).toBeGreaterThanOrEqual(6);
    const sizes = new Set(PHRASES.filter((p) => p.level === 2).map((p) => p.tiles.length));
    expect(sizes.has(3) && sizes.has(4)).toBe(true);
    expect(PHRASES.filter((p) => p.level === 1).every((p) => p.tiles.length <= 3)).toBe(true);
  });
  it('las fichas son una por palabra clave: el texto de las fichas aparece en la frase hablada', () => {
    for (const p of PHRASES) {
      const spoken = p.spoken.toLowerCase();
      for (const t of p.tiles) expect(spoken).toContain(t.text.toLowerCase());
    }
  });
});

describe('¿Qué es esto?: constructor', () => {
  it('5 palabras distintas, repartidas entre categorías, y con el modelo hablado', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const items = naming.buildItems(level, 5, seeded(seed));
        expect(items).toHaveLength(5);
        expect(unique(items.map((i) => i.id))).toBe(true);
        const cats = items.map((i) => VOCAB.find((w) => w.id === i.id)!.category);
        expect(new Set(cats).size).toBe(5);
        for (const it of items) {
          const w = VOCAB.find((x) => x.id === it.id)!;
          expect(it.target).toBe(w.word);
          expect(it.model).toBe(`Es ${w.article} ${w.word}.`);
          expect(w.level).toBeLessThanOrEqual(level);
        }
      }
    }
  });
  it('en el nivel 2 prefiere palabras del nivel 2', () => {
    const items = naming.buildItems(2, 5, seeded(3));
    expect(items.every((i) => VOCAB.find((w) => w.id === i.id)!.level === 2)).toBe(true);
  });
});

describe('Categorías: constructor', () => {
  it('nivel 1 = 2 grupos y 4 objetos; nivel 2 = 3 grupos y 6; 2 objetos por grupo', () => {
    for (const seed of SEEDS) {
      for (const [level, bins, objs] of [
        [1, 2, 4],
        [2, 3, 6],
      ] as const) {
        const items = sorting.buildItems(level, 3, seeded(seed));
        expect(items).toHaveLength(3);
        expect(unique(items.map((i) => i.id))).toBe(true);
        for (const it of items) {
          const d = it.data as unknown as {
            bins: { id: string }[];
            objects: { id: string; bin: string; emoji: string }[];
          };
          expect(d.bins).toHaveLength(bins);
          expect(unique(d.bins.map((b) => b.id))).toBe(true);
          expect(d.objects).toHaveLength(objs);
          expect(unique(d.objects.map((o) => o.id))).toBe(true);
          for (const b of d.bins) expect(d.objects.filter((o) => o.bin === b.id)).toHaveLength(2);
          for (const o of d.objects) {
            expect(d.bins.map((b) => b.id)).toContain(o.bin);
            // el objeto realmente pertenece a esa categoría
            expect(VOCAB.find((w) => w.id === o.id)!.category).toBe(o.bin);
            expect(VOCAB.find((w) => w.id === o.id)!.level).toBeLessThanOrEqual(level);
          }
        }
      }
    }
  });
  it('la instrucción nombra todos los grupos', () => {
    const [it] = sorting.buildItems(2, 1, seeded(2));
    const d = it.data as unknown as { bins: { phrase: string }[] };
    for (const b of d.bins) expect(it.prompt).toContain(b.phrase);
    expect(it.prompt.startsWith('Pon cada cosa con su grupo: ')).toBe(true);
  });
});

describe('Arma la frase: constructor', () => {
  it('fichas con ids por posición; el orden mostrado es una permutación distinta del correcto', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const items = phrase.buildItems(level, 4, seeded(seed));
        expect(items).toHaveLength(4);
        expect(unique(items.map((i) => i.id))).toBe(true);
        for (const it of items) {
          const d = it.data as unknown as { tiles: { id: string }[]; order: string[] };
          const correct = d.tiles.map((t) => t.id);
          expect([...d.order].sort()).toEqual([...correct].sort());
          expect(d.order).not.toEqual(correct);
          expect(PHRASES.find((p) => p.id === it.id)!.level).toBe(level);
        }
      }
    }
  });
  it('la instrucción dice la frase completa antes de pedir que se arme', () => {
    const [it] = phrase.buildItems(1, 1, seeded(4));
    const p = PHRASES.find((x) => x.id === it.id)!;
    expect(it.prompt).toBe(`Mira: ${p.spoken} Ahora arma la frase.`);
  });
});

describe('shuffleTiles', () => {
  it('nunca devuelve el mismo orden, ni siquiera con un rng que lo repite', () => {
    expect(shuffleTiles(['a', 'b'], () => 0.999)).not.toEqual(['a', 'b']);
    expect(shuffleTiles(['a', 'b', 'c'], () => 0.999)).not.toEqual(['a', 'b', 'c']);
    for (const seed of SEEDS) expect(shuffleTiles([1, 2, 3, 4], seeded(seed))).not.toEqual([1, 2, 3, 4]);
  });
  it('una sola ficha se devuelve igual', () => {
    expect(shuffleTiles(['a'], seeded(1))).toEqual(['a']);
  });
});
