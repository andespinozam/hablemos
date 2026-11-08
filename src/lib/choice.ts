import type { Rating } from './scoring';

/** Tras este número de errores, la respuesta correcta "late" para ayudar. */
export const HINT_AFTER = 2;

export interface ChoiceState {
  /** Opciones ya descartadas (se atenúan; nunca hay mensaje ni sonido de error). */
  wrong: readonly string[];
}

export const INITIAL_CHOICE: ChoiceState = { wrong: [] };

export type ChoiceOutcome =
  | { kind: 'correct'; rating: Rating }
  | { kind: 'wrong'; state: ChoiceState }
  | { kind: 'ignored' };

/** Acierto a la primera = "Lo logró"; acierto tras equivocarse = "Con ayuda". */
export function choose(state: ChoiceState, id: string, correctId: string): ChoiceOutcome {
  if (state.wrong.includes(id)) return { kind: 'ignored' };
  if (id === correctId) return { kind: 'correct', rating: state.wrong.length === 0 ? 'full' : 'help' };
  return { kind: 'wrong', state: { wrong: [...state.wrong, id] } };
}

export function showHint(state: ChoiceState): boolean {
  return state.wrong.length >= HINT_AFTER;
}
