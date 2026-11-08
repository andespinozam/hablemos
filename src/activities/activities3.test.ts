import { describe, expect, it } from 'vitest';
import { GUIDE_KINDS } from '../components/PraxiaGuide';
import { seeded } from '../lib/random';
import { PHONEMES, getPhoneme } from '../lib/phonemes';
import { ACTIVITIES } from './registry';
import { KIND_ORDER, PAIRS, discrimination, syllableWords } from './discrimination';
import { SOUNDS, onomatopoeia } from './onomatopoeia';
import { phonemeWords } from './phonemeWords';
import { COUNT_WORDS, PRAXIAS, praxias } from './praxias';
import type { BuildContext } from './types';

const unique = <T>(xs: readonly T[]) => new Set(xs).size === xs.length;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe('registro 1-13', () => {
  it('tiene las 13 actividades, con ids únicos y todas con minAge 3', () => {
    expect(ACTIVITIES).toHaveLength(13);
    expect(unique(ACTIVITIES.map((a) => a.id))).toBe(true);
    expect(ACTIVITIES.map((a) => a.id).slice(7)).toEqual(['praxias', 'onomatopeyas', 'palabras-fonema', 'discriminacion', 'pares-minimos', 'escalera-sonido']);
  });
  it('califican los adultos: ¿Qué es esto?, praxias, onomatopeyas, palabras con fonema y la escalera', () => {
    expect(
      ACTIVITIES.filter((a) => a.adultRated)
        .map((a) => a.id)
        .sort(),
    ).toEqual(['que-es-esto', 'praxias', 'onomatopeyas', 'palabras-fonema', 'escalera-sonido'].sort());
  });
});

describe('contenido: praxias', () => {
  it('ids únicos; cada guía existe; 3-5 repeticiones con palabra de conteo', () => {
    expect(unique(PRAXIAS.map((p) => p.id))).toBe(true);
    for (const p of PRAXIAS) {
      expect(GUIDE_KINDS).toContain(p.guide);
      expect(p.reps).toBeGreaterThanOrEqual(3);
      expect(COUNT_WORDS[p.reps]).toBeTruthy();
      expect(p.prompt).toMatch(/Cuenta conmigo\.$/);
      expect([1, 2]).toContain(p.level);
    }
  });
  it('cubre todo lo pedido: soplar vela y molino, lengua arriba/abajo/lados, labios o/i y beso', () => {
    const guides = new Set(PRAXIAS.map((p) => p.guide));
    for (const g of ['candle', 'pinwheel', 'tongue-up', 'tongue-down', 'tongue-side', 'lips-o', 'lips-i', 'kiss']) {
      expect(guides.has(g as never), g).toBe(true);
    }
  });
  it('el constructor da 4 ejercicios distintos del nivel pedido', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const items = praxias.buildItems(level, 4, seeded(seed));
        expect(items).toHaveLength(4);
        expect(unique(items.map((i) => i.id))).toBe(true);
        for (const it of items) expect(PRAXIAS.find((p) => p.id === it.id)!.level).toBe(level);
      }
    }
  });
  it('el modelo para reintentar no incluye "Cuenta conmigo"', () => {
    const [it] = praxias.buildItems(1, 1, seeded(1));
    expect(it.model).toBeTruthy();
    expect(it.model).not.toContain('Cuenta conmigo');
  });
});

describe('contenido: onomatopeyas', () => {
  it('ids únicos; sonido, emoji y nombre con artículo', () => {
    expect(unique(SOUNDS.map((s) => s.id))).toBe(true);
    for (const s of SOUNDS) {
      expect(s.say.trim()).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.name).toMatch(/^(el|la) /);
    }
    for (const lv of [1, 2]) expect(SOUNDS.filter((s) => s.level === lv).length).toBeGreaterThanOrEqual(6);
  });
  it('el constructor da 5 ítems con la frase modelo y el sonido como modelo de reintento', () => {
    for (const seed of SEEDS) {
      const items = onomatopoeia.buildItems(1, 5, seeded(seed));
      expect(items).toHaveLength(5);
      expect(unique(items.map((i) => i.id))).toBe(true);
      for (const it of items) {
        const s = SOUNDS.find((x) => x.id === it.id)!;
        expect(it.prompt).toMatch(/^Escucha\. (El|La) /);
        expect(it.prompt).toContain(s.say);
        expect(it.model).toBe(s.say);
      }
    }
  });
});

