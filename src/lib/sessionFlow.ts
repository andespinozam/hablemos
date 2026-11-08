/** Posición dentro de una sesión guiada. Lógica pura para poder probarla. */

export type Stage = 'intro' | 'item' | 'praise' | 'retry' | 'done';

export interface Position {
  /** Índice de actividad. */
  a: number;
  /** Índice de ítem dentro de la actividad. */
  i: number;
  stage: Stage;
}

export const START: Position = { a: 0, i: 0, stage: 'intro' };

/** Pasa al siguiente ítem; al terminar los ítems de una actividad, a la siguiente; al final, 'done'. */
export function nextPosition(pos: Position, itemCounts: readonly number[]): Position {
  if (pos.i + 1 < itemCounts[pos.a]) return { a: pos.a, i: pos.i + 1, stage: 'item' };
  if (pos.a + 1 < itemCounts.length) return { a: pos.a + 1, i: 0, stage: 'intro' };
  return { a: pos.a, i: pos.i, stage: 'done' };
}
