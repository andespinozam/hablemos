import content from '../content/warmup.json';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

interface Word {
  id: string;
  word: string;
  article: string;
  emoji: string;
  level: number;
}

const WORDS = content.words as Word[];

/** Calentamiento: el niño mira el dibujo y repite la palabra; el adulto califica. */
function WarmupItemView({ item }: ItemViewProps) {
  const emoji = String(item.data?.emoji ?? '');
  return (
    <div className="item-center">
      <div className="item-emoji" role="img" aria-label={item.target}>
        {emoji}
      </div>
      <p className="item-text">{item.target}</p>
    </div>
  );
}

export const warmup: Activity = {
  id: 'warmup',
  title: 'Repite conmigo',
  icon: '🗣️',
  area: 'expresivo',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a repetir palabras. Escucha y dilo conmigo.',
  adultRated: true,
  buildItems(level, count, rng): Item[] {
    const pool = WORDS.filter((w) => w.level <= level);
    // Con nivel alto, mezcla palabras más largas pero sin olvidar las fáciles.
    const preferred = shuffle(
      pool.filter((w) => w.level === level),
      rng,
    );
    const rest = shuffle(
      pool.filter((w) => w.level !== level),
      rng,
    );
    return [...preferred, ...rest].slice(0, count).map((w) => ({
      id: w.id,
      target: w.word,
      prompt: `Mira. Es ${w.article} ${w.word}. Dilo conmigo: ${w.word}.`,
      data: { emoji: w.emoji },
    }));
  },
  ItemView: WarmupItemView,
};
