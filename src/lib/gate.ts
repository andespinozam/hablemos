/** Puerta de la zona de adultos: mantener presionado 3 s, o resolver una suma de dos números de dos dígitos. */

export const HOLD_MS = 3000;

export interface Challenge {
  a: number;
  b: number;
  answer: number;
}

/** `rng` devuelve un número en [0, 1); se recibe como parámetro para poder probarla. */
export function makeChallenge(rng: () => number = Math.random): Challenge {
  const pick = () => 11 + Math.floor(rng() * 38); // 11..48
  const a = pick();
  const b = pick();
  return { a, b, answer: a + b };
}

export function checkAnswer(challenge: Challenge, typed: string): boolean {
  const text = typed.trim();
  if (!/^\d{1,3}$/.test(text)) return false;
  return Number(text) === challenge.answer;
}

/** Avance (0..1) de una pulsación sostenida. */
export function holdProgress(elapsedMs: number): number {
  return Math.min(1, Math.max(0, elapsedMs / HOLD_MS));
}
