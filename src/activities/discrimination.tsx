import { useEffect, useRef, useState } from 'react';
import { ChoiceBoard, type ChoiceOption } from '../components/ChoiceBoard';
import content from '../content/discrimination.json';
import { PHONEMES } from '../lib/phonemes';
import { shuffle } from '../lib/random';
import { evaluateClaps, randomPattern, rhythmDistractors, type Pattern } from '../lib/rhythm';
import { playClap, playRhythm } from '../lib/sounds';
import { SLOW_RATE } from '../lib/speech';
import type { Activity, Item, ItemViewProps } from './types';

export interface WordPair {
  a: string;
  b: string;
  level: number;
}
export const PAIRS = content.pairs as WordPair[];

export type DiscriminationKind = 'samediff' | 'rhythm' | 'syllables';
/** Orden fijo de tipos dentro de una sesión: variedad sin repetir dos iguales seguidos. */
export const KIND_ORDER: readonly DiscriminationKind[] = ['samediff', 'syllables', 'rhythm', 'samediff', 'syllables'];

interface SameDiffData {
  kind: 'samediff';
  x: string;
  y: string;
  same: boolean;
}
interface RhythmData {
  kind: 'rhythm';
  pattern: Pattern;
  options: { id: string; pattern: Pattern }[];
  correct: string;
}
interface SyllablesData {
  kind: 'syllables';
  word: string;
  syllables: string[];
  emoji: string;
}

const patternId = (p: Pattern) => p.join('');
const patternLabel = (p: Pattern) => `ritmo ${p.map((b) => (b === 's' ? 'corto' : 'largo')).join(', ')}`;

/** Golpes cortos (punto) y largos (barra). */
function PatternVisual({ pattern }: { pattern: Pattern }) {
  return (
    <span className="pattern" aria-hidden="true">
      {pattern.map((b, i) => (
        <span key={i} className={b === 's' ? 'beat beat--short' : 'beat beat--long'} />
      ))}
    </span>
  );
}

function SameDiffView({ item, say, submit }: ItemViewProps) {
  const d = item.data as unknown as SameDiffData;
  const options: ChoiceOption[] = [
    { id: 'igual', label: 'iguales', content: <span className="choice__emoji choice__emoji--duo">🟦🟦</span> },
    { id: 'diferente', label: 'diferentes', content: <span className="choice__emoji choice__emoji--duo">🟦🟥</span> },
  ];
  return (
    <ChoiceBoard
      options={options}
      correctId={d.same ? 'igual' : 'diferente'}
      prompt="¿Iguales o diferentes?"
      retrySay={`Escucha otra vez. ${d.x}. ${d.y}.`}
      say={say}
      submit={submit}
    />
  );
}

function RhythmView({ item, say, submit }: ItemViewProps) {
  const d = item.data as unknown as RhythmData;
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const options: ChoiceOption[] = d.options.map((o) => ({
    id: o.id,
    label: patternLabel(o.pattern),
    content: <PatternVisual pattern={o.pattern} />,
    className: 'choice--pattern',
  }));
  return (
    <ChoiceBoard
      options={options}
      correctId={d.correct}
      prompt="¿Cuál suena igual?"
      retrySay="Escucha otra vez."
      // Tras equivocarse se vuelve a tocar el ritmo, después de decir la frase.
      onWrong={() => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => playRhythm(d.pattern), 1400);
      }}
      say={say}
      submit={submit}
      header={
        <button type="button" className="btn btn--accent btn--big" onClick={() => playRhythm(d.pattern)} aria-label="Escuchar el ritmo">
          🔊 Escuchar
        </button>
      }
    />
  );
}

const CLAP_CAP = 8;
const REVEAL_MS = 3000;

