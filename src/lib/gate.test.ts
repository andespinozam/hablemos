import { describe, expect, it } from 'vitest';
import { HOLD_MS, checkAnswer, holdProgress, makeChallenge } from './gate';

describe('makeChallenge', () => {
  it('suma dos números de dos dígitos', () => {
    for (const r of [0, 0.5, 0.999999]) {
      const c = makeChallenge(() => r);
      expect(c.a).toBeGreaterThanOrEqual(10);
      expect(c.a).toBeLessThan(100);
      expect(c.b).toBeGreaterThanOrEqual(10);
      expect(c.b).toBeLessThan(100);
      expect(c.answer).toBe(c.a + c.b);
    }
  });
});

describe('checkAnswer', () => {
  const c = { a: 23, b: 34, answer: 57 };
  it('acepta la respuesta correcta, con espacios', () => {
    expect(checkAnswer(c, '57')).toBe(true);
    expect(checkAnswer(c, ' 57 ')).toBe(true);
  });
  it('rechaza lo demás', () => {
    expect(checkAnswer(c, '56')).toBe(false);
    expect(checkAnswer(c, '')).toBe(false);
    expect(checkAnswer(c, '5e1')).toBe(false);
    expect(checkAnswer(c, '-57')).toBe(false);
  });
});

describe('holdProgress', () => {
  it('llega a 1 a los 3 s y se queda acotado', () => {
    expect(holdProgress(0)).toBe(0);
    expect(holdProgress(HOLD_MS / 2)).toBe(0.5);
    expect(holdProgress(HOLD_MS)).toBe(1);
    expect(holdProgress(HOLD_MS * 5)).toBe(1);
    expect(holdProgress(-10)).toBe(0);
  });
});
