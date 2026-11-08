const STAR_PATH = 'M50 6l13.2 28.6 31.1 3.5-23.2 21.2 6.5 30.8L50 74.4 22.4 90.1l6.5-30.8L5.7 38.1l31.1-3.5z';

/** Estrella SVG original. */
export function Star({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={STAR_PATH} fill="#ffb703" stroke="#e08e00" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

import { PRAISES } from '../lib/phrases';

export function randomPraise(rng: () => number = Math.random): string {
  return PRAISES[Math.floor(rng() * PRAISES.length)];
}

/** Estrellas que aparecen suavemente (sin movimiento si el sistema pide menos animación). */
export function StarBurst({ text }: { text: string }) {
  return (
    <div className="burst" role="status" aria-live="polite">
      <div className="burst__stars" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <Star key={i} size={i === 1 ? 128 : 88} className={`burst__star burst__star--${i}`} />
        ))}
      </div>
      <p className="burst__text">{text}</p>
    </div>
  );
}