function SyllablesView({ item, say, submit }: ItemViewProps) {
  const d = item.data as unknown as SyllablesData;
  const n = d.syllables.length;
  const [claps, setClaps] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const finished = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const clap = () => {
    if (revealed || finished.current) return;
    playClap();
    setClaps((c) => Math.min(c + 1, CLAP_CAP));
  };

  const done = () => {
    if (revealed || finished.current) return;
    const verdict = evaluateClaps(claps, n, attempt);
    if (verdict === 'correct') {
      finished.current = true;
      submit(attempt === 1 ? 'full' : 'help');
    } else if (verdict === 'retry') {
      // Sin sonido ni mensaje de error: se cuenta juntos y se intenta otra vez.
      setAttempt(attempt + 1);
      setClaps(0);
      say(`Vamos a contar juntos. ${d.syllables.join(', ')}.`, SLOW_RATE);
    } else {
      // Se muestra la respuesta contando las partes y se sigue.
      setRevealed(true);
      setClaps(n);
      say(`${d.syllables.join(', ')}. ¡${n} palmadas!`, SLOW_RATE);
      timer.current = window.setTimeout(() => {
        finished.current = true;
        submit('help');
      }, REVEAL_MS);
    }
  };

  return (
    <div className="item-center syl">
      <div className="item-emoji item-emoji--sm" role="img" aria-label={d.word}>
        {d.emoji}
      </div>
      <p className="item-text item-text--sm">¿Cuántas palmadas?</p>
      <ol className="dots dots--big" aria-label={`${claps} palmadas`}>
        {Array.from({ length: claps }, (_, i) => (
          <li key={i} className="dot dot--done" />
        ))}
      </ol>
      <div className="row row--center">
        <button type="button" className="clap-pad" onClick={clap} aria-label="Aplaudir una vez" disabled={revealed}>
          👏
        </button>
        <div className="syl__side">
          <button type="button" className="btn btn--good" onClick={done} disabled={revealed || claps === 0}>
            ✔ Listo
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setClaps(0)} disabled={revealed || claps === 0} aria-label="Borrar palmadas">
            ↺
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => say(d.syllables.join(', '), SLOW_RATE)}>
            👂 Por partes
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscriminationView(props: ItemViewProps) {
  const kind = (props.item.data as { kind: DiscriminationKind }).kind;
  if (kind === 'rhythm') return <RhythmView {...props} />;
  if (kind === 'syllables') return <SyllablesView {...props} />;
  return <SameDiffView {...props} />;
}

/** Palabras de las listas de fonemas, sin repetir, con su separación en sílabas. */
export function syllableWords(level: number) {
  const seen = new Set<string>();
  const out: { word: string; syllables: string[]; emoji: string }[] = [];
  for (const p of PHONEMES) {
    for (const w of p.words) {
      if (seen.has(w.word)) continue;
      seen.add(w.word);
      out.push({ word: w.word, syllables: w.syllables, emoji: w.emoji });
    }
  }
  // Nivel 1: 1-3 sílabas (se prefieren 2-3). Nivel 2: 2-4 (se prefieren 3-4).
  const min = level >= 2 ? 2 : 1;
  const max = level >= 2 ? 4 : 3;
  return out.filter((w) => w.syllables.length >= min && w.syllables.length <= max);
}

/** Actividad 11: Discriminación auditiva (¿igual o diferente?, ritmo y contar sílabas con palmadas). */
export const discrimination: Activity = {
  id: 'discriminacion',
  title: 'Escucha atenta',
  icon: '👂',
  area: 'discriminacion',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a escuchar con mucha atención. Hay sonidos, ritmos y palmadas.',
  adultRated: false,
  itemCount: 5,
  buildItems(level, count, rng): Item[] {
    const pairs = shuffle(PAIRS.filter((p) => p.level === level), rng);
    const words = shuffle(syllableWords(level), rng);
    const used = { pair: 0, word: 0 };
    return Array.from({ length: count }, (_, i): Item => {
      const kind = KIND_ORDER[i % KIND_ORDER.length];
      if (kind === 'samediff') {
        const pair = pairs[used.pair++ % pairs.length];
        const same = rng() < 0.5;
        const [x, y] = same ? [pair.a, pair.a] : rng() < 0.5 ? [pair.a, pair.b] : [pair.b, pair.a];
        const data: SameDiffData = { kind, x, y, same };
        return {
          id: `disc-${i}-igual-${x}-${y}`,
          target: `${x} / ${y} (${same ? 'iguales' : 'diferentes'})`,
          prompt: `Escucha con atención. ${x}. ${y}. ¿Son iguales o diferentes?`,
          data: data as unknown as Record<string, unknown>,
        };
      }
      if (kind === 'rhythm') {
        const length = level >= 2 ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
        const pattern = randomPattern(length, rng);
        const all = shuffle([pattern, ...rhythmDistractors(pattern, level, 2, rng)], rng);
        const data: RhythmData = {
          kind,
          pattern,
          options: all.map((p) => ({ id: patternId(p), pattern: p })),
          correct: patternId(pattern),
        };
        return {
          id: `disc-${i}-ritmo-${patternId(pattern)}`,
          target: patternLabel(pattern),
          prompt: 'Toca el altavoz y escucha el ritmo. Luego toca el que suena igual.',
          data: data as unknown as Record<string, unknown>,
        };
      }
      const w = words[used.word++ % words.length];
      const data: SyllablesData = { kind, word: w.word, syllables: w.syllables, emoji: w.emoji };
      return {
        id: `disc-${i}-silabas-${w.word}`,
        target: `${w.syllables.join('-')} (${w.syllables.length} sílabas)`,
        prompt: `Mira. Esto es ${w.word}. Aplaude una vez por cada parte: ${w.word}.`,
        model: w.syllables.join(', '),
        data: data as unknown as Record<string, unknown>,
      };
    });
  },
  ItemView: DiscriminationView,
};

