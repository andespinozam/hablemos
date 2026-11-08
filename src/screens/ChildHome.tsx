import type { ChildProfile } from '../lib/db';

interface Props {
  profile: ChildProfile;
  onExit: () => void;
}

/** Inicio del niño. Las actividades llegan en las fases siguientes. */
export function ChildHome({ profile, onExit }: Props) {
  return (
    <main className="screen screen--center play-zone">
      <p className="avatar bob" aria-hidden="true">
        {profile.avatar}
      </p>
      <h1>¡Hola, {profile.name}!</h1>
      <p>¡Muy pronto habrá juegos!</p>
      <button type="button" className="btn btn--ghost" onClick={onExit}>
        ⬅️ Volver
      </button>
    </main>
  );
}
