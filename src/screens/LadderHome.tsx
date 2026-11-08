import { useCallback, useEffect, useState } from 'react';
import { LadderSummary } from '../components/LadderSummary';
import { MouthGuide } from '../components/MouthGuide';
import type { ChildProfile, LadderRecord, PronunciationRecord } from '../lib/db';
import { LADDER_STEPS, MAX_ACTIVE_LADDERS, SESSIONS_TO_ADVANCE, ladderContent } from '../lib/ladder';
import { listLadders, setSubstitution, syncLaddersFromEvaluation } from '../lib/ladderStore';
import { getPhoneme } from '../lib/phonemes';
import { cleanSubstitution, latestPronunciation, substitutionOptions } from '../lib/pronunciation';
import { listPronunciation } from '../lib/pronunciationStore';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';

function LadderCard({ ladder, onSubstitution }: { ladder: LadderRecord; onSubstitution: (key: string, value: string | undefined) => void }) {
  const phoneme = getPhoneme(ladder.phonemeId);
  const info = ladderContent(ladder.phonemeId);
  const [showMouth, setShowMouth] = useState(false);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState('');
  const options = substitutionOptions(ladder.phonemeId);
  const done = ladder.state === 'done';

  return (
    <li className="card ladder-card">
      <div className="row">
        <h3 style={{ margin: 0 }}>
          Sonido {phoneme?.name ?? ladder.phonemeId}
        </h3>
        <span className="spacer" />
        <span className="badge">{done ? '✅ Terminada' : ladder.state === 'active' ? '▶ En práctica' : '⏳ En espera'}</span>
      </div>

      <ol className="ladder-steps" aria-label="Escalones">
        {LADDER_STEPS.map((s, i) => {
          const state = done || i < ladder.step ? 'done' : i === ladder.step ? 'now' : 'todo';
          return (
            <li key={s.id} className={`ladder-step ladder-step--${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span aria-hidden="true">{state === 'done' ? '✔' : i + 1}</span> {s.short}
              <span className="sr-only">{state === 'done' ? ' (superado)' : state === 'now' ? ' (actual)' : ''}</span>
            </li>
          );
        })}
      </ol>
      {!done && (
        <p>
          Sesiones con “Lo logró” en este escalón: <strong>{ladder.successSessions.length} de {SESSIONS_TO_ADVANCE}</strong>.
        </p>
      )}

      <p>
        Dice en su lugar: <strong>{ladder.substitution ? `“${ladder.substitution}”` : 'sin registrar'}</strong>{' '}
        {ladder.substitution && ladder.substitutionSource === 'evaluacion' && <small>(de la evaluación)</small>}
      </p>
      {editing ? (
        <div className="row" role="group" aria-label="Sustitución observada">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className="btn btn--accent pron-chip"
              onClick={() => {
                onSubstitution(ladder.key, o);
                setEditing(false);
              }}
            >
              “{o}”
            </button>
          ))}
          <label htmlFor={`sub-${ladder.key}`}>Otra:</label>
          <input id={`sub-${ladder.key}`} className="input pron-other" value={custom} maxLength={8} autoComplete="off" onChange={(e) => setCustom(e.target.value)} />
          <button
            type="button"
            className="btn btn--good"
            disabled={cleanSubstitution(custom) === ''}
            onClick={() => {
              onSubstitution(ladder.key, cleanSubstitution(custom));
              setCustom('');
              setEditing(false);
            }}
          >
            Guardar
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => { onSubstitution(ladder.key, undefined); setEditing(false); }}>
            Quitar
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setEditing(true)}>
            ✏️ Cambiar lo que dice
          </button>
          {info && (
            <button type="button" className="btn btn--ghost btn--small" aria-expanded={showMouth} onClick={() => setShowMouth((v) => !v)}>
              👄 {showMouth ? 'Ocultar la boca' : 'Ver la boca'}
            </button>
          )}
        </div>
      )}
      {showMouth && info && (
        <div className="ladder-mouth">
          <MouthGuide mouth={info.mouth} label={info.cue} active />
          <p>{info.cue}</p>
          {info.warmups && (
            <>
              <p>
                <strong>Antes, sin presión:</strong>
              </p>
              <ul>
                {info.warmups.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function LadderHome({ profile }: { profile: ChildProfile }) {
  const [ladders, setLadders] = useState<LadderRecord[] | null>(null);
  const [evaluation, setEvaluation] = useState<PronunciationRecord | undefined>();
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, p] = await Promise.all([listLadders(profile.id), listPronunciation(profile.id)]);
      setLadders(l);
      setEvaluation(latestPronunciation(p));
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }, [profile.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    if (!evaluation) return;
    try {
      const next = await syncLaddersFromEvaluation(evaluation);
      setLadders(next);
      setMessage('Escaleras actualizadas con la última evaluación de pronunciación.');
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }

  async function changeSubstitution(key: string, value: string | undefined) {
    try {
      await setSubstitution(key, value);
      await load();
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }

  const active = (ladders ?? []).filter((l) => l.state === 'active');
  const queued = (ladders ?? []).filter((l) => l.state === 'queued');
  const done = (ladders ?? []).filter((l) => l.state === 'done');

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Escalera de pronunciación de {profile.name}</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go(`adultos/pronunciacion/${profile.id}`)}>
          ⬅️ Volver
        </button>
      </header>

      <section className="card" aria-labelledby="how-title">
        <h2 id="how-title">Cómo funciona</h2>
        <p>
          Cada sonido “a estimular” de la evaluación de pronunciación tiene una escalera de 6 escalones: {LADDER_STEPS.map((s) => s.title.toLowerCase()).join(', ')}.
          Se trabajan hasta {MAX_ACTIVE_LADDERS} sonidos a la vez, empezando por los tempranos; los demás esperan su turno.
        </p>
        <p>
          En la sesión de juego, la actividad “Mi sonido” propone los ejercicios y tú calificas. Se sube de escalón solo con “Lo logró” en{' '}
          {SESSIONS_TO_ADVANCE} sesiones distintas; “Con ayuda” o “Aún no” nunca hacen retroceder. La app no califica la pronunciación.
        </p>
        <button type="button" className="btn btn--accent" disabled={!evaluation} onClick={() => void sync()}>
          🔄 Actualizar desde la última evaluación
        </button>
        {!evaluation && (
          <p className="note">
            Primero hay que terminar una evaluación de pronunciación.{' '}
            <button type="button" className="btn btn--ghost btn--small" onClick={() => go(`adultos/pronunciacion/${profile.id}`)}>
              Ir a la evaluación
            </button>
          </p>
        )}
        {message && (
          <p role="status" className="notice notice--info">
            {message}
          </p>
        )}
      </section>

      {error && (
        <p className="error-text" role="alert">
          No se pudieron leer o guardar los datos del dispositivo.
        </p>
      )}
      {ladders === null && !error && <p aria-busy="true">Cargando…</p>}
      {ladders !== null && ladders.length === 0 && evaluation && <p>No hay sonidos “a estimular”: no hace falta una escalera por ahora.</p>}

      {active.length > 0 && (
        <section aria-labelledby="act-title">
          <h2 id="act-title">En práctica</h2>
          <ul className="list ladder-list">
            {active.map((l) => (
              <LadderCard key={l.key} ladder={l} onSubstitution={(k, v) => void changeSubstitution(k, v)} />
            ))}
          </ul>
        </section>
      )}
      {queued.length > 0 && (
        <section aria-labelledby="q-title">
          <h2 id="q-title">En espera</h2>
          <ul className="list ladder-list">
            {queued.map((l) => (
              <LadderCard key={l.key} ladder={l} onSubstitution={(k, v) => void changeSubstitution(k, v)} />
            ))}
          </ul>
        </section>
      )}
      {done.length > 0 && (
        <section aria-labelledby="d-title">
          <h2 id="d-title">Terminadas</h2>
          <LadderSummary ladders={done} />
        </section>
      )}

      <p className="note">{DISCLAIMER}</p>
    </main>
  );
}
