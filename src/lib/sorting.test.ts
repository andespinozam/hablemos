import { describe, expect, it } from 'vitest';
import { shuffle, spreadBy, seeded } from './random';
import { INITIAL_SORT, hintObject, placeObject, type SortObject } from './sorting';

const objs: SortObject[] = [
  { id: 'gato', bin: 'animales' },
  { id: 'pan', bin: 'comida' },
  { id: 'perro', bin: 'animales' },
];

describe('placeObject', () => {
  it('acepta el grupo correcto', () => {
    const out = placeObject(INITIAL_SORT, objs[0], 'animales', 3);
    expect(out).toEqual({ kind: 'correct', state: { placed: { gato: 'animales' }, mistakes: 0 }, complete: false });
  });
  it('un grupo equivocado cuenta el intento y no coloca nada', () => {
    const out = placeObject(INITIAL_SORT, objs[0], 'comida', 3);
    expect(out).toEqual({ kind: 'wrong', state: { placed: {}, mistakes: 1 } });
  });
  it('avisa cuando se colocó el último objeto', () => {
    let state = INITIAL_SORT;
    let last;
    for (const o of objs) {
      last = placeObject(state, o, o.bin, objs.length);
      if (last.kind === 'correct') state = last.state;
    }
    expect(last).toMatchObject({ kind: 'correct', complete: true });
  });
  it('ignora un objeto ya colocado', () => {
    const first = placeObject(INITIAL_SORT, objs[0], 'animales', 3);
    if (first.kind !== 'correct') throw new Error('esperaba correct');
    expect(placeObject(first.state, objs[0], 'comida', 3)).toEqual({ kind: 'ignored' });
  });
  it('los errores no quitan lo ya colocado', () => {
    const ok = placeObject(INITIAL_SORT, objs[0], 'animales', 3);
    if (ok.kind !== 'correct') throw new Error('esperaba correct');
    const bad = placeObject(ok.state, objs[1], 'animales', 3);
    expect(bad).toMatchObject({ kind: 'wrong', state: { placed: { gato: 'animales' }, mistakes: 1 } });
  });
});

describe('hintObject', () => {
  it('da pista solo tras 2 errores y señala el primer objeto sin colocar', () => {
    expect(hintObject(objs, { placed: {}, mistakes: 1 })).toBeUndefined();
    expect(hintObject(objs, { placed: {}, mistakes: 2 })?.id).toBe('gato');
    expect(hintObject(objs, { placed: { gato: 'animales' }, mistakes: 2 })?.id).toBe('pan');
  });
});

describe('spreadBy', () => {
  const items = ['a1', 'a2', 'a3', 'b1', 'b2', 'c1'];
  const key = (s: string) => s[0];
  it('reparte entre grupos antes de repetir uno', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const out = spreadBy(items, key, 3, seeded(seed));
      expect(new Set(out.map(key)).size).toBe(3);
    }
  });
  it('devuelve lo pedido, sin repetir, y no más de lo que hay', () => {
    const out = spreadBy(items, key, 5, seeded(1));
    expect(out).toHaveLength(5);
    expect(new Set(out).size).toBe(5);
    expect(spreadBy(items, key, 99, seeded(1))).toHaveLength(6);
  });
  it('mezcla estable con semilla', () => {
    expect(shuffle(items, seeded(7))).toEqual(shuffle(items, seeded(7)));
  });
});
