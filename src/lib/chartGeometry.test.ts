import { describe, expect, it } from 'vitest';
import { barWidth, contiguousRuns, polylinePoints, shortDate, xPositions, yFor } from './chartGeometry';

describe('contiguousRuns', () => {
  it('agrupa índices seguidos con dato y corta en los null', () => {
    expect(contiguousRuns([1, 2, null, 3, null, null, 4, 5])).toEqual([[0, 1], [3], [6, 7]]);
  });
  it('casos borde', () => {
    expect(contiguousRuns([])).toEqual([]);
    expect(contiguousRuns([null, null])).toEqual([]);
    expect(contiguousRuns([0, 0])).toEqual([[0, 1]]); // el 0 es un dato, no un hueco
  });
});

describe('xPositions', () => {
  it('reparte de punta a punta; uno solo va al centro', () => {
    expect(xPositions(3, 10, 100)).toEqual([10, 60, 110]);
    expect(xPositions(1, 10, 100)).toEqual([60]);
    expect(xPositions(0, 10, 100)).toEqual([]);
  });
});

describe('yFor', () => {
  it('0 queda abajo y 100 arriba, y se acota al rango', () => {
    expect(yFor(0, 20, 200)).toBe(220);
    expect(yFor(100, 20, 200)).toBe(20);
    expect(yFor(50, 20, 200)).toBe(120);
    expect(yFor(-30, 20, 200)).toBe(220);
    expect(yFor(150, 20, 200)).toBe(20);
  });
});

describe('barWidth', () => {
  it('proporcional, acotado, y 0 sin dato', () => {
    expect(barWidth(50, 200)).toBe(100);
    expect(barWidth(120, 200)).toBe(200);
    expect(barWidth(null, 200)).toBe(0);
    expect(barWidth(0, 200)).toBe(0);
  });
});

describe('shortDate / polylinePoints', () => {
  it('fecha corta local', () => {
    expect(shortDate(new Date(2026, 10, 9).getTime())).toBe('9/11');
    expect(shortDate(new Date(2026, 0, 31).getTime())).toBe('31/1');
  });
  it('arma los puntos solo del tramo pedido', () => {
    expect(polylinePoints([0, 10, 20, 30], [5, 6, 7, 8], [1, 2])).toBe('10.0,6.0 20.0,7.0');
  });
});
