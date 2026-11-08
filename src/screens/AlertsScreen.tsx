import { AlertSigns } from '../components/AlertSigns';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';

export function AlertsScreen() {
  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Señales de alerta</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go('adultos')}>
          ⬅️ Volver
        </button>
      </header>
      <AlertSigns heading="Cuándo consultar a un profesional" />
      <p className="note">{DISCLAIMER}</p>
    </main>
  );
}
