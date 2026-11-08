/** Seguimiento: porcentajes por fonema, tendencia semanal y rachas. Lógica pura. */
import type { ResultRecord, SessionRecord } from './db';

/** Solo la práctica (sin las sesiones de evaluación). */
export function practiceSessions(sessions: readonly SessionRecord[]): SessionRecord[] {
  return sessions.filter((s) => s.kind === undefined || s.kind === 'practice');
}

export function practiceResults(results: readonly ResultRecord[], sessions: readonly SessionRecord[]): ResultRecord[] {
  const assessment = new Set(sessions.filter((s) => s.kind === 'baseline' || s.kind === 'reassessment').map((s) => s.id));
  return results.filter((r) => !assessment.has(r.sessionId));
}

export interface PhonemeProgress {
  phoneme: string;
  n: number;
  /** 0..100 */
  percent: number;
  last: number;
}

/** Porcentaje por fonema (Lo logró = 1, Con ayuda = 0.5, Aún no = 0). Los de menor logro primero. */
export function phonemeProgress(results: readonly ResultRecord[]): PhonemeProgress[] {
  const sums: Record<string, { n: number; score: number; last: number }> = {};
  for (const r of results) {
    if (!r.phoneme) continue;
    const s = (sums[r.phoneme] ??= { n: 0, score: 0, last: 0 });
    s.n += 1;
    s.score += r.score;
    s.last = Math.max(s.last, r.at);
  }
  return Object.entries(sums)
    .map(([phoneme, s]) => ({ phoneme, n: s.n, percent: Math.round((s.score / s.n) * 100), last: s.last }))
    .sort((a, b) => a.percent - b.percent || a.phoneme.localeCompare(b.phoneme));
}

/** Lunes 00:00 (hora local) de la semana de `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceMonday = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - sinceMonday);
  return d;
}

export interface WeekPoint {
  /** Lunes de la semana (ms). */
  start: number;
  /** 0..100, o null si esa semana no hubo práctica. */
  percent: number | null;
  /** Ítems trabajados. */
  n: number;
}

/**
 * Logro por semana de las últimas `weeks` semanas (la actual incluida), de la más antigua a la más reciente.
 * `now` se recibe como parámetro para poder probar.
 */
export function weeklyTrend(results: readonly ResultRecord[], now: Date, weeks = 8): WeekPoint[] {
  const current = weekStart(now);
  const points: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7 * i);
    points.push({ start: start.getTime(), percent: null, n: 0 });
  }
  const sums = points.map(() => ({ n: 0, score: 0 }));
  for (const r of results) {
    const rs = weekStart(new Date(r.at)).getTime();
    const idx = points.findIndex((p) => p.start === rs);
    if (idx < 0) continue;
    sums[idx].n += 1;
    sums[idx].score += r.score;
  }
  return points.map((p, i) => ({ ...p, n: sums[i].n, percent: sums[i].n ? Math.round((sums[i].score / sums[i].n) * 100) : null }));
}

const pad = (n: number) => String(n).padStart(2, '0');
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface Streaks {
  /** Días seguidos con práctica hasta hoy; si hoy aún no practicó, cuenta desde ayer. */
  current: number;
  best: number;
  /** Días distintos con práctica en total. */
  daysPracticed: number;
  /** Días con práctica en los últimos 7 días (incluido hoy). */
  last7: number;
}

/** Racha de práctica por días (solo sesiones de práctica con al menos un ítem hecho). */
export function streaks(
  results: readonly ResultRecord[],
  sessions: readonly SessionRecord[],
  now: Date,
): Streaks {
  const practice = practiceResults(results, sessions);
  const days = new Set(practice.map((r) => dayKey(r.at)));
  const dayDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const date = dayDate(key);
    const gap = prev ? Math.round((date.getTime() - prev.getTime()) / 86400000) : 0;
    run = prev && gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const step = (d: Date, back: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
  let cursor = days.has(dayKey(today.getTime())) ? today : step(today, 1);
  let current = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    current += 1;
    cursor = step(cursor, 1);
  }

  let last7 = 0;
  for (let i = 0; i < 7; i++) if (days.has(dayKey(step(today, i).getTime()))) last7 += 1;
  return { current, best, daysPracticed: days.size, last7 };
}

/** Sesiones de práctica terminadas (con al menos un resultado). */
export function practiceSessionCount(results: readonly ResultRecord[], sessions: readonly SessionRecord[]): number {
  const withResults = new Set(results.map((r) => r.sessionId));
  return practiceSessions(sessions).filter((s) => withResults.has(s.id)).length;
}
