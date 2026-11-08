import type { Mouth } from '../lib/ladder';

const LIP = '#d6455d';
const INSIDE = '#7a1f2b';
const TONGUE = '#ff7f90';
const TEETH = '#ffffff';
const SKIN = '#ffe3c2';
const AIR = '#2f6fed';

/** Lengua vista de lado. La boca queda a la izquierda; la garganta, a la derecha. */
const TONGUE_PATH: Record<Mouth['tongue'], string> = {
  rest: 'M16 108 Q40 92 80 92 Q125 92 148 104 L148 112 Q70 118 16 112 Z',
  'tip-teeth': 'M148 106 Q120 96 90 90 Q52 82 30 64 Q24 58 22 54 Q16 64 18 78 Q20 94 22 112 L148 112 Z',
  'tip-up': 'M148 106 Q118 94 88 86 Q58 76 42 56 Q38 50 40 44 Q28 54 26 70 Q24 92 24 112 L148 112 Z',
  'tip-down': 'M148 106 Q110 90 70 84 Q40 82 26 98 Q22 106 22 112 L148 112 Z',
  mid: 'M16 108 Q40 96 70 88 Q100 52 130 62 Q148 70 148 104 L148 112 Q70 118 16 112 Z',
  back: 'M16 108 Q60 98 90 96 Q112 90 128 54 Q146 50 148 80 L148 112 Q70 118 16 112 Z',
  tap: 'M148 106 Q118 94 88 86 Q58 76 42 56 Q38 50 40 44 Q28 54 26 70 Q24 92 24 112 L148 112 Z',
};

function Lips({ lips }: { lips: Mouth['lips'] }) {
  switch (lips) {
    case 'closed':
      return (
        <g>
          <path d="M24 76 Q60 90 96 76" fill="none" stroke={LIP} strokeWidth={12} strokeLinecap="round" />
          <path d="M28 76 Q60 80 92 76" fill="none" stroke={INSIDE} strokeWidth={2} />
        </g>
      );
    case 'open':
      return (
        <g>
          <ellipse cx={60} cy={76} rx={30} ry={20} fill={INSIDE} stroke={LIP} strokeWidth={8} />
          <rect x={40} y={60} width={40} height={8} rx={3} fill={TEETH} />
          <ellipse cx={60} cy={88} rx={16} ry={6} fill={TONGUE} />
        </g>
      );
    case 'smile':
      return (
        <g>
          <rect x={20} y={64} width={80} height={24} rx={12} fill={TEETH} stroke={LIP} strokeWidth={7} />
          <line x1={24} y1={76} x2={96} y2={76} stroke={LIP} strokeWidth={2} />
        </g>
      );
    case 'round':
      return <ellipse cx={60} cy={76} rx={14} ry={17} fill={INSIDE} stroke={LIP} strokeWidth={9} />;
    case 'teeth':
      return (
        <g>
          <path d="M28 72 Q60 100 92 72 Q60 92 28 72 Z" fill={LIP} stroke={LIP} strokeWidth={8} strokeLinejoin="round" />
          <rect x={38} y={62} width={44} height={14} rx={4} fill={TEETH} stroke={LIP} strokeWidth={3} />
        </g>
      );
  }
}

function Air({ air }: { air: Mouth['air'] }) {
  if (air === 'none') return null;
  if (air === 'nose') {
    return (
      <g className="mg-air" fill="none" stroke={AIR} strokeWidth={4} strokeLinecap="round">
        <path d="M70 26 q-4 -12 4 -18" />
        <path d="M84 24 q-4 -12 4 -18" />
      </g>
    );
  }
  if (air === 'burst') {
    return (
      <g className="mg-burst" fill="none" stroke={AIR} strokeWidth={4} strokeLinecap="round">
        <path d="M6 62 l-8 -8" />
        <path d="M4 76 l-10 0" />
        <path d="M6 90 l-8 8" />
      </g>
    );
  }
  return (
    <g className="mg-air" fill="none" stroke={AIR} strokeWidth={4} strokeLinecap="round">
      <path d="M8 66 q-10 -2 -14 -8 q-4 -6 -12 -6" strokeDasharray="6 5" />
      <path d="M8 76 q-12 0 -20 0 q-8 0 -14 0" strokeDasharray="6 5" />
      <path d="M8 86 q-10 2 -14 8 q-4 6 -12 6" strokeDasharray="6 5" />
    </g>
  );
}

interface Props {
  mouth: Mouth;
  /** Texto accesible: qué hace la boca. */
  label: string;
  /** Con movimiento (se detiene con `prefers-reduced-motion`). */
  active?: boolean;
  /** Tamaño reducido para pantallas con poco espacio. */
  small?: boolean;
}

/**
 * Animación original de la boca: de frente (labios) y de lado (lengua), con el aire y la voz.
 * Es una guía; la app no evalúa el movimiento.
 */
export function MouthGuide({ mouth, label, active = false, small = false }: Props) {
  return (
    <svg
      className={`mouth-guide mouth-guide--${mouth.tongue}${active ? ' mouth-guide--active' : ''}${small ? ' mouth-guide--small' : ''}`}
      viewBox="-30 -10 360 150"
      role="img"
      aria-label={label}
    >
      <rect x={-28} y={-8} width={356} height={146} rx={22} fill={SKIN} />
      {/* De frente */}
      <g className="mg-front">
        <g className="mg-lips">
          <Lips lips={mouth.lips} />
        </g>
      </g>
      {/* De lado */}
      <g transform="translate(150 0)">
        <path d="M8 30 Q70 8 150 38 L150 112 Q70 122 8 114 Z" fill={INSIDE} />
        <path d="M8 30 Q70 8 150 38" fill="none" stroke="#b07a52" strokeWidth={5} strokeLinecap="round" />
        <rect x={4} y={30} width={12} height={24} rx={4} fill={TEETH} stroke="#c9b9a6" strokeWidth={1.5} />
        <rect x={4} y={92} width={12} height={22} rx={4} fill={TEETH} stroke="#c9b9a6" strokeWidth={1.5} />
        <path className="mg-tongue" d={TONGUE_PATH[mouth.tongue]} fill={TONGUE} />
        <Air air={mouth.air} />
        {mouth.voice && (
          <g className="mg-voice" fill="none" stroke={LIP} strokeWidth={3} strokeLinecap="round">
            <path d="M124 124 q6 -6 0 -12 q-6 -6 0 -12" />
            <path d="M136 126 q6 -6 0 -12 q-6 -6 0 -12" />
          </g>
        )}
      </g>
    </svg>
  );
}
