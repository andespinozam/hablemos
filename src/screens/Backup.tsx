import { useEffect, useRef, useState } from 'react';
import { backupFileName, exportBackup, importBackup, parseBackup, type Backup, type BackupSummary } from '../lib/backup';
import { go } from '../lib/router';
import { formatBytes, storageStatus, type StorageStatus } from '../lib/storage';
import { BACKUP_PRIVACY } from '../lib/texts';

interface Props {
  /** Recarga los perfiles en la app tras importar. */
  onImported: () => Promise<void>;
}

type Pending = { backup: Backup; summary: BackupSummary; fileName: string };

/** Descarga un texto como archivo. Funciona sin conexión (Blob local). */
function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Backup({ onImported }: Props) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  useEffect(() => {
    void storageStatus().then(setStorage);
  }, []);

  const doExport = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup();
      download(JSON.stringify(backup, null, 2), backupFileName(new Date()));
      setMessage({
        kind: 'ok',
        text: `Respaldo creado: ${backup.data.profiles.length} perfil(es), ${backup.data.results.length} resultados.`,
      });
    } catch (e) {
      console.error(e);
      setMessage({ kind: 'error', text: 'No se pudo crear el respaldo.' });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    setMessage(null);
    setErrors([]);
    setPending(null);
    setConfirmReplace(false);
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setErrors(parsed.errors);
        setMessage({ kind: 'error', text: 'Ese archivo no se puede importar. No se cambió nada.' });
      } else {
        setPending({ backup: parsed.backup, summary: parsed.summary, fileName: file.name });
      }
    } catch {
      setMessage({ kind: 'error', text: 'No se pudo leer el archivo.' });
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return;
    setBusy(true);
    try {
      await importBackup(pending.backup, mode);
      await onImported();
      setMessage({
        kind: 'ok',
        text: mode === 'replace' ? 'Listo: se reemplazaron todos los datos con los del respaldo.' : 'Listo: se combinaron los datos del respaldo con los de este dispositivo.',
      });
      setPending(null);
      setConfirmReplace(false);
    } catch (e) {
      console.error(e);
      setMessage({ kind: 'error', text: 'No se pudo importar. No se cambió nada.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Respaldo</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go('adultos')}>
          ⬅️ Volver
        </button>
      </header>

      <p className="note" role="note">
        {BACKUP_PRIVACY}
      </p>

      {message && (
        <p className={message.kind === 'ok' ? 'notice' : 'notice notice--due'} role={message.kind === 'error' ? 'alert' : 'status'}>
          <span aria-hidden="true">{message.kind === 'ok' ? '✅' : '⚠️'}</span>
          <span>{message.text}</span>
        </p>
      )}
      {errors.length > 0 && (
        <ul className="error-text">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {storage && (
        <p className="notice notice--info" role="note">
          <span aria-hidden="true">🛡️</span>
          <span>
            {storage.persistent
              ? 'El navegador protege estos datos contra el borrado automático.'
              : 'El navegador podría borrar estos datos si falta espacio. Haz respaldos de vez en cuando; en iPad, agrega la app a la pantalla de inicio.'}
            {storage.usage !== undefined && ` Ocupan ${formatBytes(storage.usage)}.`}
          </span>
        </p>
      )}

      <section className="card" aria-labelledby="export-title">
        <h2 id="export-title">Guardar un respaldo</h2>
        <p>Descarga un archivo con todos los perfiles, sesiones, resultados y evaluaciones de este dispositivo.</p>
        <button type="button" className="btn btn--good" onClick={() => void doExport()} disabled={busy}>
          💾 Descargar respaldo
        </button>
      </section>

      <section className="card" aria-labelledby="import-title">
        <h2 id="import-title">Recuperar un respaldo</h2>
        <p>Sirve para pasar los datos a otra tablet o recuperarlos si se borraron.</p>
        <div className="field">
          <label htmlFor="backup-file">Archivo de respaldo (.json)</label>
          <input
            id="backup-file"
            ref={fileInput}
            className="input"
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>

        {pending && (
          <div className="notice" role="group" aria-label="Confirmar importación">
            <span aria-hidden="true">📂</span>
            <div>
              <p style={{ margin: 0 }}>
                <strong>{pending.fileName}</strong>
              </p>
              <p style={{ margin: '4px 0' }}>
                {pending.summary.profiles} perfil(es): {pending.summary.names.join(', ') || '—'} · {pending.summary.sessions} sesiones ·{' '}
                {pending.summary.results} resultados · {pending.summary.assessments} evaluaciones
              </p>
              <div className="row">
                <button type="button" className="btn btn--accent" onClick={() => void doImport('merge')} disabled={busy}>
                  ➕ Combinar con lo que hay
                </button>
                {!confirmReplace ? (
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmReplace(true)} disabled={busy}>
                    Reemplazar todo…
                  </button>
                ) : (
                  <>
                    <span role="alert">Se borrarán los datos actuales de este dispositivo.</span>
                    <button type="button" className="btn btn--danger" onClick={() => void doImport('replace')} disabled={busy}>
                      Sí, reemplazar
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => setConfirmReplace(false)}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
              <p className="chart-note" style={{ marginTop: 8 }}>
                &quot;Combinar&quot; conserva lo que ya hay y agrega lo del respaldo (si un registro está en los dos, gana el del respaldo).
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
