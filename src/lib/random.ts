export type Rng = () => number;

/** Mezcla Fisher-Yates sin modificar el original. `rng` devuelve [0, 1). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}
