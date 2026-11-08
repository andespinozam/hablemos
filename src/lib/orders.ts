import type { Rating } from './scoring';

/** Un paso de una orden: poner un objeto en un lugar. */
export interface Move {
  obj: string;
  place: string;
}

export interface MoveResult {
  ok: boolean;
  /** Pasos que faltan (sin el que se acaba de cumplir). */
  remaining: Move[];
}

/** Acepta los pasos en cualquier orden: lo importante es cumplir toda la orden. */
export function tryMove(remaining: readonly Move[], obj: string, place: string): MoveResult {
  const index = remaining.findIndex((m) => m.obj === obj && m.place === place);
  if (index < 0) return { ok: false, remaining: [...remaining] };
  return { ok: true, remaining: remaining.filter((_, i) => i !== index) };
}

/** Sin intentos fallidos = "Lo logró"; con alguno = "Con ayuda". */
export function ratingForMistakes(mistakes: number): Rating {
  return mistakes === 0 ? 'full' : 'help';
}
