import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVITIES, getActivity } from '../activities/registry';
import type { Activity, BuildContext, Item } from '../activities/types';
import { AdultPanel } from '../components/AdultPanel';
import { RepeatButton } from '../components/RepeatButton';
import { StarBurst, randomPraise } from '../components/Stars';
import { ageInYears } from '../lib/age';
import { buildAssessmentPlan, groupIntoSteps, shuffleForReassessment } from '../lib/assessmentPlan';
import { completeAssessment, createAssessment } from '../lib/assessmentStore';
import type { AssessmentItem, ChildProfile } from '../lib/db';
import { LADDER_ACTIVITY_ID, parseLadderItemId } from '../lib/ladder';
import { applyLadderProgress, listLadders } from '../lib/ladderStore';
import { summarizePhonemes } from '../lib/phonemeStats';
import {
  addResult,
  applyAdaptation,
  finishSession,
  getLastPracticed,
  getLevels,
  listResults,
  startSession,
} from '../lib/progress';
import type { Rating } from '../lib/scoring';
import { START, nextPosition, type Position } from '../lib/sessionFlow';
import { ITEMS_PER_ACTIVITY, planSession } from '../lib/sessionPlan';
import { playSound } from '../lib/sounds';
import { useWakeLock } from '../lib/wakeLock';
import { SLOW_RATE, SPEECH_RATE, cancelSpeech, speak } from '../lib/speech';
import { FINISH_PHRASE, retryPhrase } from '../lib/phrases';
import { Celebration } from './Celebration';

interface Step {
  activity: Activity;
  level: number;
  items: Item[];
}
interface Plan {
  sessionId: string;
  steps: Step[];
  /** Solo en evaluaciones. */
  assessmentId?: string;
}

/** Si se pasa, la sesión es una evaluación en lugar de práctica libre. */
export interface AssessmentMode {
  kind: 'baseline' | 'reassessment';
  /** Ítems de la evaluación inicial a repetir (solo reevaluación). */
  items?: AssessmentItem[];
}

const PRAISE_MS = 1600;

/** Lo que se dice con calma tras un "Aún no": el modelo del ítem, sin puntuación doble. */
export function retryText(item: Item): string {
  return retryPhrase(item.model ?? item.target);
}

interface Props {
  profile: ChildProfile;
  onExit: () => void;
  assessment?: AssessmentMode;
}

