import { useEffect, useMemo, useState } from 'react';
import { latestBaseline } from '../lib/assessment';
import { listAssessments } from '../lib/assessmentStore';
import type { AssessmentItem, ChildProfile } from '../lib/db';
import { go } from '../lib/router';
import { SessionRunner, type AssessmentMode } from './SessionRunner';

interface Props {
  profile: ChildProfile;
  kind: 'baseline' | 'reassessment';
}

/**
 * Arranca una evaluación. La reevaluación necesita los ítems de la evaluación inicial, así que
 * primero se cargan; si no hay evaluación inicial terminada, se avisa en vez de empezar.
 */
export function AssessmentLauncher({ profile, kind }: Props) {
  const [items, setItems] = useState<AssessmentItem[] | null>(kind === 'baseline' ? [] : null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (kind === 'baseline') return;
    let alive = true;
    listAssessments(profile.id)
      .then((all) => {
        const base = latestBaseline(all);
        if (!alive) return;
        if (base) setItems(base.items);
        else setMissing(true);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [kind, profile.id]);

  // Estable: SessionRunner no debe reiniciarse por un objeto nuevo en cada render.
  const mode = useMemo<AssessmentMode | null>(() => (items ? { kind, items } : null), [kind, items]);

  if (missing) {
    return (
      <main className="screen screen--center">
        <p role="alert">No hay una evaluación inicial terminada, así que todavía no se puede reevaluar.</p>
        <button type="button" className="btn" onClick={() => go(`adultos/evaluacion/${profile.id}`)}>
          ⬅️ Volver
        </button>
      </main>
    );
  }
  if (!mode) {
    return (
      <main className="screen screen--center" aria-busy="true">
        <p className="avatar bob" aria-hidden="true">
          📝
        </p>
      </main>
    );
  }
  return <SessionRunner profile={profile} assessment={mode} onExit={() => go(`adultos/evaluacion/${profile.id}`)} />;
}
