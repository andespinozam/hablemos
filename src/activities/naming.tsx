import { VOCAB } from './listenPoint';
import { shuffle, spreadBy } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

/** El niño mira el dibujo y dice la palabra; el adulto califica con su panel. */
function NamingView({ item, say }: ItemViewProps) {
  const emoji = String(item.data?.emoji ?? '');
  const model = String(item.data?.model ?? item.target);
  return (
    <div className="item-center">
      <div className="item-emoji" role="img" aria-label="Dibujo para nombrar">
        {emoji}
      </div>
      <p className="item-text item-text--sm">¿Qué es esto?</p>
      {/* Ayuda opcional: el adulto la usa y marca "Con ayuda". */}
      <button type="button" className="btn btn--ghost btn--small" onClick={() => say(model)}>
        👂 Escucha
      </button>
    </div>
  );
}

/** Actividad 5: ¿Qué es esto? (denominación expresiva; el adulto califica). */
export const naming: Activity = {
  id: 'que-es-esto',
  title: '¿Qué es esto?',
  icon: '❓',
  area: 'expresivo',
  minAge: 3,
  maxLevel: 2,
  intro: 'Mira el dibujo y dime qué es.',
  adultRated: true,
  itemCount: 5,
  buildItems(level, count, rng): Item[] {
    const pool = VOCAB.filter((w) => w.level <= level);
    // En el nivel 2 se prefieren las palabras del nivel (más largas o menos comunes).
    const preferred = spreadBy(
      pool.filter((w) => w.level === level),
      (w) => w.category,
      count,
      rng,
    );
    const fill =
      preferred.length >= count
        ? []
        : spreadBy(
            pool.filter((w) => !preferred.includes(w)),
            (w) => w.category,
            count - preferred.length,
            rng,
          );
    return shuffle([...preferred, ...fill], rng).map((w) => ({
      id: w.id,
      target: w.word,
      prompt: '¿Qué es esto?',
      data: { emoji: w.emoji, model: `Es ${w.article} ${w.word}.` },
    }));
  },
  ItemView: NamingView,
};
