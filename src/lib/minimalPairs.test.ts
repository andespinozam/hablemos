import { describe, expect, it } from 'vitest';
import { ladder } from '../activities/ladder';
import { minimalPairs } from '../activities/minimalPairs';
import { ACTIVITIES } from '../activities/registry';
import type { BuildContext } from '../activities/types';
import type { LadderRecord } from './db';
import { MINIMAL_PAIRS, pairTier, selectPairItems, soundFamily } from './minimalPairs';
import { getPhoneme } from './phonemes';
import { seeded } from './random';

const pair = (id: string) => MINIMAL_PAIRS.find((p) => p.id === id)!;

describe('contenido de pares mínimos', () => {
  it('17 pares con ids únicos, sonidos que existen y palabras distintas', () => {
    expect(MINIMAL_PAIRS).toHaveLength(17);
    expect(new Set(MINIMAL_PAIRS.map((p) => p.id)).size).toBe(17);
    for (const p of MINIMAL_PAIRS) {
      for (const s of p.sounds) expect(getPhoneme(s), `${p.id}/${s}`).toBeDefined();
      expect(p.a.word).not.toBe(p.b.word);
      expect(p.sounds).toEqual([p.a.sound, p.b.sound]);
      for (const w of [p.a, p.b]) {
        expect(w.syllables.join(''), p.id).toBe(w.word);
        expect(w.emoji, p.id).toBeTruthy();
      }
    }
  });
  it('emojis de versiones antiguas (Emoji <= 12)', () => {
    const modern = ['🪟', '🪞', '🪜', '🪗', '🦭', '🦬', '🪶', '🫔', '🛖', '🪹', '🛟', '🫐', '🪆', '🪅', '🪵', '🪙', '🪈', '🪧'];
    for (const p of MINIMAL_PAIRS) for (const w of [p.a, p.b]) expect(modern.some((m) => w.emoji.includes(m)), `${p.id}/${w.word}`).toBe(false);
  });
  it('incluye las 14 palabras nuevas del archivo', () => {
    const words = new Set(MINIMAL_PAIRS.flatMap((p) => [p.a.word, p.b.word]));
    for (const w of ['lana', 'lata', 'rata', 'pelo', 'moño', 'pila', 'ola', 'saco', 'sala', 'pala', 'copa', 'chal', 'sal', 'juego']) {
      expect(words.has(w), w).toBe(true);
    }
  });
  it('hay pares l/rr para trabajar la r', () => {
    expect(MINIMAL_PAIRS.filter((p) => p.contrast === 'l/rr').length).toBeGreaterThanOrEqual(3);
  });
});

describe('selección por sustitución', () => {
  it('s dicho como t: los pares s/t van primero', () => {
    const items = selectPairItems([{ phonemeId: 's', substitution: 't' }], 4, 4, seeded(1));
    expect(items[0].pair.id).toBe('pm_saco_taco');
    expect(items[1].pair.id).toBe('pm_saco_taco'); // la otra palabra del mismo par
    expect(new Set(items.slice(0, 2).map((i) => i.target)).size).toBe(2);
  });
  it('k dicho como t: par k/t (casa/taza)', () => {
    const items = selectPairItems([{ phonemeId: 'k', substitution: 't' }], 4, 2, seeded(2));
    expect(items.every((i) => i.pair.id === 'pm_casa_taza')).toBe(true);
  });
  it('la r suave se trabaja con los pares l/rr', () => {
    expect(soundFamily('r')).toBe('rr');
    const items = selectPairItems([{ phonemeId: 'r', substitution: 'l' }], 5, 4, seeded(3));
    expect(items.every((i) => i.pair.contrast === 'l/rr')).toBe(true);
    expect(new Set(items.map((i) => i.pair.id)).size).toBe(3);
  });
  it('sin sustitución registrada, usa pares del sonido; sin escalera, pares de la edad', () => {
    const withSound = selectPairItems([{ phonemeId: 'g' }], 4, 2, seeded(4));
    expect(withSound.every((i) => i.pair.sounds.includes('g'))).toBe(true);
    const general = selectPairItems([], 3, 8, seeded(5));
    expect(general).toHaveLength(8);
    // a los 3 años los primeros pares usan solo sonidos de 3 años o menos
    const firstOnes = general.slice(0, 4);
    for (const i of firstOnes) for (const s of i.pair.sounds) expect(getPhoneme(s)!.age, i.pair.id).toBeLessThanOrEqual(3);
  });
  it('completa con otros pares si el sonido tiene pocos', () => {
    const items = selectPairItems([{ phonemeId: 'ch', substitution: 's' }], 4, 6, seeded(6));
    expect(items).toHaveLength(6);
    expect(items[0].pair.id).toBe('pm_chal_sal');
    expect(items[2].pair.id).not.toBe('pm_chal_sal');
  });
  it('pairTier distingue coincidencia de sustitución, de sonido y ninguna', () => {
    const p = pair('pm_saco_taco');
    expect(pairTier(p, [{ phonemeId: 's', substitution: 't' }])).toBe(1);
    expect(pairTier(p, [{ phonemeId: 's', substitution: 'f' }])).toBe(2);
    expect(pairTier(p, [{ phonemeId: 'm', substitution: 'n' }])).toBe(3);
    expect(pairTier(p, [])).toBe(3);
  });
  it('es reproducible', () => {
    const t = [{ phonemeId: 's', substitution: 't' }];
    expect(selectPairItems(t, 4, 4, seeded(9))).toEqual(selectPairItems(t, 4, 4, seeded(9)));
  });
});

