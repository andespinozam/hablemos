import { ChoiceBoard, type ChoiceOption } from '../components/ChoiceBoard';
import { ConceptVisual, type VisualOption } from '../components/Visuals';
import content from '../content/concepts.json';
import { shuffle, type Rng } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

export interface ConceptItem {
  id: string;
  level: number;
  concept: string;
  prompt: string;
  target: string;
  correct: string;
  options: (VisualOption & { id: string; label: string })[];
}

export const CONCEPT_ITEMS = content.items as unknown as ConceptItem[];

function ConceptView({ item, say, submit }: ItemViewProps) {
  const data = item.data as unknown as { options: ConceptItem['options']; correct: string };
  const options: ChoiceOption[] = data.options.map((o) => ({
    id: o.id,
    label: o.label,
    content: <ConceptVisual option={o} />,
    className: o.scene ? 'choice--scene' : undefined,
  }));
  return <ChoiceBoard options={options} correctId={data.correct} prompt={item.prompt} say={say} submit={submit} />;
}

/** Reparte por turnos entre conceptos para que una sesión no repita el mismo. */
function interleave(items: ConceptItem[], rng: Rng): ConceptItem[] {
  const groups = new Map<string, ConceptItem[]>();
  for (const it of shuffle(items, rng)) {
    const g = groups.get(it.concept) ?? [];
    g.push(it);
    groups.set(it.concept, g);
  }
  const lists = shuffle([...groups.values()], rng);
  const out: ConceptItem[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

/** Actividad 3: Conceptos (grande/pequeño, uno/muchos, dentro/fuera, arriba/abajo). */
export const concepts: Activity = {
  id: 'conceptos',
  title: 'Conceptos',
  icon: '🔍',
  area: 'conceptos',
  minAge: 3,
  maxLevel: 2,
  intro: 'Mira bien los dibujos y toca el correcto.',
  adultRated: false,
  buildItems(level, count, rng): Item[] {
    // Primero los del nivel; si faltan, se completa con los de niveles menores.
    const exact = interleave(
      CONCEPT_ITEMS.filter((c) => c.level === level),
      rng,
    );
    const lower = interleave(
      CONCEPT_ITEMS.filter((c) => c.level < level),
      rng,
    );
    return [...exact, ...lower].slice(0, count).map((c) => ({
      id: c.id,
      target: c.target,
      prompt: c.prompt,
      data: { options: shuffle(c.options, rng), correct: c.correct },
    }));
  },
  ItemView: ConceptView,
};
