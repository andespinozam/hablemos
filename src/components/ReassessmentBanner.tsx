import type { ReassessmentState } from '../lib/assessment';

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props {
  status: ReassessmentState;
  onStart?: () => void;
}

/** Aviso de cuándo toca evaluar: inicial pendiente, reevaluación sugerida o próxima fecha. */
export function ReassessmentBanner({ status, onStart }: Props) {
  if (status.state === 'none') {
    return (
      <div className="notice notice--info" role="note">
        <span aria-hidden="true">📝</span>
        <span>Aún no hay evaluación inicial. Te recomendamos hacerla para conocer el punto de partida.</span>
        {onStart && (
          <button type="button" className="btn btn--small btn--accent" onClick={onStart}>
            Evaluar ahora
          </button>
        )}
      </div>
    );
  }
  if (status.state === 'due') {
    const weeks = Math.floor((Date.now() - status.lastAt) / (7 * 86400000));
    return (
      <div className="notice notice--due" role="note">
        <span aria-hidden="true">⏰</span>
        <span>
          Reevaluación sugerida: la última evaluación fue el {formatDate(status.lastAt)} (hace {weeks} semanas).
        </span>
        {onStart && (
          <button type="button" className="btn btn--small btn--accent" onClick={onStart}>
            Reevaluar
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="notice" role="note">
      <span aria-hidden="true">✅</span>
      <span>
        Próxima reevaluación sugerida el {formatDate(status.dueAt)} (en {status.daysLeft} {status.daysLeft === 1 ? 'día' : 'días'}).
      </span>
    </div>
  );
}
