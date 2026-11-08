import { useEffect, useRef, useState } from 'react';
import { lookAgain } from '../lib/phrases';
import content from '../content/phrases.json';
import { INITIAL_CHOICE, choose, showHint, type ChoiceState } from '../lib/choice';
import { ratingForMistakes } from '../lib/orders';
import { shuffle, type Rng } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export interface PhraseTile {
  text: string;
  emoji: string;
}
export interface Phrase {
  id: string;
  level: number;
  spoken: string;
  scene: string;
  tiles: PhraseTile[];
}
export const PHRASES = content.phrases as Phrase[];

interface PhraseData {
  /** Fichas en el orden correcto, con id por posición. */
  tiles: (PhraseTile & { id: string })[];
  /** Ids de las fichas en el orden en que se muestran (revuelto). */
  order: string[];
  spoken: string;
  scene: string;
}

const FINISH_DELAY_MS = 1500;

/** Revuelve las fichas asegurando que no queden ya en el orden correcto. */
export function shuffleTiles<T>(ids: readonly T[], rng: Rng): T[] {
  if (ids.length < 2) return [...ids];
  for (let attempt = 0; attempt < 20; attempt++) {
    const out = shuffle(ids, rng);
    if (out.some((x, i) => x !== ids[i])) return out;
  }
  return [...ids.slice(1), ids[0]]; // rotación: nunca queda igual
}

function PhraseView({ item, say, submit }: ItemViewProps) {
  const data = item.data as unknown as PhraseData;
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<ChoiceState>(INITIAL_CHOICE);
  const [mistakes, setMistakes] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const total = data.tiles.length;
  const placedIds = new Set(data.tiles.slice(0, step).map((t) => t.id));
  const expected = data.tiles[step]?.id;
  const hint = showHint(choice);

  const pick = (id: string) => {
    if (step >= total) return;
    const out = choose(choice, id, expected);
    if (out.kind === 'wrong') {
      // Sin sonido ni mensaje de error: la ficha se atenúa y se repite la frase.
      setChoice(out.state);
      setMistakes((m) => m + 1);
      say(lookAgain(data.spoken));
    } else if (out.kind === 'correct') {
      setChoice(INITIAL_CHOICE);
      setStep(step + 1);
      if (step + 1 === total) {
        say(data.spoken);
        const rating = ratingForMistakes(mistakes);
        timer.current = window.setTimeout(() => submit(rating), FINISH_DELAY_MS);
      }
    }
  };

  return (
    <div className="item-center phrase">
      <div className="story-recap" aria-hidden="true">
        {data.scene}
      </div>
      <p className="item-text item-text--sm">Arma la frase</p>
      <ol className="slots" aria-label="Tu frase">
        {data.tiles.map((t, i) => (
          <li key={t.id} className={`slot${i < step ? ' slot--full' : ''}`}>
            {i < step && (
              <>
                <span className="tile__emoji">{t.emoji}</span>
                <span className="tile__text">{t.text}</span>
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="tiles" role="group" aria-label="Fichas">
        {data.order
          .filter((id) => !placedIds.has(id))
          .map((id) => {
            const t = data.tiles.find((x) => x.id === id)!;
            const dim = choice.wrong.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={`choice tile${dim ? ' choice--dim' : ''}${hint && id === expected ? ' choice--hint' : ''}`}
                aria-label={t.text}
                disabled={dim}
                onClick={() => pick(id)}
              >
                <span className="tile__emoji">{t.emoji}</span>
                <span className="tile__text">{t.text}</span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

/** Actividad 7: Arma la frase (fichas imagen + palabra, 2-4 palabras). */
export const phrase: Activity = {
  id: 'arma-frase',
  title: 'Arma la frase',
  icon: '🧩',
  area: 'frases',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a armar frases con las fichas. Pon cada ficha en su lugar.',
  adultRated: false,
  itemCount: 4,
  buildItems(level, count, rng): Item[] {
    const exact = shuffle(PHRASES.filter((p) => p.level === level), rng);
    const lower = shuffle(PHRASES.filter((p) => p.level < level), rng);
    return [...exact, ...lower].slice(0, count).map((p) => {
      const tiles = p.tiles.map((t, i) => ({ ...t, id: `t${i}` }));
      const data: PhraseData = {
        tiles,
        order: shuffleTiles(
          tiles.map((t) => t.id),
          rng,
        ),
        spoken: p.spoken,
        scene: p.scene,
      };
      return {
        id: p.id,
        target: p.spoken.replace(/\.$/, ''),
        prompt: `Mira: ${p.spoken} Ahora arma la frase.`,
        data: data as unknown as Record<string, unknown>,
      };
    });
  },
  ItemView: PhraseView,
};