/** Sesión guiada: 3-4 actividades según la edad y el nivel, y una celebración final. */
export function SessionRunner({ profile, onExit, assessment }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState('');
  const [pos, setPos] = useState<Position>(START);
  const [stars, setStars] = useState(0);
  const [praise, setPraise] = useState('');

  useWakeLock(true); // la pantalla no se apaga mientras dura la sesión

  const started = useRef(false);
  const finished = useRef(false);
  const timer = useRef<number | null>(null);
  const lastText = useRef('');
  const lastRate = useRef(SPEECH_RATE);

  const say = useCallback((text: string, rate: number = SPEECH_RATE) => {
    lastText.current = text;
    lastRate.current = rate;
    void speak(text, rate);
  }, []);

  // Preparar la sesión (una sola vez, aunque StrictMode repita el efecto).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const [levels, lastPracticed, results, ladders] = await Promise.all([
          getLevels(profile.id),
          getLastPracticed(profile.id),
          listResults(profile.id),
          listLadders(profile.id),
        ]);
        const ladderLast: Record<string, number> = {};
        for (const r of results) {
          const p = r.activityId === LADDER_ACTIVITY_ID ? parseLadderItemId(r.itemId) : null;
          if (p) ladderLast[p.phonemeId] = Math.max(ladderLast[p.phonemeId] ?? 0, r.at);
        }
        const age = Math.max(ageInYears(profile.birthDate, new Date()) ?? 3, 3);
        const ctx: BuildContext = { age, phonemes: summarizePhonemes(results), ladders, ladderLast };
        if (assessment) {
          // Evaluación: ítems fijos por área. La reevaluación repite los mismos ítems en otro orden.
          const items =
            assessment.kind === 'baseline'
              ? buildAssessmentPlan(age, Math.random)
              : shuffleForReassessment(assessment.items ?? [], Math.random);
          const groups = groupIntoSteps(items);
          const evalSteps: Step[] = groups.flatMap((g) => {
            const activity = getActivity(g.activityId);
            return activity ? [{ activity, level: 1, items: g.items.map((x) => x.item) }] : [];
          });
          if (evalSteps.length === 0) throw new Error('Evaluación vacía');
          const session = await startSession(profile.id, groups.map((g) => g.activityId), Date.now(), assessment.kind);
          const record = await createAssessment({
            profileId: profile.id,
            kind: assessment.kind,
            sessionId: session.id,
            ageYears: age,
            items: groups.flatMap((g) => g.items),
          });
          setPlan({ sessionId: session.id, steps: evalSteps, assessmentId: record.id });
          return;
        }
        const available = ACTIVITIES.filter((a) => a.isAvailable?.(ctx) !== false);
        // Si hay escaleras activas, la escalera entra siempre: así se acumulan las 3 sesiones.
        const must = available.filter((a) => a.id === LADDER_ACTIVITY_ID).map((a) => a.id);
        const ids = planSession(available, { age, lastPracticed }, Math.random, must);
        const steps: Step[] = ids.flatMap((id) => {
          const activity = getActivity(id);
          if (!activity) return [];
          const level = Math.min(levels[id] ?? 1, activity.maxLevel);
          const count = activity.itemCount ?? ITEMS_PER_ACTIVITY;
          return [{ activity, level, items: activity.buildItems(level, count, Math.random, ctx) }];
        });
        if (steps.length === 0) throw new Error('Sin actividades');
        const session = await startSession(profile.id, ids);
        setPlan({ sessionId: session.id, steps });
      } catch (e) {
        console.error(e);
        setError('No pudimos preparar los juegos. Pide ayuda a un adulto.');
      }
    })();
  }, [profile.id, profile.birthDate, assessment]);

  useEffect(
    () => () => {
      cancelSpeech();
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // Instrucción hablada al entrar a cada pantalla.
  const step = plan?.steps[pos.a];
  const item = step?.items[pos.i];
  useEffect(() => {
    if (!step) return;
    if (pos.stage === 'intro') say(step.activity.intro);
    else if (pos.stage === 'item' && item) say(item.prompt);
    else if (pos.stage === 'retry' && item) say(retryText(item), SLOW_RATE);
  }, [step, item, pos.stage, say]);

  const finish = useCallback(
    async (completed: boolean) => {
      if (finished.current || !plan) return;
      finished.current = true;
      try {
        await finishSession(plan.sessionId);
        if (plan.assessmentId) {
          // Una evaluación a medias queda registrada pero no cuenta ni cambia niveles.
          if (completed) {
            const maxLevels = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a.maxLevel]));
            await completeAssessment(plan.assessmentId, maxLevels);
          }
        } else {
          const maxLevels = Object.fromEntries(plan.steps.map((s) => [s.activity.id, s.activity.maxLevel]));
          await applyAdaptation(profile.id, plan.sessionId, maxLevels);
          await applyLadderProgress(profile.id, plan.sessionId);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [plan, profile.id],
  );

  // Al llegar al final: guardar, adaptar niveles y celebrar.
  useEffect(() => {
    if (pos.stage !== 'done') return;
    void finish(true);
    playSound('fanfare');
    say(FINISH_PHRASE);
  }, [pos.stage, finish, say]);

  const advance = useCallback(() => {
    if (!plan) return;
    setStars((n) => n + 1);
    setPos((p) =>
      nextPosition(
        p,
        plan.steps.map((s) => s.items.length),
      ),
    );
  }, [plan]);

  const submit = useCallback(
    (rating: Rating) => {
      if (!plan || !step || !item || pos.stage !== 'item') return;
      addResult({
        sessionId: plan.sessionId,
        profileId: profile.id,
        activityId: step.activity.id,
        itemId: item.id,
        target: item.target,
        area: item.area ?? step.activity.area,
        phoneme: item.phoneme,
        level: item.level ?? step.level,
        rating,
      }).catch((e) => console.error(e));

      if (rating === 'not_yet') {
        // Sin sonido ni mensaje de error: se repite el modelo con calma y se ofrece reintentar.
        setPos((p) => ({ ...p, stage: 'retry' }));
        return;
      }
      const text = randomPraise();
      setPraise(text);
      setPos((p) => ({ ...p, stage: 'praise' }));
      playSound('star');
      say(text);
      timer.current = window.setTimeout(advance, PRAISE_MS);
    },
    [plan, step, item, pos.stage, profile.id, advance, say],
  );

  const endEarly = async () => {
    cancelSpeech();
    if (timer.current !== null) window.clearTimeout(timer.current);
    await finish(false);
    onExit();
  };

  if (error) {
    return (
      <main className="screen screen--center">
        <p className="avatar" aria-hidden="true">
          🙈
        </p>
        <p role="alert">{error}</p>
        <button type="button" className="btn" onClick={onExit}>
          ⬅️ Volver
        </button>
      </main>
    );
  }

  if (!plan || !step) {
    return (
      <main className="screen screen--center" aria-busy="true">
        <p className="avatar bob" aria-hidden="true">
          🗣️
        </p>
      </main>
    );
  }

  if (pos.stage === 'done') {
    return <Celebration profile={profile} stars={stars} onExit={onExit} />;
  }

  const stageItem = pos.stage === 'intro' ? null : item;

  return (
    <main className="screen play-zone session">
      {/* Encabezado para lectores de pantalla: la introducción ya trae el suyo a la vista. */}
      {pos.stage !== 'intro' && <h1 className="sr-only">{step.activity.title}</h1>}
      <header className="session__top">
        <ol className="dots" aria-label={`Actividad ${pos.a + 1} de ${plan.steps.length}`}>
          {step.items.map((it, idx) => (
            <li
              key={it.id}
              className={idx < pos.i || (idx === pos.i && pos.stage === 'praise') ? 'dot dot--done' : idx === pos.i ? 'dot dot--now' : 'dot'}
            />
          ))}
        </ol>
        <span className="spacer" />
        <RepeatButton onRepeat={() => say(lastText.current, lastRate.current)} />
      </header>

      <section className="session__stage" aria-live="polite">
        {pos.stage === 'intro' && (
          <div className="item-center">
            <div className="item-emoji" aria-hidden="true">
              {step.activity.icon}
            </div>
            <h1 className="item-title">{step.activity.title}</h1>
            <button type="button" className="btn btn--good btn--big" onClick={() => setPos((p) => ({ ...p, stage: 'item' }))}>
              ▶ ¡Vamos!
            </button>
          </div>
        )}

        {/* `key`: cada ítem empieza con su estado limpio. */}
        {pos.stage === 'item' && item && (
          <step.activity.ItemView key={`${pos.a}-${item.id}`} item={item} say={say} submit={submit} />
        )}

        {pos.stage === 'praise' && <StarBurst text={praise} />}

        {pos.stage === 'retry' && item && (
          <div className="item-center">
            <step.activity.ItemView key={`retry-${pos.a}-${item.id}`} item={item} say={say} submit={() => undefined} />
            <div className="row row--center">
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => say(retryText(item), SLOW_RATE)}
              >
                🔁 Otra vez
              </button>
              <button type="button" className="btn btn--good" onClick={advance}>
                ➡️ Seguir
              </button>
            </div>
          </div>
        )}
      </section>

      <AdultPanel
        target={stageItem?.target ?? step.activity.title}
        canRate={step.activity.adultRated}
        rateDisabled={pos.stage !== 'item'}
        onRate={submit}
        onEnd={() => void endEarly()}
        endLabel={plan.assessmentId ? 'Detener evaluación' : 'Terminar sesión'}
      />
    </main>
  );
}
