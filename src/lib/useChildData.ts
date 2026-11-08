import { useEffect, useState } from 'react';
import { listAssessments } from './assessmentStore';
import type { AssessmentRecord, PronunciationRecord, ResultRecord, SessionRecord } from './db';
import { getLevels, listResults, listSessions } from './progress';
import { listPronunciation } from './pronunciationStore';

export interface ChildData {
  results: ResultRecord[];
  sessions: SessionRecord[];
  assessments: AssessmentRecord[];
  pronunciation: PronunciationRecord[];
  levels: Record<string, number>;
}

export type ChildDataState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: ChildData };

/** Carga todo lo guardado de un niño (para seguimiento, evaluación y reporte). */
export function useChildData(profileId: string): ChildDataState {
  const [state, setState] = useState<ChildDataState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    Promise.all([listResults(profileId), listSessions(profileId), listAssessments(profileId), getLevels(profileId), listPronunciation(profileId)])
      .then(([results, sessions, assessments, levels, pronunciation]) => {
        if (alive) setState({ status: 'ready', data: { results, sessions, assessments, levels, pronunciation } });
      })
      .catch((e) => {
        console.error(e);
        if (alive) setState({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [profileId]);
  return state;
}
