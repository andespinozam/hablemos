import { useState } from 'react';
import { PronunciationResults } from '../components/PronunciationResults';
import { ReassessmentBanner } from '../components/ReassessmentBanner';
import { ageInYears } from '../lib/age';
import type { ChildProfile } from '../lib/db';
import {
  BLOCK_TARGET,
  blockProgress,
  buildPronunciationItems,
  firstPronunciation,
  pendingPronunciation,
  pronunciationStatus,
  shuffleForRepeat,
} from '../lib/pronunciation';
import { createPronunciation } from '../lib/pronunciationStore';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';
import { useChildData } from '../lib/useChildData';

export function PronunciationHome({ profile }: { profile: ChildProfile }) {
  const state = useChildData(profile.id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = () => go(`adultos/evaluacion/${profile.id}`);

  async function start(repeatOf?: ReturnType<typeof firstPronunciation>) {
    setBusy(true);
    setError(null);
    try {
      const age = ageInYears(profile.birthDate, new Date()) ?? 3;
      const items = repeatOf ? shuffleForRepeat(repeatOf.items, Math.random) : buildPronunciationItems(age, Math.random);
      const record = await createPronunciation({ profileId: profile.id, ageYears: repeatOf ? repeatOf.ageYears : age, items });
      go(`adultos/pronunciar/${profile.id}/${record.id}`);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar en el dispositivo. Revisa que el navegador permita guardar datos.');
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Pronunciación de {profile.name}</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={back}>
          ⬅️ Volver
        </button>
      </header>

      {state.status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {state.status === 'error' && (
        <p className="error-text" role="alert">
          No se pudieron leer los datos del dispositivo.
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {state.status === 'ready' &&
        (() => {
          const { pronunciation } = state.data;
          const pending = pendingPronunciation(pronunciation);
          const first = firstPronunciation(pronunciation);
          const status = pronunciationStatus(pronunciation, Date.now());
          const progress = pending ? blockProgress(pending) : null;
          return (
            <>
              {status.state !== 'none' && <ReassessmentBanner status={status} />}

              <section className="card" aria-labelledby="how-title">
                <h2 id="how-title">Cómo funciona</h2>
                <p>
                  {profile.name} nombra dibujos y tú marcas cómo dijo cada palabra. Se revisan los sonidos que corresponden a su edad,
                  una o dos metas más adelante y una mini revisión de sílabas y grupos de consonantes. Se hace en bloques de unos{' '}
                  {Math.round((BLOCK_TARGET * 25) / 60)} minutos que puedes pausar y retomar otro día.
                </p>
                <ul>
                  <li>Muéstrale el dibujo y pregunta: “¿qué es esto?”. Si no lo dice, nómbralo tú y pídele que lo repita.</li>
                  <li>Marca: correcta, sustituida (elige o escribe el sonido que dijo), omitida o distorsionada.</li>
                  <li>No corrijas durante la evaluación. La app no califica la pronunciación: solo ordena lo que tú marcas.</li>
                  <li>No cambia los niveles de las actividades ni las rachas.</li>
                </ul>

                {pending && progress ? (
                  <>
                    <p className="notice notice--info" role="note">
                      <span aria-hidden="true">⏸️</span>
                      <span>
                        Hay una evaluación a medias: {progress.answered} de {progress.total} palabras. Sigue en el bloque{' '}
                        {progress.nextBlock + 1} de {progress.blocks}.
                      </span>
                    </p>
                    <button type="button" className="btn btn--good btn--big" onClick={() => go(`adultos/pronunciar/${profile.id}/${pending.id}`)}>
                      ▶ Continuar la evaluación
                    </button>
                  </>
                ) : first ? (
                  <button type="button" className="btn btn--accent btn--big" disabled={busy} onClick={() => void start(first)}>
                    🔁 Reevaluar con las mismas palabras
                  </button>
                ) : (
                  <button type="button" className="btn btn--good btn--big" disabled={busy} onClick={() => void start()}>
                    ▶ Empezar evaluación de pronunciación
                  </button>
                )}
              </section>

              {first ? (
                <section className="card" aria-labelledby="res-title">
                  <h2 id="res-title">Resultados</h2>
                  <PronunciationResults records={pronunciation} />
                  <div className="row no-print">
                    <button type="button" className="btn btn--accent" onClick={() => go(`adultos/escalera/${profile.id}`)}>
                      📈 Escalera de pronunciación
                    </button>
                  </div>
                </section>
              ) : (
                <p className="note">Todavía no hay una evaluación de pronunciación terminada.</p>
              )}

              <p className="note">{DISCLAIMER}</p>
              <p className="note">
                Los resultados son orientativos. Si te preocupa cómo habla {profile.name}, consulta a un fonoaudiólogo.
              </p>
            </>
          );
        })()}
    </main>
  );
}