describe('Palabras con fonema: constructor', () => {
  const ctx = (age: number, phonemes: BuildContext['phonemes'] = {}): BuildContext => ({ age, phonemes });

  it('4 ítems de 2 fonemas alternados, con el fonema en cada ítem', () => {
    for (const seed of SEEDS) {
      const items = phonemeWords.buildItems(1, 4, seeded(seed), ctx(3));
      expect(items).toHaveLength(4);
      expect(unique(items.map((i) => i.id))).toBe(true);
      const phs = items.map((i) => i.phoneme);
      expect(new Set(phs).size).toBe(2);
      expect(phs[0]).toBe(phs[2]);
      expect(phs[1]).toBe(phs[3]);
      expect(phs[0]).not.toBe(phs[1]);
      for (const it of items) expect(it.area).toBe('fonemas');
    }
  });

  it('a los 3 años solo usa fonemas de 3 años; a los 4, de 3 y 4; sin avanzados', () => {
    for (const seed of SEEDS) {
      for (const it of phonemeWords.buildItems(1, 4, seeded(seed), ctx(3))) expect(getPhoneme(it.phoneme!)!.age).toBe(3);
      for (const it of phonemeWords.buildItems(1, 4, seeded(seed), ctx(4))) {
        const p = getPhoneme(it.phoneme!)!;
        expect(p.age).toBeLessThanOrEqual(4);
        expect(p.advanced).toBe(false);
      }
    }
  });

  it('prioriza lo no practicado y lo de menor logro', () => {
    const eligibleAt3 = PHONEMES.filter((p) => !p.advanced && p.age <= 3).map((p) => p.id);
    // Todos practicados con logro alto, salvo "k" (bajo) y "f" (bajo, más antiguo).
    const stats = Object.fromEntries(eligibleAt3.map((id) => [id, { n: 5, ratio: 1, last: 100 }]));
    stats.k = { n: 5, ratio: 0.2, last: 100 };
    stats.f = { n: 5, ratio: 0.2, last: 50 };
    for (const seed of SEEDS) {
      const items = phonemeWords.buildItems(1, 4, seeded(seed), ctx(3, stats));
      expect(new Set(items.map((i) => i.phoneme))).toEqual(new Set(['f', 'k']));
    }
  });

  it('los avanzados aparecen solo a los 5 años, nivel 2 y con todo lo demás practicado', () => {
    const regular = PHONEMES.filter((p) => !p.advanced && p.age <= 5);
    const done = Object.fromEntries(regular.map((p) => [p.id, { n: 9, ratio: 1, last: 9 }]));
    const advancedSeen = new Set<string>();
    for (const seed of SEEDS) {
      for (const it of phonemeWords.buildItems(2, 4, seeded(seed), ctx(5, done))) {
        if (getPhoneme(it.phoneme!)!.advanced) advancedSeen.add(it.phoneme!);
      }
      for (const it of phonemeWords.buildItems(2, 4, seeded(seed), ctx(5))) expect(getPhoneme(it.phoneme!)!.advanced).toBe(false);
    }
    expect(advancedSeen.size).toBeGreaterThan(0);
  });

  it('nivel 1 trae el fonema al inicio cuando existe; la palabra se resalta y se guarda como modelo', () => {
    for (const seed of SEEDS) {
      for (const it of phonemeWords.buildItems(1, 4, seeded(seed), ctx(3, {}))) {
        const p = getPhoneme(it.phoneme!)!;
        const word = p.words.find((w) => it.id === `${p.id}-${w.word}`)!;
        if (p.words.some((w) => w.position === 'inicio')) expect(word.position).toBe('inicio');
        expect(it.model).toBe(word.word);
        const data = it.data as { segments: { text: string; hit: boolean }[]; syllables: string[] };
        expect(data.segments.map((s) => s.text).join('')).toBe(word.word);
        expect(data.segments.some((s) => s.hit)).toBe(true);
        expect(data.syllables.join('')).toBe(word.word);
      }
    }
  });

  it('funciona sin contexto (edad 3 por defecto)', () => {
    const items = phonemeWords.buildItems(1, 4, seeded(1));
    expect(items).toHaveLength(4);
    for (const it of items) expect(getPhoneme(it.phoneme!)!.age).toBe(3);
  });

  it('con "3 sílabas" no resalta letras', () => {
    const only = PHONEMES.filter((p) => p.id === 'tres-silabas');
    expect(only).toHaveLength(1);
    // Se fuerza esa lista pidiendo un contexto donde todo lo demás de 4 años está practicado con buen logro.
    const stats = Object.fromEntries(PHONEMES.filter((p) => p.id !== 'tres-silabas' && p.age <= 4).map((p) => [p.id, { n: 9, ratio: 1, last: 9 }]));
    const items = phonemeWords.buildItems(1, 2, seeded(2), { age: 4, phonemes: stats });
    const it = items.find((i) => i.phoneme === 'tres-silabas')!;
    expect(it).toBeDefined();
    const data = it.data as { segments: { hit: boolean }[]; syllables: string[] };
    expect(data.segments.every((s) => !s.hit)).toBe(true);
    expect(data.syllables).toHaveLength(3);
  });
});

