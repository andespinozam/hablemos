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

/**
 * Elige `count` elementos repartiendo por turnos entre los grupos de `key`, para que
 * una sesión no repita siempre la misma categoría. Dentro de cada grupo, al azar.
 */
export function spreadBy<T>(items: readonly T[], key: (item: T) => string, count: number, rng: Rng = Math.random): T[] {
  const groups = new Map<string, T[]>();
  for (const item of shuffle(items, rng)) {
    const g = groups.get(key(item)) ?? [];
    g.push(item);
    groups.set(key(item), g);
  }
  const lists = shuffle([...groups.values()], rng);
  const out: T[] = [];
  for (let i = 0; out.length < count && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (i < l.length && out.length < count) out.push(l[i]);
  }
  return out;
}

/** Generador pseudoaleatorio con semilla (mulberry32): para pruebas reproducibles. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], rng: Rng = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}
