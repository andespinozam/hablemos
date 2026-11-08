export type Scene = 'in' | 'out' | 'above' | 'below';
export const SCENES: readonly Scene[] = ['in', 'out', 'above', 'below'];

/** Dibujo SVG original: un objeto y una caja en distintas posiciones. */
export function SceneSvg({ emoji, scene }: { emoji: string; scene: Scene }) {
  const box = (x: number, y: number, w: number, h: number) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#c98a4b" stroke="#7a4a1d" strokeWidth={4} />
      <rect x={x - 4} y={y} width={w + 8} height={10} rx={4} fill="#a76a30" stroke="#7a4a1d" strokeWidth={4} />
    </g>
  );
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      {scene === 'in' && (
        <>
          <text x={60} y={78} fontSize={60} textAnchor="middle">
            {emoji}
          </text>
          {box(18, 64, 84, 46)}
        </>
      )}
      {scene === 'out' && (
        <>
          {box(6, 64, 56, 46)}
          <text x={94} y={106} fontSize={52} textAnchor="middle">
            {emoji}
          </text>
        </>
      )}
      {scene === 'above' && (
        <>
          <text x={60} y={54} fontSize={52} textAnchor="middle">
            {emoji}
          </text>
          {box(32, 68, 56, 42)}
        </>
      )}
      {scene === 'below' && (
        <>
          {box(32, 6, 56, 38)}
          <text x={60} y={106} fontSize={52} textAnchor="middle">
            {emoji}
          </text>
        </>
      )}
    </svg>
  );
}

export interface VisualOption {
  emoji?: string;
  size?: 'big' | 'small';
  count?: number;
  scene?: Scene;
}

/** Dibuja una opción de concepto: tamaño, cantidad o posición. */
export function ConceptVisual({ option }: { option: VisualOption }) {
  const emoji = option.emoji ?? '';
  if (option.scene) {
    return (
      <span className="visual visual--scene">
        <SceneSvg emoji={emoji} scene={option.scene} />
      </span>
    );
  }
  const count = option.count ?? 1;
  return (
    <span className={`visual visual--${option.size ?? 'mid'}${count > 1 ? ' visual--many' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>{emoji}</span>
      ))}
    </span>
  );
}
