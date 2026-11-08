/** Calificación que da el adulto. La app NO califica la pronunciación. */
export type Rating = 'full' | 'help' | 'not_yet';

export const RATINGS: readonly Rating[] = ['full', 'help', 'not_yet'];

export const RATING_LABEL: Record<Rating, string> = {
  full: 'Lo logró',
  help: 'Con ayuda',
  not_yet: 'Aún no',
};

/** Lo logró = 1, Con ayuda = 0.5, Aún no = 0. */
export function scoreOf(rating: Rating): number {
  return rating === 'full' ? 1 : rating === 'help' ? 0.5 : 0;
}

/** Promedio 0..1 de un conjunto de calificaciones, o null si no hay ninguna. */
export function ratio(ratings: readonly Rating[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + scoreOf(r), 0) / ratings.length;
}

/** Porcentaje entero 0..100, o null si no hay datos. */
export function percent(ratings: readonly Rating[]): number | null {
  const r = ratio(ratings);
  return r === null ? null : Math.round(r * 100);
}
