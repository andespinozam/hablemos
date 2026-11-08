import type { LadderRecord } from '../lib/db';
import { LADDER_STEPS, SESSIONS_TO_ADVANCE } from '../lib/ladder';
import { getPhoneme } from '../lib/phonemes';

const STATE_LABEL = { active: 'En práctica', queued: 'En espera', done: 'Terminada' } as const;

/** Tabla de escaleras: sonido, sustitución observada, escalón y sesiones logradas. */
export function LadderSummary({ ladders }: { ladders: readonly LadderRecord[] }) {
  if (ladders.length === 0) return <p>Aún no hay escaleras de pronunciación.</p>;
  const sorted = [...ladders].sort((a, b) => Number(a.state === 'done') - Number(b.state === 'done') || a.order - b.order);
  return (
    <table className="table">
      <caption className="sr-only">Escalera de pronunciación por sonido</caption>
      <thead>
        <tr>
          <th scope="col">Sonido</th>
          <th scope="col">Dice en su lugar</th>
          <th scope="col">Escalón</th>
          <th scope="col">Sesiones logradas</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((l) => (
          <tr key={l.key}>
            <th scope="row">{getPhoneme(l.phonemeId)?.name ?? l.phonemeId}</th>
            <td>{l.substitution ? `“${l.substitution}”` : '—'}</td>
            <td>
              {l.state === 'done' ? `${LADDER_STEPS.length} de ${LADDER_STEPS.length}` : `${l.step + 1} de ${LADDER_STEPS.length}`} ·{' '}
              {LADDER_STEPS[Math.min(l.step, LADDER_STEPS.length - 1)].title}
            </td>
            <td>{l.state === 'done' ? '—' : `${l.successSessions.length} de ${SESSIONS_TO_ADVANCE}`}</td>
            <td>{STATE_LABEL[l.state]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
