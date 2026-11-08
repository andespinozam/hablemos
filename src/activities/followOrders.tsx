import { useEffect, useRef, useState } from 'react';
import content from '../content/orders.json';
import { lookAgain } from '../lib/phrases';
import { ratingForMistakes, tryMove, type Move } from '../lib/orders';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export interface Thing {
  id: string;
  word: string;
  article: string;
  emoji: string;
}

export const ORDER_OBJECTS = content.objects as Thing[];
export const ORDER_PLACES = content.places as Thing[];

interface OrderData {
  objects: Thing[];
  places: Thing[];
  moves: Move[];
}

const FINISH_DELAY_MS = 700;

function FollowOrderView({ item, say, submit }: ItemViewProps) {
  const data = item.data as unknown as OrderData;
  const [remaining, setRemaining] = useState<Move[]>(data.moves);
  const [placed, setPlaced] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const placedIds = new Set(Object.values(placed).flat());
  const hintOn = mistakes >= 2;
  const nextMove = remaining[0];
  // Pista: lo que falta por tocar (el objeto, o el lugar si ya hay uno elegido).
  const hintObj = hintOn && !selected ? nextMove?.obj : null;
  const hintPlace = hintOn && selected ? remaining.find((m) => m.obj === selected)?.place : null;

  const toggleObject = (id: string) => setSelected((s) => (s === id ? null : id));

  const pickPlace = (placeId: string) => {
    if (!selected) return;
    const result = tryMove(remaining, selected, placeId);
    if (result.ok) {
      setPlaced((p) => ({ ...p, [placeId]: [...(p[placeId] ?? []), selected] }));
      setRemaining(result.remaining);
      setSelected(null);
      if (result.remaining.length === 0) {
        timer.current = window.setTimeout(() => submit(ratingForMistakes(mistakes)), FINISH_DELAY_MS);
      }
    } else {
      // Sin sonido ni mensaje de error: el objeto vuelve y se repite la orden con calma.
      setMistakes((m) => m + 1);
      setSelected(null);
      say(lookAgain(item.prompt));
    }
  };

  const byId = (list: Thing[], id: string) => list.find((t) => t.id === id);

  return (
    <div className="item-center order">
      <p className="item-text item-text--sm">{item.prompt}</p>
      <div className="order__row" role="group" aria-label="Objetos">
        {data.objects
          .filter((o) => !placedIds.has(o.id))
          .map((o) => (
            <button
              key={o.id}
              type="button"
              className={`choice${selected === o.id ? ' choice--selected' : ''}${hintObj === o.id ? ' choice--hint' : ''}`}
              aria-label={o.word}
              aria-pressed={selected === o.id}
              onClick={() => toggleObject(o.id)}
            >
              <span className="choice__emoji">{o.emoji}</span>
            </button>
          ))}
      </div>
      <div className="order__row" role="group" aria-label="Lugares">
        {data.places.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`choice choice--place${hintPlace === p.id ? ' choice--hint' : ''}`}
            aria-label={p.word}
            onClick={() => pickPlace(p.id)}
          >
            <span className="choice__emoji">{p.emoji}</span>
            <span className="place__in" aria-hidden="true">
              {(placed[p.id] ?? []).map((id) => (
                <span key={id}>{byId(data.objects, id)?.emoji}</span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function phrase(move: Move): string {
  const obj = ORDER_OBJECTS.find((o) => o.id === move.obj)!;
  const place = ORDER_PLACES.find((p) => p.id === move.place)!;
  return `${obj.article} ${obj.word} en ${place.article} ${place.word}`;
}

/** Actividad 2: Sigue la orden (1 paso, o 2 pasos en el nivel 2). */
export const followOrders: Activity = {
  id: 'sigue-orden',
  title: 'Sigue la orden',
  icon: '📦',
  area: 'ordenes',
  minAge: 3,
  maxLevel: 2,
  intro: 'Escucha la orden y hazla tocando los dibujos.',
  adultRated: false,
  itemCount: 3,
  buildItems(level, count, rng): Item[] {
    const steps = level >= 2 ? 2 : 1;
    return Array.from({ length: count }, (_, i) => {
      const objs = shuffle(ORDER_OBJECTS, rng);
      const places = shuffle(ORDER_PLACES, rng);
      const moves: Move[] = Array.from({ length: steps }, (_, s) => ({ obj: objs[s].id, place: places[s].id }));
      const prompt = `Pon ${moves.map(phrase).join(' y luego ')}.`;
      const data: OrderData = {
        // Los objetos pedidos van siempre en pantalla, con 1-2 distractores.
        objects: shuffle(objs.slice(0, steps + 2), rng),
        places: shuffle(places.slice(0, 3), rng),
        moves,
      };
      return {
        id: `orden-${i}-${moves.map((m) => `${m.obj}-${m.place}`).join('-')}`,
        target: steps === 1 ? 'orden de 1 paso' : 'orden de 2 pasos',
        prompt,
        data: data as unknown as Record<string, unknown>,
      };
    });
  },
  ItemView: FollowOrderView,
};
