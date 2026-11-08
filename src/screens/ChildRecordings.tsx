import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChildProfile, ChildRecordingRecord } from '../lib/db';
import { deleteChildRecording, deleteChildRecordings, listChildRecordings, totalBytes } from '../lib/childRecordingsStore';
import { go } from '../lib/router';
import { cancelSpeech, speak } from '../lib/speech';
import { formatBytes } from '../lib/storage';
import { DISCLAIMER } from '../lib/texts';

const SOURCE_LABEL = { evaluacion: 'Evaluación de pronunciación', escalera: 'Escalera de sonidos' } as const;

const dateOf = (ms: number) => new Date(ms).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

export function ChildRecordings({ profile }: { profile: ChildProfile }) {
  const [records, setRecords] = useState<ChildRecordingRecord[] | null>(null);
  const [error, setError] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [message, setMessage] = useState('');
  const player = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<string[]>([]);

  const load = useCallback(async () => {
    try {
      setRecords(await listChildRecordings(profile.id));
    } catch (e) {
      console.error(e);
      setError('No se pudieron leer las grabaciones del dispositivo.');
    }
  }, [profile.id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(
    () => () => {
      player.current?.pause();
      cancelSpeech();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  function play(r: ChildRecordingRecord, withModel: boolean) {
    player.current?.pause();
    cancelSpeech();
    const url = URL.createObjectURL(new Blob([r.data], { type: r.mime }));
    urls.current.push(url);
    const child = () => {
      const a = new Audio(url);
      player.current = a;
      void a.play().catch(() => setError('No se pudo reproducir la grabación.'));
    };
    if (withModel) void speak(r.text).then(child);
    else child();
  }

  async function remove(id: string) {
    try {
      await deleteChildRecording(id);
      await load();
    } catch (e) {
      console.error(e);
      setError('No se pudo borrar.');
    }
  }

  async function removeAll() {
    try {
      const n = await deleteChildRecordings(profile.id);
      setConfirmAll(false);
      setMessage(`Se borraron ${n} grabaciones de ${profile.name}.`);
      await load();
    } catch (e) {
      console.error(e);
      setError('No se pudo borrar.');
    }
  }

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Grabaciones de {profile.name}</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go(`adultos/seguimiento/${profile.id}`)}>
          ⬅️ Volver
        </button>
      </header>

      <p className="note" role="note">
        Las grabaciones de la voz del niño se guardan <strong>solo en este dispositivo</strong>: no se envían a ningún servidor y no
        entran en el respaldo salvo que lo elijas al descargarlo. Aquí puedes escucharlas junto al modelo y borrarlas.
      </p>

      {message && (
        <p role="status" className="notice notice--info">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {records === null && !error && <p aria-busy="true">Cargando…</p>}
      {records !== null && records.length === 0 && (
        <p>
          Aún no hay grabaciones. Se hacen con el botón “Grabar al niño” en la evaluación de pronunciación o en la escalera de sonidos.
        </p>
      )}

      {records !== null && records.length > 0 && (
        <>
          <p className="chart-note">
            {records.length} {records.length === 1 ? 'grabación' : 'grabaciones'} · {formatBytes(totalBytes(records))}
          </p>
          <ul className="list">
            {records.map((r) => (
              <li key={r.id} className="list-item rec-row">
                <span>
                  <strong>{r.text}</strong>
                  <br />
                  <small>
                    {dateOf(r.at)} · {SOURCE_LABEL[r.source]}
                  </small>
                </span>
                <span className="spacer" />
                <button type="button" className="btn btn--ghost btn--small" onClick={() => play(r, false)} aria-label={`Escuchar al niño: ${r.text}`}>
                  ▶ Niño
                </button>
                <button type="button" className="btn btn--accent btn--small" onClick={() => play(r, true)} aria-label={`Modelo y niño: ${r.text}`}>
                  👂 Modelo y niño
                </button>
                <button type="button" className="btn btn--danger btn--small" onClick={() => void remove(r.id)} aria-label={`Borrar la grabación de ${r.text}`}>
                  🗑️ Borrar
                </button>
              </li>
            ))}
          </ul>
          {confirmAll ? (
            <div className="row">
              <span role="alert">¿Borrar todas las grabaciones de {profile.name}?</span>
              <button type="button" className="btn btn--danger btn--small" onClick={() => void removeAll()}>
                Sí, borrar todas
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmAll(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmAll(true)}>
              🗑️ Borrar todas las grabaciones
            </button>
          )}
        </>
      )}

      <p className="note">{DISCLAIMER}</p>
    </main>
  );
}
