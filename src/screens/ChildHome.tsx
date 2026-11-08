import type { ChildProfile } from '../lib/db';
import { unlockAudio } from '../lib/sounds';

interface Props {
  profile: ChildProfile;
  onPlay: () => void;
  onExit: () => void;
}

/** Inicio del niño: un solo botón grande para jugar. */
export function ChildHome({ profile, onPlay, onExit }: Props) {
  return (
    <main className="screen screen--center play-zone">
      <p className="avatar avatar--huge bob" aria-hidden="true">
        {profile.avatar}
      </p>
      <h1>¡Hola, {profile.name}!</h1>
      <button
        type="button"
        className="btn btn--good btn--big"
        onClick={() => {
          unlockAudio(); // el audio solo puede iniciar dentro de un toque
          onPlay();
        }}
      >
        ▶ Jugar
      </button>
      <button type="button" className="btn btn--ghost btn--small" onClick={onExit}>
        ⬅️ Cambiar de niño
      </button>
    </main>
  );
}
