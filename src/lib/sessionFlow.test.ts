import { describe, expect, it } from 'vitest';
import { START, nextPosition, type Position } from './sessionFlow';

describe('nextPosition', () => {
  const counts = [2, 3];
  it('avanza ítem por ítem dentro de una actividad', () => {
    expect(nextPosition({ a: 0, i: 0, stage: 'praise' }, counts)).toEqual({ a: 0, i: 1, stage: 'item' });
  });
  it('al terminar una actividad pasa a la introducción de la siguiente', () => {
    expect(nextPosition({ a: 0, i: 1, stage: 'praise' }, counts)).toEqual({ a: 1, i: 0, stage: 'intro' });
  });
  it('al terminar la última actividad llega a la celebración', () => {
    expect(nextPosition({ a: 1, i: 2, stage: 'retry' }, counts).stage).toBe('done');
  });
  it('recorre toda la sesión con un avance por ítem (5 ítems = 5 avances)', () => {
    let pos: Position = { ...START, stage: 'item' };
    let advances = 0;
    while (pos.stage !== 'done') {
      pos = nextPosition(pos, counts);
      advances++;
    }
    expect(advances).toBe(5);
  });
});
