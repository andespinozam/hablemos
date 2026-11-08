import { useRef, useState, type ReactNode } from 'react';
import { INITIAL_CHOICE, choose, showHint, type ChoiceState } from '../lib/choice';
import { lookAgain } from '../lib/phrases';
import type { Rating } from '../lib/scoring';

export interface ChoiceOption {
  id: string;
  /** Texto accesible de la opción. */
  label: string;
  content: ReactNode;
  /** Clase extra para el botón (p. ej. un tamaño distinto). */
  className?: string;
}

interface Props {
  options: ChoiceOption[];
  correctId: string;
  /** Instrucción: se muestra breve en pantalla y se repite con calma al equivocarse. */
  prompt: string;
  say: (text: string, rate?: number) => void;
  submit: (rating: Rating) => void;
  /** Qué decir al equivocarse (por defecto, "Mira otra vez" + la instrucción). */
  retrySay?: string;
  /** Contenido extra sobre las opciones (p. ej. el botón para escuchar un ritmo). */
  header?: ReactNode;
  /** Se llama al equivocarse (p. ej. para repetir un sonido). */
  onWrong?: () => void;
}

/**
 * Elegir una opción entre varias. Solo refuerzo positivo: lo descartado se atenúa,
 * se repite la instrucción con calma y, tras 2 intentos, la respuesta correcta "late".
 */
export function ChoiceBoard({ options, correctId, prompt, say, submit, retrySay, header, onWrong }: Props) {
  const [state, setState] = useState<ChoiceState>(INITIAL_CHOICE);
  const done = useRef(false);
  const hint = showHint(state);

  const pick = (id: string) => {
    if (done.current) return;
    const outcome = choose(state, id, correctId);
    if (outcome.kind === 'correct') {
      done.current = true;
      submit(outcome.rating);
    } else if (outcome.kind === 'wrong') {
      setState(outcome.state);
      say(retrySay ?? lookAgain(prompt));
      onWrong?.();
    }
  };

  return (
    <div className="item-center">
      <p className="item-text item-text--sm">{prompt}</p>
      {header}
      <div className="choices" role="group" aria-label={prompt}>
        {options.map((o) => {
          const dim = state.wrong.includes(o.id);
          const pulse = hint && o.id === correctId;
          return (
            <button
              key={o.id}
              type="button"
              className={`choice${o.className ? ` ${o.className}` : ''}${dim ? ' choice--dim' : ''}${pulse ? ' choice--hint' : ''}`}
              aria-label={o.label}
              disabled={dim}
              onClick={() => pick(o.id)}
            >
              {o.content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
