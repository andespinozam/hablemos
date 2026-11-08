import { ChoiceBoard, type ChoiceOption } from '../components/ChoiceBoard';
import content from '../content/vocab.json';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export interface VocabWord {
  id: string;
  word: string;
  article: string;
  emoji: string;
  category: string;
  level: number;
}

export const VOCAB = content.words as VocabWord[];

interface VocabOption {
  id: string;
  label: string;
  emoji: string;
}

function ListenPointView({ item, say, submit }: ItemViewProps) {
  const data = item.data as { options: VocabOption[]; correct: string };
  const options: ChoiceOption[] = data.options.map((o) => ({
    id: o.id,
    label: o.label,
    content: <span className="choice__emoji">{o.emoji}</span>,
  }));
  return <ChoiceBoard options={options} correctId={data.correct} prompt={item.prompt} say={say} submit={submit} />;
}

/** Actividad 1: Escucha y señala (vocabulario receptivo, 3-4 opciones). */
export const listenPoint: Activity = {
  id: 'escucha-senala',
  title: 'Escucha y señala',
  icon: '👆',
  area: 'receptivo',
  minAge: 3,
  maxLevel: 2,
  intro: 'Escucha con atención y toca lo que te pido.',
  adultRated: false,
  buildItems(level, count, rng): Item[] {
    const optionCount = level >= 2 ? 4 : 3;
    const pool = VOCAB.filter((w) => w.level <= level);
    const targets = [
      ...shuffle(pool.filter((w) => w.level === level), rng),
      ...shuffle(pool.filter((w) => w.level !== level), rng),
    ].slice(0, count);

    return targets.map((t) => {
      const others = pool.filter((w) => w.id !== t.id);
      let distractors: VocabWord[];
      if (level >= 2) {
        // Nivel 2: distractores de la misma categoría (más difícil de discriminar).
        const same = shuffle(others.filter((w) => w.category === t.category), rng);
        const rest = shuffle(others.filter((w) => w.category !== t.category), rng);
        distractors = [...same, ...rest].slice(0, optionCount - 1);
      } else {
        // Nivel 1: cada distractor de una categoría distinta.
        const seen = new Set([t.category]);
        distractors = [];
        for (const w of shuffle(others, rng)) {
          if (seen.has(w.category)) continue;
          seen.add(w.category);
          distractors.push(w);
          if (distractors.length === optionCount - 1) break;
        }
      }
      const options = shuffle([t, ...distractors], rng).map((w) => ({ id: w.id, label: w.word, emoji: w.emoji }));
      return {
        id: t.id,
        target: t.word,
        prompt: `Toca ${t.article} ${t.word}.`,
        data: { options, correct: t.id },
      };
    });
  },
  ItemView: ListenPointView,
};
