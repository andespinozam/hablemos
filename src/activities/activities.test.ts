import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from './registry';
import { CONCEPT_ITEMS, concepts } from './concepts';
import { ORDER_OBJECTS, ORDER_PLACES, followOrders } from './followOrders';
import { VOCAB, listenPoint } from './listenPoint';
import { STORIES, story, type QuestionKind } from './story';
import { SCENES } from '../components/Visuals';
import { seeded } from '../lib/random';

const CATEGORIES = ['animales', 'comida', 'ropa', 'cuerpo', 'casa', 'transporte'];
const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('registro', () => {
  it('tiene las actividades 1-4 con ids únicos y datos completos', () => {
    expect(ACTIVITIES.map((a) => a.id)).toEqual(['escucha-senala', 'sigue-orden', 'conceptos', 'mini-cuento']);
    expect(unique(ACTIVITIES.map((a) => a.id))).toBe(true);
    for (const a of ACTIVITIES) {
      expect(a.title).toBeTruthy();
      expect(a.intro).toBeTruthy();
      expect(a.maxLevel).toBeGreaterThanOrEqual(1);
      expect(a.adultRated).toBe(false); // estas actividades califican solas
    }
  });
});

describe('contenido: vocabulario', () => {
  it('ids únicos, categorías válidas, niveles 1-2 y artículo definido', () => {
    expect(unique(VOCAB.map((w) => w.id))).toBe(true);
    for (const w of VOCAB) {
      expect(CATEGORIES).toContain(w.category);
      expect([1, 2]).toContain(w.level);
      expect(['el', 'la', 'los', 'las']).toContain(w.article);
      expect(w.emoji).toBeTruthy();
    }
  });
  it('cada categoría tiene al menos 4 palabras de nivel 1 y 7 en total', () => {
    for (const c of CATEGORIES) {
      expect(VOCAB.filter((w) => w.category === c && w.level === 1).length).toBeGreaterThanOrEqual(4);
      expect(VOCAB.filter((w) => w.category === c).length).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('contenido: conceptos', () => {
  it('ids únicos; la respuesta correcta está entre las opciones; opciones distintas', () => {
    expect(unique(CONCEPT_ITEMS.map((c) => c.id))).toBe(true);
    for (const c of CONCEPT_ITEMS) {
      expect(c.options.length).toBeGreaterThanOrEqual(2);
      expect(unique(c.options.map((o) => o.id))).toBe(true);
      expect(c.options.map((o) => o.id)).toContain(c.correct);
      expect([1, 2]).toContain(c.level);
      for (const o of c.options) if (o.scene) expect(SCENES).toContain(o.scene);
    }
  });
  it('hay conceptos de cada tipo en su nivel', () => {
    const kinds = (lv: number) => new Set(CONCEPT_ITEMS.filter((c) => c.level === lv).map((c) => c.concept));
    expect([...kinds(1)].sort()).toEqual(['cantidad', 'tamaño']);
    expect([...kinds(2)].sort()).toEqual(['arriba-abajo', 'dentro-fuera']);
  });
});

describe('contenido: cuentos', () => {
  it('hay al menos 3 por nivel, con 2-3 páginas y preguntas qué/quién/dónde', () => {
    for (const lv of [1, 2]) expect(STORIES.filter((s) => s.level === lv).length).toBeGreaterThanOrEqual(3);
    expect(unique(STORIES.map((s) => s.id))).toBe(true);
    for (const s of STORIES) {
      expect(s.pages.length).toBeGreaterThanOrEqual(2);
      const kinds = s.questions.map((q) => q.kind).sort();
      expect(kinds).toEqual(['donde', 'que', 'quien'] satisfies QuestionKind[]);
      for (const q of s.questions) {
        expect(q.options.length).toBe(3);
        expect(unique(q.options.map((o) => o.id))).toBe(true);
        expect(q.options.map((o) => o.id)).toContain(q.correct);
      }
    }
  });
});

describe('contenido: órdenes', () => {
  it('hay objetos y lugares suficientes y únicos', () => {
    expect(ORDER_OBJECTS.length).toBeGreaterThanOrEqual(4);
    expect(ORDER_PLACES.length).toBeGreaterThanOrEqual(3);
    expect(unique(ORDER_OBJECTS.map((o) => o.id))).toBe(true);
    expect(unique(ORDER_PLACES.map((o) => o.id))).toBe(true);
  });
});

describe('Escucha y señala: constructor', () => {
  it('nivel 1: 3 opciones de categorías distintas; nivel 2: 4 opciones', () => {
    for (const seed of SEEDS) {
      for (const [level, n] of [
        [1, 3],
        [2, 4],
      ] as const) {
        const items = listenPoint.buildItems(level, 4, seeded(seed));
        expect(items).toHaveLength(4);
        expect(unique(items.map((i) => i.id))).toBe(true);
        for (const it of items) {
          const d = it.data as { options: { id: string }[]; correct: string };
          expect(d.options).toHaveLength(n);
          expect(unique(d.options.map((o) => o.id))).toBe(true);
          expect(d.options.map((o) => o.id)).toContain(d.correct);
          if (level === 1) {
            const cats = d.options.map((o) => VOCAB.find((w) => w.id === o.id)!.category);
            expect(unique(cats)).toBe(true);
          }
        }
      }
    }
  });
  it('nivel 2: los distractores son de la misma categoría que el objetivo', () => {
    for (const seed of SEEDS) {
      for (const it of listenPoint.buildItems(2, 4, seeded(seed))) {
        const d = it.data as { options: { id: string }[]; correct: string };
        const cat = VOCAB.find((w) => w.id === d.correct)!.category;
        const sameCat = d.options.filter((o) => VOCAB.find((w) => w.id === o.id)!.category === cat);
        expect(sameCat.length).toBe(4); // cada categoría tiene >= 7 palabras de nivel <= 2
      }
    }
  });
  it('la instrucción nombra el objetivo con su artículo', () => {
    const [it] = listenPoint.buildItems(1, 1, seeded(3));
    const w = VOCAB.find((x) => x.id === it.id)!;
    expect(it.prompt).toBe(`Toca ${w.article} ${w.word}.`);
  });
});

describe('Sigue la orden: constructor', () => {
  it('nivel 1 = 1 paso, nivel 2 = 2 pasos distintos; los objetos pedidos están en pantalla', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const items = followOrders.buildItems(level, 3, seeded(seed));
        expect(items).toHaveLength(3);
        for (const it of items) {
          const d = it.data as unknown as {
            objects: { id: string }[];
            places: { id: string }[];
            moves: { obj: string; place: string }[];
          };
          expect(d.moves).toHaveLength(level);
          expect(unique(d.moves.map((m) => m.obj))).toBe(true);
          expect(unique(d.moves.map((m) => m.place))).toBe(true);
          for (const m of d.moves) {
            expect(d.objects.map((o) => o.id)).toContain(m.obj);
            expect(d.places.map((p) => p.id)).toContain(m.place);
          }
          expect(it.prompt.startsWith('Pon ')).toBe(true);
          expect(it.prompt.includes(' y luego ')).toBe(level === 2);
        }
      }
    }
  });
  it('ids únicos dentro de la sesión', () => {
    expect(unique(followOrders.buildItems(2, 3, seeded(1)).map((i) => i.id))).toBe(true);
  });
});

describe('Conceptos: constructor', () => {
  it('nivel 1 solo usa conceptos de nivel 1; nivel 2 usa los de nivel 2', () => {
    for (const seed of SEEDS) {
      const l1 = concepts.buildItems(1, 4, seeded(seed));
      expect(l1.every((i) => CONCEPT_ITEMS.find((c) => c.id === i.id)!.level === 1)).toBe(true);
      const l2 = concepts.buildItems(2, 4, seeded(seed));
      expect(l2.every((i) => CONCEPT_ITEMS.find((c) => c.id === i.id)!.level === 2)).toBe(true);
    }
  });
  it('mezcla conceptos distintos y conserva la respuesta entre las opciones', () => {
    for (const seed of SEEDS) {
      const items = concepts.buildItems(2, 4, seeded(seed));
      expect(unique(items.map((i) => i.id))).toBe(true);
      const kinds = new Set(items.map((i) => CONCEPT_ITEMS.find((c) => c.id === i.id)!.concept));
      expect(kinds.size).toBe(2);
      for (const it of items) {
        const d = it.data as { options: { id: string }[]; correct: string };
        expect(d.options.map((o) => o.id)).toContain(d.correct);
      }
    }
  });
});

describe('Mini cuento: constructor', () => {
  it('dos cuentos por sesión, con sus 3 preguntas seguidas; solo la primera trae las páginas', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const items = story.buildItems(level, story.itemCount!, seeded(seed));
        expect(items).toHaveLength(6);
        expect(unique(items.map((i) => i.id))).toBe(true);
        for (let s = 0; s < 2; s++) {
          const group = items.slice(s * 3, s * 3 + 3);
          const storyId = group[0].id.replace(/-(quien|que|donde)$/, '');
          expect(group.every((g) => g.id.startsWith(`${storyId}-`))).toBe(true);
          expect((group[0].data as { pages?: unknown }).pages).toBeDefined();
          expect((group[1].data as { pages?: unknown }).pages).toBeUndefined();
          expect((group[2].data as { pages?: unknown }).pages).toBeUndefined();
          expect(STORIES.find((x) => x.id === storyId)!.level).toBe(level);
        }
      }
    }
  });
  it('la 1.ª pregunta se abre con la 1.ª página; las demás con su pregunta', () => {
    const items = story.buildItems(1, 6, seeded(5));
    const first = STORIES.find((s) => items[0].id.startsWith(s.id))!;
    expect(items[0].prompt).toBe(first.pages[0].text);
    expect(items[1].prompt).toContain('¿');
  });
});
