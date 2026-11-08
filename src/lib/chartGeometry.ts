/** Geometría de los gráficos SVG, pura para poder probarla. */

/** Tramos consecutivos de índices con dato (los `null` cortan la línea). */
export function contiguousRuns(values: readonly (number | null)[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) runs.push(current);
      current = [];
    } else current.push(i);
  });
  if (current.length) runs.push(current);
  return runs;
}

/** Posición x de `count` puntos repartidos en [left, left + width]. Un solo punto va al centro. */
export function xPositions(count: number, left: number, width: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [left + width / 2];
  return Array.from({ length: count }, (_, i) => left + (width * i) / (count - 1));
}

/** Posición y de un valor 0..100 en un eje con 0 abajo y 100 arriba. Se acota al rango. */
export function yFor(value: number, top: number, height: number): number {
  const v = Math.min(100, Math.max(0, value));
  return top + height - (v / 100) * height;
}

/** Ancho de una barra para un valor 0..100. */
export function barWidth(value: number | null, full: number): number {
  if (value === null) return 0;
  return (Math.min(100, Math.max(0, value)) / 100) * full;
}

/** "d/m" de una fecha en ms (hora local). */
export function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Puntos "x,y" para un `polyline`. */
export function polylinePoints(xs: readonly number[], ys: readonly number[], run: readonly number[]): string {
  return run.map((i) => `${xs[i].toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
}
