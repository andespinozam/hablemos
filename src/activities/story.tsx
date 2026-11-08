import { useState } from 'react';
import { ChoiceBoard, type ChoiceOption } from '../components/ChoiceBoard';
import content from '../content/stories.json';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export type QuestionKind = 'quien' | 'que' | 'donde';
export const KIND_LABEL: Record<QuestionKind, string> = { quien: 'quién', que: 'qué', donde: 'dónde' };

export interface StoryPage {
  text: string;
  scene: string;
}
export interface StoryOption {
  id: string;
  label: string;
  emoji: string;
}
export interface StoryQuestion {
  kind: QuestionKind;
  prompt: string;
  correct: string;
  options: StoryOption[];
}
export interface Story {
  id: string;
  level: number;
  title: string;
  pages: StoryPage[];
  questions: StoryQuestion[];
}

export const STORIES = content.stories as unknown as Story[];
const QUESTIONS_PER_STORY = 3;

interface StoryData {
  options: StoryOption[];
  correct: string;
  /** Solo en la primera pregunta de cada cuento: las páginas que se cuentan antes. */
  pages?: StoryPage[];
  /** Escena final del cuento, como recordatorio junto a la pregunta. */
  scene: string;
}

function StoryView({ item, say, submit }: ItemViewProps) {
  const data = item.data as unknown as StoryData;
  const pages = data.pages;
  const [page, setPage] = useState(0);
  const reading = pages !== undefined && page < pages.length;

  if (reading) {
    const current = pages[page];
    const isLast = page === pages.length - 1;
    const next = () => {
      if (isLast) say(item.prompt);
      else say(pages[page + 1].text);
      setPage(page + 1);
    };
    // La primera página la dice el motor al abrir el ítem (item.prompt = su texto).
    return (
      <div className="item-center">
        <div className="item-emoji item-emoji--scene" role="img" aria-label={current.text}>
          {current.scene}
        </div>
        <p className="item-text item-text--sm">{current.text}</p>
        <button type="button" className="btn btn--good btn--big" onClick={next}>
          ▶ Sigue
        </button>
      </div>
    );
  }

  const options: ChoiceOption[] = data.options.map((o) => ({
    id: o.id,
    label: o.label,
    content: <span className="choice__emoji">{o.emoji}</span>,
  }));
  return (
    <div className="item-center">
      <div className="story-recap" aria-hidden="true">
        {data.scene}
      </div>
      <ChoiceBoard options={options} correctId={data.correct} prompt={questionPrompt(item)} say={say} submit={submit} />
    </div>
  );
}

/** El `prompt` de la primera pregunta es la 1.ª página; la pregunta real va guardada en `target`/`data`. */
function questionPrompt(item: Item): string {
  return String((item.data as Record<string, unknown>).question ?? item.prompt);
}

/** Actividad 4: Mini cuento ilustrado con preguntas qué / quién / dónde. */
export const story: Activity = {
  id: 'mini-cuento',
  title: 'Mini cuento',
  icon: '📖',
  area: 'narrativa',
  minAge: 3,
  maxLevel: 2,
  intro: 'Te voy a contar un cuento. Escucha con atención.',
  adultRated: false,
  itemCount: QUESTIONS_PER_STORY * 2, // dos cuentos por sesión
  buildItems(level, count, rng): Item[] {
    const stories = Math.max(1, Math.floor(count / QUESTIONS_PER_STORY));
    const chosen = [
      ...shuffle(STORIES.filter((s) => s.level === level), rng),
      ...shuffle(STORIES.filter((s) => s.level !== level && s.level < level), rng),
      ...shuffle(STORIES.filter((s) => s.level > level), rng),
    ].slice(0, stories);

    return chosen.flatMap((s) =>
      s.questions.map((q, i): Item => {
        const first = i === 0;
        const data = {
          options: shuffle(q.options, rng),
          correct: q.correct,
          pages: first ? s.pages : undefined,
          scene: s.pages[s.pages.length - 1].scene,
          question: q.prompt,
        };
        return {
          id: `${s.id}-${q.kind}`,
          target: `${s.title}: ${KIND_LABEL[q.kind]}`,
          // La primera pregunta abre contando el cuento: el motor dice la 1.ª página.
          prompt: first ? s.pages[0].text : q.prompt,
          area: 'narrativa',
          data: data as unknown as Record<string, unknown>,
        };
      }),
    );
  },
  ItemView: StoryView,
};
