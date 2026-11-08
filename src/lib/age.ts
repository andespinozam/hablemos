/** Fechas de nacimiento como cadena local `YYYY-MM-DD` (nunca `new Date('YYYY-MM-DD')`, que usa UTC). */

export interface YMD {
  y: number;
  m: number;
  d: number;
}

export function parseYMD(value: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
}

export function toYMD(date: Date): string {
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${p(date.getFullYear(), 4)}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Edad en años cumplidos, o null si la fecha es inválida o futura. */
export function ageInYears(birth: string, today: Date): number | null {
  const b = parseYMD(birth);
  if (!b) return null;
  let age = today.getFullYear() - b.y;
  const beforeBirthday =
    today.getMonth() + 1 < b.m || (today.getMonth() + 1 === b.m && today.getDate() < b.d);
  if (beforeBirthday) age -= 1;
  return age < 0 ? null : age;
}

/** Meses cumplidos totales, o null si es inválida o futura. */
export function ageInMonths(birth: string, today: Date): number | null {
  const b = parseYMD(birth);
  if (!b) return null;
  let months = (today.getFullYear() - b.y) * 12 + (today.getMonth() + 1 - b.m);
  if (today.getDate() < b.d) months -= 1;
  return months < 0 ? null : months;
}

/** Texto como "4 años y 3 meses". */
export function formatAge(birth: string, today: Date): string {
  const total = ageInMonths(birth, today);
  if (total === null) return '';
  const years = Math.floor(total / 12);
  const months = total % 12;
  const y = `${years} ${years === 1 ? 'año' : 'años'}`;
  if (months === 0) return y;
  return `${y} y ${months} ${months === 1 ? 'mes' : 'meses'}`;
}
