import {
  eligiblePhonemes,
  markWord,
  pickPhonemes,
  pickWords,
  type Phoneme,
  type PhonemeWord,
  type Position,
  type Segment,
} from '../lib/phonemes';
import { SLOW_RATE } from '../lib/speech';
import type { Activity, BuildContext, Item, ItemViewProps } from './types';

export const POSITION_LABEL: Record<Position, string> = {
  inicio: 'al inicio',
  medio: 'en medio',
  final: 'al final',
  palabra: 'en la palabra',
};

/** Fonemas que se trabajan en una sesión y palabras de cada uno. */
const PHONEMES_PER_SESSION = 2;

interface WordData {
  emoji: string;
  syllables: string[];
  segments: Segment[];
}

/** El niño mira el dibujo y dice la palabra; el adulto califica. Se resalta el sonido objetivo. */
function PhonemeWordView({ item, say }: ItemViewProps) {
  const data = item.data as unknown as WordData;
  return (
    <div className="item-center">
      <div className="item-emoji" role="img" aria-label="Dibujo de la palabra">
        {data.emoji}
      </div>
      <p className="item-text word">
        {data.segments.map((s, i) => (
          <span key={i} className={s.hit ? 'word__hit' : undefined}>
            {s.text}
          </span>
        ))}
      </p>
      <ol className="dots" aria-label={`${data.syllables.length} sílabas`}>
        {data.syllables.map((syl, i) => (
          <li key={i} className="dot dot--done" title={syl} />
        ))}
      </ol>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => say(data.syllables.join(', '), SLOW_RATE)}>
        👂 Escucha por partes
      </button>
    </div>
  );
}

/** Un ítem de palabra para un fonema (lo usan la actividad y la evaluación). */
export function phonemeItem(ph: Phoneme, w: PhonemeWord): Item {
  const data: WordData = { emoji: w.emoji, syllables: w.syllables, segments: markWord(w.word, ph.patterns) };
  return {
    id: `${ph.id}-${w.word}`,
    target: ph.kind === 'syllables' ? `${w.syllables.join('-')} (${ph.name})` : `${w.word} · ${ph.name} ${POSITION_LABEL[w.position]}`,
    prompt: `Mira. Dilo conmigo: ${w.word}.`,
    model: w.word,
    phoneme: ph.id,
    area: 'fonemas',
    data: data as unknown as Record<string, unknown>,
  };
}

/** Actividad 10: Palabras con fonema objetivo (inicio / medio / final), con listas por fonema. */
export const phonemeWords: Activity = {
  id: 'palabras-fonema',
  title: 'Palabras con sonidos',
  icon: '🔤',
  area: 'fonemas',
  minAge: 3,
  maxLevel: 2,
  intro: 'Vamos a decir palabras. Escucha bien el sonido.',
  adultRated: true,
  itemCount: 4,
  buildItems(level, count, rng, ctx?: BuildContext): Item[] {
    const age = ctx?.age ?? 3;
    const stats = ctx?.phonemes ?? {};
    const chosen = pickPhonemes(eligiblePhonemes(age, level, stats), stats, Math.min(PHONEMES_PER_SESSION, count), rng);
    const perPhoneme = Math.ceil(count / chosen.length);
    const lists = chosen.map((ph) => ({ ph, words: pickWords(ph, level, perPhoneme, rng) }));

    // Se alternan los fonemas: p1, p2, p1, p2...
    const items: Item[] = [];
    for (let i = 0; i < perPhoneme && items.length < count; i++) {
      for (const { ph, words } of lists) {
        const w = words[i];
        if (!w || items.length >= count) continue;
        items.push(phonemeItem(ph, w));
      }
    }
    return items;
  },
  ItemView: PhonemeWordView,
};
