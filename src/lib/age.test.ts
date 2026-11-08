import { describe, expect, it } from 'vitest';
import { ageInMonths, ageInYears, formatAge, parseYMD, toYMD } from './age';

const today = new Date(2026, 10, 8); // 8 nov 2026, hora local

describe('parseYMD', () => {
  it('acepta fechas válidas', () => {
    expect(parseYMD('2022-02-28')).toEqual({ y: 2022, m: 2, d: 28 });
  });
  it('rechaza formatos y fechas imposibles', () => {
    expect(parseYMD('2022-2-3')).toBeNull();
    expect(parseYMD('2022-02-30')).toBeNull();
    expect(parseYMD('')).toBeNull();
  });
});

describe('ageInYears', () => {
  it('cuenta años cumplidos', () => {
    expect(ageInYears('2022-11-08', today)).toBe(4); // cumple hoy
    expect(ageInYears('2022-11-09', today)).toBe(3); // cumple mañana
    expect(ageInYears('2023-01-01', today)).toBe(3);
  });
  it('devuelve null para fechas futuras o inválidas', () => {
    expect(ageInYears('2027-01-01', today)).toBeNull();
    expect(ageInYears('hola', today)).toBeNull();
  });
});

describe('ageInMonths y formatAge', () => {
  it('cuenta meses cumplidos', () => {
    expect(ageInMonths('2022-08-08', today)).toBe(51);
    expect(ageInMonths('2022-08-09', today)).toBe(50);
  });
  it('formatea en español', () => {
    expect(formatAge('2022-08-08', today)).toBe('4 años y 3 meses');
    expect(formatAge('2022-11-08', today)).toBe('4 años');
    expect(formatAge('2025-10-08', today)).toBe('1 año y 1 mes');
  });
});

describe('toYMD', () => {
  it('usa la fecha local', () => {
    expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