describe('Discriminación auditiva: constructor', () => {
  it('contenido: pares distintos y niveles', () => {
    for (const lv of [1, 2]) expect(PAIRS.filter((p) => p.level === lv).length).toBeGreaterThanOrEqual(6);
    for (const p of PAIRS) expect(p.a).not.toBe(p.b);
  });

  it('5 ítems en el orden igual/diferente, sílabas, ritmo, igual/diferente, sílabas', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const items = discrimination.buildItems(level, 5, seeded(seed));
        expect(items).toHaveLength(5);
        expect(unique(items.map((i) => i.id))).toBe(true);
        expect(items.map((i) => (i.data as { kind: string }).kind)).toEqual([...KIND_ORDER]);
      }
    }
  });

  it('igual/diferente: la instrucción dice las dos palabras y "same" coincide con ellas', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        for (const it of discrimination.buildItems(level, 5, seeded(seed))) {
          const d = it.data as { kind: string; x?: string; y?: string; same?: boolean };
          if (d.kind !== 'samediff') continue;
          expect(d.same).toBe(d.x === d.y);
          expect(it.prompt).toContain(`${d.x}. ${d.y}.`);
          // Algunas palabras (mano, casa) están en pares de los dos niveles: se exige un par DEL NIVEL.
          const fromLevel = PAIRS.some((p) => p.level === level && [p.a, p.b].includes(d.x!) && [p.a, p.b].includes(d.y!));
          expect(fromLevel, `${d.x}/${d.y} nivel ${level}`).toBe(true);
        }
      }
    }
  });

  it('ritmo: 3 opciones distintas del mismo largo, con la correcta entre ellas', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        const it = discrimination.buildItems(level, 5, seeded(seed)).find((i) => (i.data as { kind: string }).kind === 'rhythm')!;
        const d = it.data as unknown as { pattern: string[]; options: { id: string; pattern: string[] }[]; correct: string };
        expect(d.options).toHaveLength(3);
        expect(unique(d.options.map((o) => o.id))).toBe(true);
        expect(d.options.map((o) => o.id)).toContain(d.correct);
        for (const o of d.options) expect(o.pattern).toHaveLength(d.pattern.length);
        expect(d.pattern.length).toBeGreaterThanOrEqual(level >= 2 ? 3 : 2);
        expect(d.pattern.length).toBeLessThanOrEqual(level >= 2 ? 4 : 3);
      }
    }
  });

  it('sílabas: palabras con 1-3 sílabas (nivel 1) o 2-4 (nivel 2), separadas como en las listas', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        for (const it of discrimination.buildItems(level, 5, seeded(seed))) {
          const d = it.data as { kind: string; word?: string; syllables?: string[] };
          if (d.kind !== 'syllables') continue;
          expect(d.syllables!.join('')).toBe(d.word);
          expect(d.syllables!.length).toBeGreaterThanOrEqual(level >= 2 ? 2 : 1);
          expect(d.syllables!.length).toBeLessThanOrEqual(level >= 2 ? 4 : 3);
          expect(it.model).toBe(d.syllables!.join(', '));
        }
      }
    }
  });

  it('hay suficientes palabras para contar sílabas en cada nivel', () => {
    expect(syllableWords(1).length).toBeGreaterThan(50);
    expect(syllableWords(2).length).toBeGreaterThan(50);
    expect(unique(syllableWords(1).map((w) => w.word))).toBe(true);
  });
});
