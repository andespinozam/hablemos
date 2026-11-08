import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import categoriesContent from '../content/categories.json';
import { ratingForMistakes } from '../lib/orders';
import { shuffle } from '../lib/random';
import { INITIAL_SORT, hintObject, placeObject, type SortObject, type SortState } from '../lib/sorting';
import { VOCAB, type VocabWord } from './listenPoint';
import type { Activity, Item, ItemViewProps } from './types';

export interface Category {
  id: string;
  label: string;
  phrase: string;
  emoji: string;
}
export const CATEGORIES = categoriesContent.categories as Category[];

interface SortObj extends SortObject {
  word: string;
  article: string;
  emoji: string;
}
interface SortData {
  bins: Category[];
  objects: SortObj[];
}

const FINISH_DELAY_MS = 700;
/** Un movimiento menor a esto cuenta como toque, no como arrastre. */
const DRAG_THRESHOLD_PX = 10;

interface DragProps {
  obj: SortObj;
  selected: boolean;
  hint: boolean;
  onTap: (id: string) => void;
  onDrop: (id: string, binId: string | null) => void;
}

/** Objeto que se puede arrastrar (puntero/táctil) o tocar y luego tocar el grupo. */
function DragObject({ obj, selected, hint, onTap, onDrop }: DragProps) {
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* sin captura igual se puede soltar: se usa la posición final */
    }
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) s.moved = true;
    if (s.moved) setOffset({ x: dx, y: dy });
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    setOffset(null);
    if (!s?.moved) return; // fue un toque: lo atiende onClick
    suppressClick.current = true;
    const target = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el): el is HTMLElement => el instanceof HTMLElement && el.dataset.bin !== undefined);
    onDrop(obj.id, target?.dataset.bin ?? null);
  };
  const cancel = () => {
    start.current = null;
    setOffset(null);
  };

  return (
    <button
      type="button"
      className={`choice drag${selected ? ' choice--selected' : ''}${hint ? ' choice--hint' : ''}${offset ? ' drag--active' : ''}`}
      style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px) scale(1.12)` } : undefined}
      aria-label={obj.word}
      aria-pressed={selected}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onTap(obj.id);
      }}
    >
      <span className="choice__emoji">{obj.emoji}</span>
    </button>
  );
}

function SortingView({ item, say, submit }: ItemViewProps) {
  const data = item.data as unknown as SortData;
  const [state, setState] = useState<SortState>(INITIAL_SORT);
  const [selected, setSelected] = useState<string | null>(null);
  const done = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const hint = hintObject(data.objects, state);

  const place = (objId: string, binId: string) => {
    if (done.current) return;
    const obj = data.objects.find((o) => o.id === objId);
    if (!obj) return;
    const out = placeObject(state, obj, binId, data.objects.length);
    if (out.kind === 'ignored') return;
    setSelected(null);
    setState(out.state);
    if (out.kind === 'wrong') {
      // Sin sonido ni mensaje de error: el objeto vuelve y se pregunta con calma.
      say(`Probemos otra vez. ¿Dónde va ${obj.article} ${obj.word}?`);
    } else if (out.complete) {
      done.current = true;
      const rating = ratingForMistakes(out.state.mistakes);
      timer.current = window.setTimeout(() => submit(rating), FINISH_DELAY_MS);
    }
  };

  const tray = data.objects.filter((o) => !state.placed[o.id]);

  return (
    <div className="item-center sorting">
      <p className="item-text item-text--sm">{item.prompt}</p>
      <div className="bins" role="group" aria-label="Grupos">
        {data.bins.map((b) => (
          <button
            key={b.id}
            type="button"
            data-bin={b.id}
            className={`bin${hint?.bin === b.id ? ' choice--hint' : ''}`}
            aria-label={`Grupo ${b.label}`}
            onClick={() => selected && place(selected, b.id)}
          >
            <span className="bin__icon" aria-hidden="true">
              {b.emoji}
            </span>
            <span className="bin__label">{b.label}</span>
            <span className="bin__in" aria-hidden="true">
              {data.objects.filter((o) => state.placed[o.id] === b.id).map((o) => (
                <span key={o.id}>{o.emoji}</span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="tray" role="group" aria-label="Objetos para ordenar">
        {tray.map((o) => (
          <DragObject
            key={o.id}
            obj={o}
            selected={selected === o.id}
            hint={hint?.id === o.id}
            onTap={(id) => setSelected((s) => (s === id ? null : id))}
            onDrop={(id, binId) => (binId ? place(id, binId) : setSelected(null))}
          />
        ))}
      </div>
    </div>
  );
}

/** Actividad 6: Categorías (arrastrar objetos a su grupo). */
export const sorting: Activity = {
  id: 'categorias',
  title: 'Categorías',
  icon: '🧺',
  area: 'conceptos',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a poner cada cosa con las de su grupo.',
  adultRated: false,
  itemCount: 3,
  buildItems(level, count, rng): Item[] {
    const binCount = level >= 2 ? 3 : 2;
    const perBin = 2;
    const pool = VOCAB.filter((w) => w.level <= level);
    // Solo categorías con suficientes palabras.
    const usable = CATEGORIES.filter((c) => pool.filter((w) => w.category === c.id).length >= perBin);

    return Array.from({ length: count }, (_, i): Item => {
      const bins = shuffle(usable, rng).slice(0, binCount);
      const objects: SortObj[] = shuffle(
        bins.flatMap((b) =>
          shuffle(
            pool.filter((w: VocabWord) => w.category === b.id),
            rng,
          )
            .slice(0, perBin)
            .map((w) => ({ id: w.id, word: w.word, article: w.article, emoji: w.emoji, bin: b.id })),
        ),
        rng,
      );
      const names = bins.map((b) => b.phrase);
      const data: SortData = { bins, objects };
      return {
        id: `categorias-${i}-${bins.map((b) => b.id).join('-')}`,
        target: bins.map((b) => b.label).join(' / '),
        prompt: `Pon cada cosa con su grupo: ${names.slice(0, -1).join(', ')}${names.length > 1 ? ' y ' : ''}${names[names.length - 1]}.`,
        data: data as unknown as Record<string, unknown>,
      };
    });
  },
  ItemView: SortingView,
};
