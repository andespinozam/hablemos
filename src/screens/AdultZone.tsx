import { useState } from 'react';
import { formatAge } from '../lib/age';
import type { ChildProfile } from '../lib/db';
import { deleteProfile } from '../lib/profiles';
import { go } from '../lib/router';

interface Props {
  profiles: ChildProfile[];
  loadError: boolean;
  onChanged: () => Promise<void>;
  onExit: () => void;
}

export const DISCLAIMER =
  'Esta herramienta apoya la estimulación en casa y no reemplaza la valoración de un fonoaudiólogo.';

export function AdultZone({ profiles, loadError, onChanged, onExit }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const today = new Date();

  const remove = async (id: string) => {
    try {
      await deleteProfile(id);
      setConfirmId(null);
      await onChanged();
    } catch {
      setError('No se pudo eliminar el perfil. Inténtalo de nuevo.');
    }
  };

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Zona de adultos</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          🚪 Salir
        </button>
      </header>

      <p className="note" role="note">
        {DISCLAIMER}
      </p>

      {loadError && (
        <p className="error-text" role="alert">
          No se pudo abrir el almacenamiento del dispositivo. Revisa que el navegador permita guardar datos
          y que no estés en modo privado.
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <section aria-labelledby="profiles-title">
        <div className="row">
          <h2 id="profiles-title" style={{ margin: 0 }}>
            Perfiles de niños
          </h2>
          <span className="spacer" />
          <button type="button" className="btn btn--good" onClick={() => go('adultos/nuevo')}>
            ➕ Agregar niño
          </button>
        </div>

        {profiles.length === 0 ? (
          <p style={{ marginTop: 16 }}>Aún no hay perfiles. Agrega al primer niño para empezar.</p>
        ) : (
          <ul className="list" style={{ marginTop: 16 }}>
            {profiles.map((p) => (
              <li key={p.id} className="list-item">
                <span className="avatar avatar--small" aria-hidden="true">
                  {p.avatar}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <br />
                  <small>{formatAge(p.birthDate, today)}</small>
                </span>
                <span className="spacer" />
                {confirmId === p.id ? (
                  <>
                    <span role="alert">¿Eliminar a {p.name}?</span>
                    <button type="button" className="btn btn--danger btn--small" onClick={() => void remove(p.id)}>
                      Sí, eliminar
                    </button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmId(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => go(`adultos/editar/${p.id}`)}
                      aria-label={`Editar a ${p.name}`}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => setConfirmId(p.id)}
                      aria-label={`Eliminar a ${p.name}`}
                    >
                      🗑️ Eliminar
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="note">
        Los datos se guardan solo en este dispositivo. La app no usa cuentas, anuncios ni conexión a internet.
        Próximamente: evaluación, seguimiento, reportes y respaldo.
      </p>
    </main>
  );
}
