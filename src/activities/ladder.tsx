import { MouthGuide } from '../components/MouthGuide';
import { LADDER_ACTIVITY_ID, LADDER_STEPS, activeLadders, exercisesFor, type LadderExercise } from '../lib/ladder';
import { getPhoneme } from '../lib/phonemes';
import type { Activity, Item, ItemViewProps } from './types';

/** Escalones en los que la boca se ve grande: escuchar, mirar y sonido aislado. */
const BIG_MOUTH_STEPS = new Set([0, 1, 2]);

function LadderView({ item, say }: ItemViewProps) {
  const d = item.data as unknown as LadderExercise;
  const stepId = LADDER_STEPS[d.step].id;
  const big = BIG_MOUTH_STEPS.has(d.step);
  return (
    <div className="item-center ladder-item">
      {d.emojis.length > 0 && (
        <div className="ladder-emojis" aria-hidden="true">
          {d.emojis.map((e, i) => (
            <span key={i} className="item-emoji">
              {e}
            </span>
          ))}
        </div>
      )}
      {!big && <p className="ladder-text">{d.shown}</p>}
      <MouthGuide mouth={d.mouth} label={d.cue} active={stepId === 'boca' || stepId === 'modelo'} small={!big} />
      {stepId === 'boca' && d.warmups && (
        <ul className="ladder-warmups">
          {d.warmups.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn--accent btn--big" onClick={() => say(d.prompt)}>
        🔊 Escuchar
      </button>
    </div>
  );
}

/**
 * Actividad 13 (Fase 10): escalera de pronunciación. Cada sonido "a estimular" avanza por 6 escalones
 * (modelo, boca, sonido, sílaba, palabra, frase). Califica el adulto; la app NO evalúa el sonido.
 * Solo entra en la sesión si el niño tiene escaleras activas.
 */
export const ladder: Activity = {
  id: LADDER_ACTIVITY_ID,
  title: 'Mi sonido',
  icon: '👄',
  area: 'fonemas',
  minAge: 3,
  maxLevel: 1,
  intro: 'Vamos a practicar un sonido con la boca.',
  adultRated: true,
  isAvailable: (ctx) => (ctx.ladders ?? []).some((l) => l.state === 'active'),
  buildItems(_level, count, rng, ctx): Item[] {
    const chosen = activeLadders(ctx?.ladders ?? [], ctx?.ladderLast ?? {}).slice(0, 2);
    const items: Item[] = [];
    for (const l of chosen) {
      const name = getPhoneme(l.phonemeId)?.name ?? l.phonemeId;
      for (const ex of exercisesFor(l, rng)) {
        items.push({
          id: ex.id,
          target: `${name} · ${LADDER_STEPS[ex.step].short}: ${ex.shown}`,
          prompt: ex.prompt,
          model: ex.model,
          data: ex as unknown as Record<string, unknown>,
        });
      }
    }
    return items.slice(0, Math.max(count, 1));
  },
  ItemView: LadderView,
};
