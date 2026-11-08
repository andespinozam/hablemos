import { useEffect, useRef, useState } from 'react';
import { PraxiaGuide, type GuideKind } from '../components/PraxiaGuide';
import content from '../content/praxias.json';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export interface Praxia {
  id: string;
  level: number;
  guide: GuideKind;
  reps: number;
  target: string;
  prompt: string;
}

export const PRAXIAS = content.items as Praxia[];
export const COUNT_WORDS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'] as const;
/** Tiempo entre un número y el siguiente: lento, para que el niño alcance a hacer el movimiento. */
export const COUNT_INTERVAL_MS = 1700;

type Phase = 'ready' | 'counting' | 'done';

function PraxiaView({ item, say }: ItemViewProps) {
  const guide = item.data?.guide as GuideKind;
  const reps = Number(item.data?.reps ?? 3);
  const [phase, setPhase] = useState<Phase>('ready');
  const [n, setN] = useState(0);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const start = () => {
    clear();
    setPhase('counting');
    for (let i = 1; i <= reps; i++) {
      timers.current.push(
        window.setTimeout(
          () => {
            setN(i);
            say(COUNT_WORDS[i]);
          },
          (i - 1) * COUNT_INTERVAL_MS,
        ),
      );
    }
    timers.current.push(
      window.setTimeout(() => {
        setPhase('done');
        setN(0);
      }, reps * COUNT_INTERVAL_MS),
    );
  };

  return (
    <div className="item-center praxia">
      <div className="praxia__guide">
        <PraxiaGuide guide={guide} active={phase === 'counting'} />
        <div className={`counter${phase === 'counting' && n > 0 ? ' counter--on' : ''}`} aria-live="polite">
          {phase === 'counting' && n > 0 ? n : phase === 'done' ? '⭐' : ''}
        </div>
      </div>
      <ol className="dots" aria-label={`${reps} repeticiones`}>
        {Array.from({ length: reps }, (_, i) => (
          <li key={i} className={`dot${i < n ? ' dot--done' : ''}`} />
        ))}
      </ol>
      {phase !== 'counting' && (
        <button type="button" className="btn btn--good btn--big" onClick={start}>
          {phase === 'done' ? '🔁 Otra vez' : '▶ ¡Vamos!'}
        </button>
      )}
    </div>
  );
}

/** Actividad 8: Praxias orofaciales jugadas, con guía animada y conteo. El adulto califica. */
export const praxias: Activity = {
  id: 'praxias',
  title: 'Juegos de boca',
  icon: '👄',
  area: 'praxias',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a jugar con la boca. Mira el dibujo e imítalo.',
  adultRated: true,
  itemCount: 4,
  buildItems(level, count, rng): Item[] {
    const exact = shuffle(PRAXIAS.filter((p) => p.level === level), rng);
    const lower = shuffle(PRAXIAS.filter((p) => p.level < level), rng);
    return [...exact, ...lower].slice(0, count).map((p) => ({
      id: p.id,
      target: p.target,
      prompt: p.prompt,
      model: p.prompt.replace(/ Cuenta conmigo\.$/, ''),
      data: { guide: p.guide, reps: p.reps },
    }));
  },
  ItemView: PraxiaView,
};
