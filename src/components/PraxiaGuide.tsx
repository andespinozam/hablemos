export type GuideKind =
  | 'candle'
  | 'pinwheel'
  | 'lips-o'
  | 'lips-i'
  | 'kiss'
  | 'tongue-out'
  | 'tongue-up'
  | 'tongue-down'
  | 'tongue-side'
  | 'lips-oi';

export const GUIDE_KINDS: readonly GuideKind[] = [
  'candle',
  'pinwheel',
  'lips-o',
  'lips-i',
  'kiss',
  'tongue-out',
  'tongue-up',
  'tongue-down',
  'tongue-side',
  'lips-oi',
];

const LIP = '#d6455d';
const INSIDE = '#7a1f2b';
const TONGUE = '#ff7f90';

const hasProp = (g: GuideKind) => g === 'candle' || g === 'pinwheel';

function Mouth({ guide }: { guide: GuideKind }) {
  switch (guide) {
    case 'candle':
    case 'lips-o':
      return <ellipse className="g-pulse" cx={100} cy={140} rx={13} ry={16} fill={INSIDE} stroke={LIP} strokeWidth={8} />;
    case 'pinwheel':
      return <ellipse className="g-pulse" cx={100} cy={140} rx={11} ry={13} fill={INSIDE} stroke={LIP} strokeWidth={8} />;
    case 'lips-i':
      return (
        <g className="g-smile">
          <rect x={64} y={132} width={72} height={20} rx={10} fill="#fff" stroke={LIP} strokeWidth={6} />
          <line x1={100} y1={133} x2={100} y2={151} stroke={LIP} strokeWidth={2} />
        </g>
      );
    case 'kiss':
      return (
        <g className="g-pulse">
          <ellipse cx={100} cy={141} rx={11} ry={9} fill={LIP} />
          <path d="M92 138q8-7 16 0" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case 'lips-oi':
      return (
        <g>
          <ellipse className="g-show-o" cx={100} cy={140} rx={13} ry={16} fill={INSIDE} stroke={LIP} strokeWidth={8} />
          <g className="g-show-i">
            <rect x={64} y={132} width={72} height={20} rx={10} fill="#fff" stroke={LIP} strokeWidth={6} />
            <line x1={100} y1={133} x2={100} y2={151} stroke={LIP} strokeWidth={2} />
          </g>
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx={100} cy={140} rx={26} ry={12} fill={INSIDE} stroke={LIP} strokeWidth={6} />
          {guide === 'tongue-out' && <rect className="g-out" x={88} y={140} width={24} height={34} rx={12} fill={TONGUE} stroke={LIP} strokeWidth={3} />}
          {guide === 'tongue-up' && <rect className="g-up" x={88} y={96} width={24} height={46} rx={12} fill={TONGUE} stroke={LIP} strokeWidth={3} />}
          {guide === 'tongue-down' && <rect className="g-down" x={88} y={140} width={24} height={48} rx={12} fill={TONGUE} stroke={LIP} strokeWidth={3} />}
          {guide === 'tongue-side' && <rect className="g-side" x={100} y={132} width={52} height={22} rx={11} fill={TONGUE} stroke={LIP} strokeWidth={3} />}
        </g>
      );
  }
}

function Prop({ guide }: { guide: GuideKind }) {
  if (guide === 'candle') {
    return (
      <g>
        <rect x={228} y={122} width={26} height={64} rx={4} fill="#ffe9b0" stroke="#c98a4b" strokeWidth={3} />
        <path className="g-flame" d="M241 92c10 12 12 20 0 28-12-8-10-16 0-28z" fill="#ffa62b" stroke="#e8503a" strokeWidth={3} />
        <g className="g-breath" fill="none" stroke="#7aa7ff" strokeWidth={4} strokeLinecap="round">
          <path d="M126 134q40-6 78-2" />
          <path d="M126 144q40 2 78 6" />
        </g>
      </g>
    );
  }
  return (
    <g>
      <line x1={240} y1={110} x2={240} y2={190} stroke="#a76a30" strokeWidth={5} strokeLinecap="round" />
      <g className="g-spin">
        <path d="M240 110L240 72 270 86z" fill="#ff6b6b" />
        <path d="M240 110L278 110 264 140z" fill="#ffd23f" />
        <path d="M240 110L240 148 210 134z" fill="#4dc3ff" />
        <path d="M240 110L202 110 216 80z" fill="#7bd88f" />
        <circle cx={240} cy={110} r={5} fill="#1b2a4a" />
      </g>
      <g className="g-breath" fill="none" stroke="#7aa7ff" strokeWidth={4} strokeLinecap="round">
        <path d="M122 136q40-14 80-20" />
        <path d="M122 146q40-4 80-10" />
      </g>
    </g>
  );
}

interface Props {
  guide: GuideKind;
  /** true mientras se cuenta: la guía se mueve. */
  active: boolean;
}

/** Guía animada (SVG original) del movimiento que el niño debe imitar. */
export function PraxiaGuide({ guide, active }: Props) {
  const withProp = hasProp(guide);
  return (
    <svg
      className={`guide guide--${guide}${active ? ' guide--active' : ''}`}
      viewBox={withProp ? '0 0 300 200' : '0 0 200 200'}
      role="img"
      aria-label="Dibujo que muestra el movimiento"
    >
      <circle cx={100} cy={100} r={82} fill="#ffd9a0" stroke="#c98a4b" strokeWidth={5} />
      <circle cx={70} cy={82} r={7} fill="#1b2a4a" />
      <circle cx={130} cy={82} r={7} fill="#1b2a4a" />
      <ellipse cx={54} cy={110} rx={10} ry={6} fill="#ff9d94" opacity={0.7} />
      <ellipse cx={146} cy={110} rx={10} ry={6} fill="#ff9d94" opacity={0.7} />
      <path d="M95 102q5 7 10 0" fill="none" stroke="#c98a4b" strokeWidth={3} strokeLinecap="round" />
      <Mouth guide={guide} />
      {guide === 'kiss' && (
        <text className="g-heart" x={150} y={96} fontSize={34}>
          ❤️
        </text>
      )}
      {guide === 'tongue-up' && (
        <text x={146} y={70} fontSize={30}>
          ⬆️
        </text>
      )}
      {guide === 'tongue-down' && (
        <text x={146} y={190} fontSize={30}>
          ⬇️
        </text>
      )}
      {guide === 'tongue-side' && (
        <text x={146} y={190} fontSize={30}>
          ↔️
        </text>
      )}
      {withProp && <Prop guide={guide} />}
    </svg>
  );
}
