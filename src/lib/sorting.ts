/** Lógica de la actividad "Categorías": poner cada objeto en su grupo. */

export interface SortObject {
  id: string;
  /** Grupo al que pertenece. */
  bin: string;
}

export interface SortState {
  /** Objeto → grupo, solo los colocados correctamente. */
  placed: Readonly<Record<string, string>>;
  /** Intentos en el grupo equivocado. */
  mistakes: number;
}

export const INITIAL_SORT: SortState = { placed: {}, mistakes: 0 };

/** Tras este número de intentos fallidos, se señala el siguiente objeto y su grupo. */
export const SORT_HINT_AFTER = 2;

export type SortOutcome =
  | { kind: 'ignored' }
  | { kind: 'wrong'; state: SortState }
  | { kind: 'correct'; state: SortState; complete: boolean };

export function placeObject(state: SortState, obj: SortObject, binId: string, total: number): SortOutcome {
  if (state.placed[obj.id]) return { kind: 'ignored' };
  if (obj.bin !== binId) return { kind: 'wrong', state: { ...state, mistakes: state.mistakes + 1 } };
  const placed = { ...state.placed, [obj.id]: binId };
  return { kind: 'correct', state: { ...state, placed }, complete: Object.keys(placed).length === total };
}

/** Siguiente objeto sin colocar, si ya toca dar una pista. */
export function hintObject<T extends SortObject>(objects: readonly T[], state: SortState): T | undefined {
  if (state.mistakes < SORT_HINT_AFTER) return undefined;
  return objects.find((o) => !state.placed[o.id]);
}
