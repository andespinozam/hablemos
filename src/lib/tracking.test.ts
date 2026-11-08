import { describe, expect, it } from 'vitest';
import type { ResultRecord, SessionRecord } from './db';
import { dayKey, phonemeProgress, practiceResults, practiceSessionCount, streaks, weekStart, weeklyTrend } from './tracking';

/** Hora local: así los días no dependen de la zona horaria de quien corre las pruebas. */
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

function res(time: number, score: number, extra: Partial<ResultRecord> = {}): ResultRecord {
  return {
    id: `${time}${Math.random()}`,
    sessionId: 's1',
    profileId: 'p',
    activityId: 'a',
    itemId: 'i',
    target: 't',
    area: 'receptivo',
    level: 1,
    rating: score === 1 ? 'full' : score === 0.5 ? 'help' : 'not_yet',
    score,
    at: time,
    ...extra,
  };
}

const session = (id: string, kind?: SessionRecord['kind']): SessionRecord => ({ id, profileId: 'p', startedAt: 0, activityIds: [], ...(kind ? { kind } : {}) });

describe('weekStart', () => {
  it('es el lunes de esa semana, a las 00:00', () => {
    const wed = new Date(2026, 10, 11, 15, 30); // miércoles 11 nov 2026
    const start = weekStart(wed);
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 10, 9, 0]);
    expect(weekStart(new Date(2026, 10, 9, 0, 0)).getDate()).toBe(9); // el propio lunes
    expect(weekStart(new Date(2026, 10, 15, 23, 59)).getDate()).toBe(9); // domingo
  });
});

describe('weeklyTrend', () => {
  const now = new Date(2026, 10, 11, 10); // semana del 9 nov
  it('da las últimas semanas, de la más antigua a la actual', () => {
    const t = weeklyTrend([], now, 4);
    expect(t).toHaveLength(4);
    expect(t.map((p) => new Date(p.start).getDate())).toEqual([19, 26, 2, 9]); // 19 oct, 26 oct, 2 nov, 9 nov
    expect(t.every((p) => p.percent === null && p.n === 0)).toBe(true);
  });
  it('promedia por semana y deja null las semanas sin práctica', () => {
    const t = weeklyTrend(
      [res(at(2026, 11, 3), 1), res(at(2026, 11, 4), 0), res(at(2026, 11, 10), 1), res(at(2026, 11, 10), 0.5), res(at(2026, 11, 10), 1)],
      now,
      3,
    );
    expect(t.map((p) => p.percent)).toEqual([null, 50, 83]);
    expect(t.map((p) => p.n)).toEqual([0, 2, 3]);
  });
  it('ignora resultados fuera de la ventana', () => {
    const t = weeklyTrend([res(at(2026, 1, 5), 1), res(at(2027, 1, 5), 1)], now, 4);
    expect(t.every((p) => p.n === 0)).toBe(true);
  });
  it('lunes 00:00 cuenta en su semana y domingo 23:59 en la anterior', () => {
    const t = weeklyTrend([res(new Date(2026, 10, 9, 0, 0).getTime(), 1), res(new Date(2026, 10, 8, 23, 59).getTime(), 0)], now, 2);
    expect(t.map((p) => [p.percent, p.n])).toEqual([[0, 1], [100, 1]]);
  });
});

describe('phonemeProgress', () => {
  it('porcentaje por fonema, de menor a mayor, ignorando lo que no tiene fonema', () => {
    const out = phonemeProgress([
      res(1, 1, { phoneme: 'p' }),
      res(2, 1, { phoneme: 'p' }),
      res(3, 0, { phoneme: 'm' }),
      res(4, 0.5, { phoneme: 'm' }),
      res(5, 1),
    ]);
    expect(out).toEqual([
      { phoneme: 'm', n: 2, percent: 25, last: 4 },
      { phoneme: 'p', n: 2, percent: 100, last: 2 },
    ]);
  });
});

describe('practiceResults / practiceSessionCount', () => {
  const sessions = [session('prac'), session('base', 'baseline'), session('re', 'reassessment'), session('prac2', 'practice')];
  const results = [res(1, 1, { sessionId: 'prac' }), res(2, 1, { sessionId: 'base' }), res(3, 1, { sessionId: 're' }), res(4, 1, { sessionId: 'prac2' })];
  it('quita los resultados de evaluaciones', () => {
    expect(practiceResults(results, sessions).map((r) => r.sessionId)).toEqual(['prac', 'prac2']);
  });
  it('cuenta solo sesiones de práctica que tienen resultados', () => {
    expect(practiceSessionCount(results, [...sessions, session('vacia')])).toBe(2);
  });
});

describe('streaks', () => {
  const now = new Date(2026, 10, 11, 9); // 11 nov
  const sess = [session('s1')];
  const r = (d: number, month = 11) => res(at(2026, month, d), 1);

  it('sin práctica: todo en cero', () => {
    expect(streaks([], sess, now)).toEqual({ current: 0, best: 0, daysPracticed: 0, last7: 0 });
  });
  it('cuenta días seguidos hasta hoy', () => {
    expect(streaks([r(9), r(10), r(11)], sess, now)).toMatchObject({ current: 3, best: 3, daysPracticed: 3 });
  });
  it('si hoy no practicó todavía, la racha sigue viva desde ayer', () => {
    expect(streaks([r(9), r(10)], sess, now).current).toBe(2);
  });
  it('se corta si falta ayer y hoy', () => {
    expect(streaks([r(7), r(8)], sess, now)).toMatchObject({ current: 0, best: 2 });
  });
  it('varios ítems el mismo día cuentan como un día', () => {
    expect(streaks([r(10), r(10), r(10)], sess, now)).toMatchObject({ current: 1, daysPracticed: 1 });
  });
  it('la mejor racha puede ser anterior a la actual', () => {
    const out = streaks([r(1), r(2), r(3), r(4), r(10), r(11)], sess, now);
    expect(out).toMatchObject({ current: 2, best: 4, daysPracticed: 6 });
  });
  it('cruza el cambio de mes', () => {
    const out = streaks([res(at(2026, 10, 30), 1), res(at(2026, 10, 31), 1), res(at(2026, 11, 1), 1)], sess, new Date(2026, 10, 1, 8));
    expect(out).toMatchObject({ current: 3, best: 3 });
  });
  it('last7 cuenta días distintos de los últimos 7 (hoy incluido)', () => {
    expect(streaks([r(5), r(6), r(7), r(11), r(1)], sess, now).last7).toBe(4); // 5,6,7,11; el 1 queda fuera
  });
  it('las evaluaciones no cuentan como práctica', () => {
    const sessions = [session('prac'), session('base', 'baseline')];
    const results = [res(at(2026, 11, 11), 1, { sessionId: 'base' }), res(at(2026, 11, 10), 1, { sessionId: 'prac' })];
    expect(streaks(results, sessions, now)).toMatchObject({ current: 1, daysPracticed: 1 });
  });
  it('dayKey usa la fecha local con ceros', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });
});
