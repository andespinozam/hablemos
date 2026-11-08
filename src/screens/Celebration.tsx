import { Star } from '../components/Stars';
import type { ChildProfile } from '../lib/db';

interface Props {
  profile: ChildProfile;
  /** Una estrella por cada ejercicio completado: nunca se pierden. */
  stars: number;
  onExit: () => void;
}

const MAX_SHOWN = 16;

export function Celebration({ profile, stars, onExit }: Props) {
  return (
    <main className="screen screen--center play-zone celebration">
      <p className="avatar avatar--huge bob" aria-hidden="true">
        {profile.avatar}
      </p>
      <h1>¡Lo lograste, {profile.name}!</h1>
      <p className="sr-only">Ganaste {stars} estrellas.</p>
      <div className="star-row" aria-hidden="true">
        {Array.from({ length: Math.min(stars, MAX_SHOWN) }, (_, i) => (
          <span key={i} className="star-pop" style={{ animationDelay: `${i * 0.08}s`, display: 'inline-flex' }}>
            <Star size={64} />
          </span>
        ))}
      </div>
      <button type="button" className="btn btn--good btn--big" onClick={onExit}>
        🏠 Terminar
      </button>
    </main>
  );
}
