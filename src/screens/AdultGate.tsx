import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HOLD_MS, checkAnswer, holdProgress, makeChallenge } from '../lib/gate';

interface Props {
  onPass: () => void;
  onCancel: () => void;
}

/** Puerta de adultos: mantener presionado 3 s, o resolver una suma. */
export function AdultGate({ onPass, onCancel }: Props) {
  const [challenge] = useState(() => makeChallenge());
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const stopHold = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    holdStart.current = null;
    setProgress(0);
  };

  useEffect(() => stopHold, []);

  const startHold = () => {
    if (timer.current !== null) return;
    holdStart.current = Date.now();
    timer.current = window.setInterval(() => {
      const p = holdProgress(Date.now() - (holdStart.current ?? Date.now()));
      setProgress(p);
      if (p >= 1) {
        stopHold();
        onPass();
      }
    }, 50);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (checkAnswer(challenge, typed)) onPass();
    else {
      setWrong(true);
      setTyped('');
    }
  };

  return (
    <main className="screen screen--center">
      <h1>🔒 Zona de adultos</h1>
      <p>Solo para madres, padres y cuidadores.</p>

      <section className="card" aria-labelledby="hold-title">
        <h2 id="hold-title">Opción 1: mantén presionado</h2>
        <button
          type="button"
          className="btn btn--accent hold-btn"
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-describedby="hold-help"
        >
          Mantener {HOLD_MS / 1000} segundos
          <span className="hold-btn__bar" style={{ width: `${progress * 100}%` }} aria-hidden="true" />
        </button>
        <p id="hold-help" className="note" style={{ marginTop: 12 }}>
          Mantén el dedo sobre el botón hasta que la barra se llene.
        </p>
      </section>

      <form className="card" onSubmit={submit} aria-labelledby="sum-title">
        <h2 id="sum-title">Opción 2: resuelve la suma</h2>
        <div className="field">
          <label htmlFor="sum">
            ¿Cuánto es {challenge.a} + {challenge.b}?
          </label>
          <input
            id="sum"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              setWrong(false);
            }}
            aria-invalid={wrong}
            aria-describedby={wrong ? 'sum-error' : undefined}
          />
          {wrong && (
            <p id="sum-error" className="error-text" role="alert">
              Esa no es la respuesta. Inténtalo otra vez.
            </p>
          )}
        </div>
        <button type="submit" className="btn">
          Entrar
        </button>
      </form>

      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        ⬅️ Volver
      </button>
    </main>
  );
}
