import { useState } from 'react';
import content from '../content/onomatopoeia.json';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export interface Onomatopoeia {
  id: string;
  name: string;
  emoji: string;
  say: string;
  level: number;
}

export const SOUNDS = content.items as Onomatopoeia[];

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Modelado auditivo + imitación: el niño escucha el sonido y lo imita; el adulto califica. */
function OnomatopoeiaView({ item, say }: ItemViewProps) {
  const emoji = String(item.data?.emoji ?? '');
  const sound = String(item.data?.say ?? '');
  const [wiggle, setWiggle] = useState(0);
  return (
    <div className="item-center">
      <div key={wiggle} className={`item-emoji${wiggle > 0 ? ' wiggle' : ''}`} role="img" aria-label={item.target}>
        {emoji}
      </div>
      <p className="item-text item-text--sm">{sound}</p>
      <button
        type="button"
        className="btn btn--accent"
        onClick={() => {
          say(sound);
          setWiggle((w) => w + 1);
        }}
      >
        🔊 Escucha
      </button>
    </div>
  );
}

/** Actividad 9: Onomatopeyas y animales. */
export const onomatopoeia: Activity = {
  id: 'onomatopeyas',
  title: 'Sonidos de animales',
  icon: '🐮',
  area: 'expresivo',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a escuchar los sonidos de los animales y las cosas. Tú también los haces.',
  adultRated: true,
  itemCount: 5,
  buildItems(level, count, rng): Item[] {
    const exact = shuffle(SOUNDS.filter((s) => s.level === level), rng);
    const lower = shuffle(SOUNDS.filter((s) => s.level < level), rng);
    return [...exact, ...lower].slice(0, count).map((s) => ({
      id: s.id,
      target: `${s.name} hace ${s.say}`,
      prompt: `Escucha. ${cap(s.name)} hace ${s.say}. Ahora, hazlo tú.`,
      model: s.say,
      data: { emoji: s.emoji, say: s.say },
    }));
  },
  ItemView: OnomatopoeiaView,
};
