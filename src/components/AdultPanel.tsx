import { RATINGS, RATING_LABEL, type Rating } from '../lib/scoring';

interface Props {
  target: string;
  /** Muestra los 3 botones de calificación (actividades que califica el adulto). */
  canRate: boolean;
  /** Deshabilita la calificación (p. ej. mientras suena el refuerzo). */
  rateDisabled: boolean;
  onRate: (rating: Rating) => void;
  onEnd: () => void;
  /** Texto del botón de salida. */
  endLabel?: string;
}

const RATING_CLASS: Record<Rating, string> = {
  full: 'btn btn--good',
  help: 'btn btn--accent',
  not_yet: 'btn btn--ghost',
};

/** Panel discreto para el adulto: objetivo y calificación. La app NO califica la pronunciación. */
export function AdultPanel({ target, canRate, rateDisabled, onRate, onEnd, endLabel = 'Terminar sesión' }: Props) {
  return (
    <aside className="adult-panel no-print" aria-label="Panel para el adulto">
      <p className="adult-panel__target">
        <span aria-hidden="true">👤</span> Adulto · objetivo: <strong>{target}</strong>
      </p>
      <div className="adult-panel__actions">
        {canRate &&
          RATINGS.map((r) => (
            <button key={r} type="button" className={RATING_CLASS[r]} disabled={rateDisabled} onClick={() => onRate(r)}>
              {RATING_LABEL[r]}
            </button>
          ))}
        <button type="button" className="btn btn--ghost btn--small" onClick={onEnd}>
          {endLabel}
        </button>
      </div>
    </aside>
  );
}