describe('actividades nuevas', () => {
  const lad = (phonemeId: string, o: Partial<LadderRecord> = {}): LadderRecord => ({
    key: `p:${phonemeId}`,
    profileId: 'p',
    phonemeId,
    state: 'active',
    order: 0,
    step: 0,
    successSessions: [],
    createdAt: 1,
    updatedAt: 1,
    ...o,
  });
  const ctx = (ladders: LadderRecord[]): BuildContext => ({ age: 4, phonemes: {}, ladders });

  it('quedan registradas con los ids previstos y los modos de calificación pedidos', () => {
    expect(ACTIVITIES.find((a) => a.id === 'pares-minimos')).toBe(minimalPairs);
    expect(ACTIVITIES.find((a) => a.id === 'escalera-sonido')).toBe(ladder);
    expect(minimalPairs.adultRated).toBe(false);
    expect(ladder.adultRated).toBe(true);
  });
  it('pares: ítems coherentes (respuesta entre las opciones, 2 dibujos) y usa la sustitución', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const items = minimalPairs.buildItems(1, 4, seeded(seed), ctx([lad('s', { substitution: 't' })]));
      expect(items).toHaveLength(4);
      expect(new Set(items.map((i) => i.id)).size).toBe(4);
      for (const it of items) {
        const d = it.data as unknown as { options: { id: string }[]; correct: string };
        expect(d.options).toHaveLength(2);
        expect(d.options.map((o) => o.id)).toContain(d.correct);
        expect(it.prompt).toMatch(/^Toca /);
      }
      expect(items[0].id).toMatch(/^pm_saco_taco:/);
    }
    expect(minimalPairs.buildItems(1, 4, seeded(1))).toHaveLength(4); // sin contexto tampoco falla
  });
  it('escalera: solo disponible con escaleras activas; arma ítems de hasta 2 sonidos', () => {
    expect(ladder.isAvailable!(ctx([]))).toBe(false);
    expect(ladder.isAvailable!(ctx([lad('s', { state: 'queued' })]))).toBe(false);
    expect(ladder.isAvailable!(ctx([lad('s')]))).toBe(true);
    const items = ladder.buildItems(1, 4, seeded(1), ctx([lad('s', { step: 4 }), lad('l', { step: 5, order: 1 }), lad('p', { order: 2 })]));
    expect(items).toHaveLength(4);
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
    expect(ladder.buildItems(1, 4, seeded(1), ctx([]))).toEqual([]);
  });
  it('escalera: rota entre sonidos: primero el menos practicado', () => {
    const c = { ...ctx([lad('s', { order: 0 }), lad('l', { order: 1 }), lad('p', { order: 2 })]), ladderLast: { s: 50, l: 10, p: 30 } };
    const items = ladder.buildItems(1, 4, seeded(1), c);
    expect(items[0].id).toContain('/l/');
  });
});
