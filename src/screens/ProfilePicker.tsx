import type { ChildProfile } from '../lib/db';

interface Props {
  profiles: ChildProfile[];
  onPick: (id: string) => void;
  onAdults: () => void;
}

export function ProfilePicker({ profiles, onPick, onAdults }: Props) {
  return (
    <main className="screen">
      {profiles.length === 0 ? (
        <div className="screen screen--center" style={{ flex: 1 }}>
          <p className="avatar bob" aria-hidden="true">
            🗣️
          </p>
          <h1>¡Hola! Soy Hablemos</h1>
          <p>Un adulto debe crear primero el perfil del niño.</p>
          <button type="button" className="btn btn--accent" onClick={onAdults}>
            🔒 Soy adulto
          </button>
        </div>
      ) : (
        <>
          <h1>¿Quién juega hoy?</h1>
          <ul className="profile-grid play-zone" aria-label="Niños">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="btn btn--ghost profile-tile"
                  onClick={() => onPick(p.id)}
                  aria-label={`Jugar como ${p.name}`}
                >
                  <span className="avatar" aria-hidden="true">
                    {p.avatar}
                  </span>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          <div className="spacer" />
          <div className="row">
            <span className="spacer" />
            <button type="button" className="btn btn--ghost btn--small" onClick={onAdults}>
              🔒 Zona de adultos
            </button>
          </div>
        </>
      )}
    </main>
  );
}
