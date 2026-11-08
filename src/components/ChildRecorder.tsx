import { useEffect, useRef, useState } from 'react';
import type { ChildRecordingSource } from '../lib/db';
import { saveChildRecording } from '../lib/childRecordingsStore';
import { micSupport, startMic, type MicSession } from '../lib/mic';
import { micErrorMessage } from '../lib/recorder';
import { cancelSpeech, speak } from '../lib/speech';

type Phase = 'idle' | 'recording' | 'review' | 'saved';

interface Props {
  profileId: string;
  /** Lo que el niño dice: también es el modelo del adulto (clip grabado o voz del sistema). */
  text: string;
  source: ChildRecordingSource;
  /** Se llama al guardar (para refrescar listas). */
  onSaved?: () => void;
  /** Textos para el niño ("Grabarme") en lugar de los del adulto ("Grabar al niño"). */
  childView?: boolean;
}

/** Toca un audio y espera a que termine (o falle). */
function playBlobUrl(url: string, holder: { current: HTMLAudioElement | null }): Promise<void> {
  return new Promise((resolve) => {
    holder.current?.pause();
    const a = new Audio(url);
    holder.current = a;
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}

/**
 * Graba al niño diciendo `text` y deja escucharlo junto al modelo del adulto. Lo guardado vive solo en
 * el dispositivo y se borra desde la zona de adultos. Nada se sube a ningún servidor.
 */
export function ChildRecorder({ profileId, text, source, onSaved, childView = false }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const mic = useRef<MicSession | null>(null);
  const blob = useRef<Blob | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const support = micSupport();

  // Al cambiar de palabra o salir: se corta todo y se descarta lo no guardado.
  useEffect(
    () => () => {
      mic.current?.cancel();
      player.current?.pause();
      cancelSpeech();
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function start() {
    setError('');
    cancelSpeech();
    try {
      const m = await startMic();
      mic.current = m;
      setPhase('recording');
      m.done
        .then((b) => {
          blob.current = b;
          setUrl(URL.createObjectURL(b));
          setPhase('review');
        })
        .catch(() => undefined); // cancelada
    } catch (e) {
      setError(micErrorMessage(e));
      setPhase('idle');
    }
  }

  const stop = () => void mic.current?.stop().catch(() => undefined);

  async function listenChild() {
    if (url) await playBlobUrl(url, player);
  }

  /** Primero el modelo del adulto y enseguida el niño. */
  async function listenBoth() {
    await speak(text);
    if (url) await playBlobUrl(url, player);
  }

  function discard() {
    player.current?.pause();
    cancelSpeech();
    blob.current = null;
    setUrl(null);
    setPhase('idle');
  }

  async function save() {
    if (!blob.current) return;
    try {
      const data = await new Response(blob.current).arrayBuffer();
      await saveChildRecording({ profileId, text, source, data, mime: blob.current.type || 'audio/webm' });
      setPhase('saved');
      onSaved?.();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar en el dispositivo.');
    }
  }

  if (!support.ok) {
    return (
      <p className="chart-note" role="note">
        🔒 {support.reason}
      </p>
    );
  }

  return (
    <div className="child-rec" role="group" aria-label="Grabar al niño">
      <div className="row">
        {phase === 'idle' && (
          <button type="button" className="btn btn--accent" onClick={() => void start()}>
            {childView ? '🎙️ Grabarme' : '🎙️ Grabar al niño'}
          </button>
        )}
        {phase === 'recording' && (
          <>
            <button type="button" className="btn btn--good" onClick={stop}>
              ⏹ Detener
            </button>
            <span role="status">Grabando…</span>
          </>
        )}
        {phase === 'review' && (
          <>
            <button type="button" className="btn btn--ghost" onClick={() => void listenChild()}>
              {childView ? '▶ Escucharme' : '▶ Escuchar al niño'}
            </button>
            <button type="button" className="btn btn--accent" onClick={() => void listenBoth()}>
              👂 Modelo y niño
            </button>
            <button type="button" className="btn btn--good" onClick={() => void save()}>
              💾 Guardar
            </button>
            <button type="button" className="btn btn--ghost" onClick={discard}>
              🗑️ Descartar
            </button>
          </>
        )}
        {phase === 'saved' && (
          <>
            <span role="status">✅ Guardada en este dispositivo.</span>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => void listenBoth()}>
              👂 Modelo y niño
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={discard}>
              Grabar otra vez
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
