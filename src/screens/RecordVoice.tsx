import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_LABEL, collectAudioTexts, type AudioCategory, type AudioText } from '../lib/audioTexts';
import { audioKey } from '../lib/audioKey';
import { extensionFor, micErrorMessage, pickMimeType, recordingSupport } from '../lib/recorder';
import { listRecordings, saveRecording } from '../lib/recordingsStore';
import { go } from '../lib/router';
import { cancelSpeech } from '../lib/speech';
import { hasClip, seenMissing } from '../lib/voice';

type Phase = 'idle' | 'recording' | 'review';
const MAX_SECONDS = 15;

export function RecordVoice() {
  const all = useMemo(() => {
    const base = collectAudioTexts();
    const known = new Set(base.map((t) => t.key));
    const extra: AudioText[] = seenMissing()
      .filter((t) => !known.has(audioKey(t)))
      .map((text) => ({ key: audioKey(text), text, category: 'instruccion', priority: 3, how: 'Clara y lenta, tono amable.' }));
    return [...base, ...extra].sort((a, b) => a.priority - b.priority);
  }, []);

  const [category, setCategory] = useState<'todas' | AudioCategory>('todas');
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [saved, setSaved] = useState(0); // fuerza el recálculo de pendientes
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [stored, setStored] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);
  const blob = useRef<Blob | null>(null);
  const preview = useRef<HTMLAudioElement | null>(null);
  const timer = useRef<number | null>(null);

  const support = recordingSupport({
    isSecureContext: typeof window === 'undefined' ? undefined : window.isSecureContext,
    hasGetUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    hasMediaRecorder: typeof MediaRecorder !== 'undefined',
  });

  const pending = useMemo(
    () => all.filter((t) => !hasClip(t.text) && !skipped.has(t.key) && (category === 'todas' || t.category === category)),
    // `saved` cambia cada vez que se guarda una grabación: hasClip lee estado fuera de React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, skipped, category, saved],
  );
  const current = pending[0];

  useEffect(() => {
    cancelSpeech(); // nada de voz del sistema mientras se graba
    listRecordings()
      .then((r) => setStored(r.length))
      .catch(() => undefined);
  }, [saved]);

  const cleanup = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    preview.current?.pause();
  };
  useEffect(
    () => () => {
      cleanup();
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    },
    [],
  );
  useEffect(
    () => () => {
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    },
    [reviewUrl],
  );

  async function start() {
    setError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
      const rec = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        cleanup();
        const type = rec.mimeType || mime || 'audio/webm';
        const b = new Blob(chunks.current, { type });
        blob.current = b;
        setReviewUrl(URL.createObjectURL(b));
        setPhase('review');
      };
      recorder.current = rec;
      rec.start();
      setSeconds(0);
      setPhase('recording');
      timer.current = window.setInterval(() => {
        setSeconds((n) => {
          if (n + 1 >= MAX_SECONDS && rec.state !== 'inactive') rec.stop();
          return n + 1;
        });
      }, 1000);
    } catch (e) {
      cleanup();
      setError(micErrorMessage(e));
      setPhase('idle');
    }
  }

  function stop() {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
  }

  function listen() {
    if (!reviewUrl) return;
    preview.current?.pause();
    const a = new Audio(reviewUrl);
    preview.current = a;
    void a.play().catch(() => setError('No se pudo reproducir la grabación.'));
  }

  function discard() {
    preview.current?.pause();
    blob.current = null;
    setReviewUrl(null);
    setPhase('idle');
  }

  async function keep() {
    if (!current || !blob.current) return;
    try {
      const buf = await new Response(blob.current).arrayBuffer();
      await saveRecording(current.text, buf, blob.current.type || 'audio/webm');
      discard();
      setSaved((n) => n + 1);
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar la grabación en el dispositivo.');
    }
  }

  function skip() {
    if (!current) return;
    discard();
    setSkipped((s) => new Set([...s, current.key]));
  }

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Grabar la voz</h1>
        <span className="spacer" />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            cleanup();
            go('adultos/voz');
          }}
        >
          ⬅️ Volver
        </button>
      </header>

      <p className="chart-note" aria-live="polite">
        Pendientes: {pending.length} · grabaciones en este dispositivo: {stored}
      </p>

      <div className="field">
        <label htmlFor="rec-cat">Tipo de texto</label>
        <select id="rec-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as 'todas' | AudioCategory)} disabled={phase !== 'idle'}>
          <option value="todas">Todos (por prioridad)</option>
          {(Object.keys(CATEGORY_LABEL) as AudioCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {!support.ok && (
        <p className="notice notice--due" role="alert">
          <span aria-hidden="true">🔒</span>
          <span>{support.reason}</span>
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {!current ? (
        <section className="card">
          <h2>No quedan textos pendientes aquí</h2>
          <p>Prueba otro tipo de texto, o exporta lo grabado desde “Voz grabada”.</p>
        </section>
      ) : (
        <section className="card rec-card" aria-labelledby="rec-text">
          <p className="chart-note">
            {CATEGORY_LABEL[current.category]} · prioridad {current.priority}
          </p>
          <p id="rec-text" className="rec-text">
            {current.text}
          </p>
          <p className="rec-how">
            <strong>Cómo decirlo:</strong> {current.how}
          </p>

          <div className="row" role="group" aria-label="Controles de grabación">
            {phase === 'idle' && (
              <button type="button" className="btn btn--danger btn--big" disabled={!support.ok} onClick={() => void start()}>
                ⏺ Grabar
              </button>
            )}
            {phase === 'recording' && (
              <>
                <button type="button" className="btn btn--good btn--big" onClick={stop}>
                  ⏹ Detener
                </button>
                <span role="status">Grabando… {seconds} s</span>
              </>
            )}
            {phase === 'review' && (
              <>
                <button type="button" className="btn btn--accent" onClick={listen}>
                  ▶ Reescuchar
                </button>
                <button type="button" className="btn btn--good" onClick={() => void keep()}>
                  ✅ Guardar y seguir
                </button>
                <button type="button" className="btn btn--ghost" onClick={discard}>
                  🔁 Regrabar
                </button>
              </>
            )}
            <button type="button" className="btn btn--ghost" disabled={phase !== 'idle'} onClick={skip}>
              ⏭ Saltar
            </button>
          </div>
          {phase === 'review' && <p className="chart-note">Formato: {extensionFor(blob.current?.type ?? '')}. Escucha que se oiga claro y sin ruido.</p>}
        </section>
      )}
    </main>
  );
}
