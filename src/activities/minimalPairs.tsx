import { ChoiceBoard, type ChoiceOption } from '../components/ChoiceBoard';
import { listenAgain } from '../lib/phrases';
import { selectPairItems, type PairTarget } from '../lib/minimalPairs';
import { shuffle } from '../lib/random';
import type { Activity, Item, ItemViewProps } from './types';

interface PairItemData {
  /** Opciones en el orden en que se muestran. */
  options: { id: 'a' | 'b'; word: string; emoji: string }[];
  correct: 'a' | 'b';
}

function MinimalPairView({ item, say, submit }: ItemViewProps) {
  const data = item.data as unknown as PairItemData;
  const options: ChoiceOption[] = data.options.map((o) => ({
    id: o.id,
    label: o.word,
    content: <span className="choice__emoji">{o.emoji}</span>,
  }));
  return (
    <ChoiceBoard
      options={options}
      correctId={data.correct}
      prompt={item.prompt}
      retrySay={listenAgain(item.model ?? item.target)}
      say={say}
      submit={submit}
    />
  );
}

/**
 * Actividad 12 (Fase 10): pares mínimos. Dos dibujos, se dice una palabra y el niño elige.
 * Califica sola y nunca produce "Aún no". Usa los pares cuyos sonidos coinciden con la sustitución
 * registrada en la escalera del niño; sin ella, pares de los sonidos de su edad.
 */
export const minimalPairs: Activity = {
  id: 'pares-minimos',
  title: 'Dos dibujos',
  icon: '👯',
  area: 'discriminacion',
  minAge: 3,
  maxLevel: 1,
  intro: 'Escucha la palabra y toca el dibujo correcto.',
  adultRated: false,
  buildItems(_level, count, rng, ctx): Item[] {
    const targets: PairTarget[] = (ctx?.ladders ?? [])
      .filter((l) => l.state !== 'done')
      .map((l) => ({ phonemeId: l.phonemeId, substitution: l.substitution }));
    const specs = selectPairItems(targets, ctx?.age ?? 3, count, rng);
    return specs.map(({ pair, target }): Item => {
      const word = pair[target];
      const order = shuffle<'a' | 'b'>(['a', 'b'], rng);
      const data: PairItemData = {
        options: order.map((id) => ({ id, word: pair[id].word, emoji: pair[id].emoji })),
        correct: target,
      };
      return {
        id: `${pair.id}:${target}`,
        target: `${word.word} (${pair.contrast})`,
        prompt: `Toca ${word.word}.`,
        model: word.word,
        data: data as unknown as Record<string, unknown>,
      };
    });
  },
  ItemView: MinimalPairView,
};
