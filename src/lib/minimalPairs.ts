/**
 * Pares mínimos: dos dibujos, se dice una palabra y el niño elige. Se prefieren los pares cuyos
 * sonidos coinciden con la sustitución registrada (el niño dice X en lugar de Y → pares X/Y).
 * Lógica pura: el azar se recibe como parámetro.
 */
import content from '../content/minimal-pairs.json';
import { getPhoneme } from './phonemes';
import { shuffle, type Rng } from './random';

export interface PairWord {
  word: string;
  syllables: string[];
  emoji: string;
  /** Id del fonema que distingue a esta palabra. */
  sound: string;
}

export interface MinimalPair {
  id: string;
  contrast: string;
  /** Ids de fonema (de `phonemes.json`) que se contrastan. */
  sounds: [string, string];
  a: PairWord;
  b: PairWord;
}

export const MINIMAL_PAIRS = content.pairs as MinimalPair[];

/** La r suave casi no tiene pares dibujables: se trabaja con los de l/rr. */
export function soundFamily(sound: string): string {
  return sound === 'r' ? 'rr' : sound;
}

export interface PairTarget {
  /** Sonido que se está trabajando. */
  phonemeId: string;
  /** Lo que el niño dice en su lugar, si se registró. */
  substitution?: string;
}

/** 1 = coincide el sonido y la sustitución; 2 = coincide el sonido; 3 = ninguno. */
export function pairTier(pair: MinimalPair, targets: readonly PairTarget[]): 1 | 2 | 3 {
  const fam = new Set(pair.sounds.map(soundFamily));
  let tier: 1 | 2 | 3 = 3;
  for (const t of targets) {
    if (!fam.has(soundFamily(t.phonemeId))) continue;
    if (t.substitution && fam.has(soundFamily(t.substitution))) return 1;
    tier = 2;
  }
  return tier;
}

/** ¿Los dos sonidos del par son de la edad (o menores)? */
function suitsAge(pair: MinimalPair, age: number): boolean {
  return pair.sounds.every((s) => {
    const p = getPhoneme(s);
    return p ? p.age <= age : true;
  });
}

export interface PairItemSpec {
  pair: MinimalPair;
  /** Palabra que se dice (la que el niño debe señalar). */
  target: 'a' | 'b';
}

/**
 * Elige hasta `count` ejercicios: primero los pares que coinciden con la sustitución, luego los del
 * sonido trabajado y al final los de la edad. Un par no se repite mientras haya otros;
 * si faltan, se usa la otra palabra del mismo par.
 */
export function selectPairItems(
  targets: readonly PairTarget[],
  age: number,
  count: number,
  rng: Rng,
  pairs: readonly MinimalPair[] = MINIMAL_PAIRS,
): PairItemSpec[] {
  const tiered = shuffle(pairs, rng)
    .map((pair) => ({ pair, tier: pairTier(pair, targets), fits: suitsAge(pair, age) }))
    // Dentro del mismo nivel, primero los de la edad.
    .sort((x, y) => x.tier - y.tier || Number(y.fits) - Number(x.fits));
  // Se usa primero el mejor nivel (ambas palabras de cada par) y después el resto.
  const best = tiered.length > 0 ? tiered[0].tier : 3;
  const pool = tiered.filter((t) => t.tier === best && (best < 3 || t.fits || tiered.every((x) => !x.fits)));
  const chosen = (pool.length > 0 ? pool : tiered).map((t) => t.pair);
  const rest = tiered.map((t) => t.pair).filter((p) => !chosen.includes(p));
  const side = (): 'a' | 'b' => (rng() < 0.5 ? 'a' : 'b');
  const first: PairItemSpec[] = chosen.map((pair) => ({ pair, target: side() }));
  const second: PairItemSpec[] = first.map((x) => ({ pair: x.pair, target: x.target === 'a' ? 'b' : 'a' }));
  const extra: PairItemSpec[] = rest.map((pair) => ({ pair, target: side() }));
  return [...first, ...second, ...extra].slice(0, count);
}
