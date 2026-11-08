import { useEffect, useMemo, useState } from 'react';
import { CATEGORY_LABEL, collectAudioTexts, coverage, type AudioCategory, type AudioText } from '../lib/audioTexts';
import { audioKey } from '../lib/audioKey';
import { recordingsToZipFiles } from '../lib/audioProcess';
import { backupFileName } from '../lib/backup';
import { deleteAllRecordings, listRecordings } from '../lib/recordingsStore';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';
import { clearSeenMissing, getManifest, hasClip, seenMissing } from '../lib/voice';
import { makeZip } from '../lib/zip';

const PAGE = 25;

/** Texto que se vio en uso sin clip y que el recolector no conocía. */
function extraTexts(known: ReadonlySet<string>): AudioText[] {
  return seenMissing()
    .filter((t) => !known.has(audioKey(t)))
    .map((text) => ({ key: audioKey(text), text, category: 'instruccion' as AudioCategory, priority: 3, how: 'Clara y lenta, tono amable.' }));
}

export function VoiceHome() {
  const [version, setVersion] = useState(0); // para recalcular tras borrar o grabar
  const [recorded, setRecorded] = useState(0);
  const [shown, setShown] = useState(PAGE);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const all = useMemo(() => collectAudioTexts(), []);
  useEffect(() => {
    listRecordings()
      .then((r) => setRecorded(r.length))
      .catch(() => setError('No se pudieron leer las grabaciones del dispositivo.'));
  }, [version]);

  const known = useMemo(() => new Set(all.map((t) => t.key)), [all]);
  const extra = useMemo(() => extraTexts(known), [known, version]);
  const texts = useMemo(() => [...all, ...extra], [all, extra]);
  // `version` fuerza el recálculo: los clips cambian en memoria, no en el estado de React.
  const cov = useMemo(() => coverage(texts, (t) => hasClip(t.text)), [texts, version, recorded]);
  const manifestClips = Object.keys(getManifest().clips).length;
  const secure = typeof window === 'undefined' || window.isSecureContext !== false;

  async function exportZip() {
    setError('');
    setMessage('');
    try {
      const records = await listRecordings();
      if (records.length === 0) {
        setMessage('Todavía no hay grabaciones para exportar.');
        return;
      }
      const zip = makeZip(recordingsToZipFiles(records));
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(new Date()).replace('respaldo', 'voz').replace('.json', '.zip');
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage(`Se exportaron ${records.length} grabaciones. Descomprime el ZIP en audio-work/grabaciones y corre npm run audio:process.`);
    } catch (e) {
      console.error(e);
      setError('No se pudo crear el ZIP.');
    }
  }

  async function removeAll() {
    try {
      await deleteAllRecordings();
      setConfirmDelete(false);
      setMessage('Se borraron las grabaciones de este dispositivo.');
      setVersion((v) => v + 1);
    } catch (e) {
      console.error(e);
      setError('No se pudieron borrar las grabaciones.');
    }
  }

  const pct = cov.total === 0 ? 0 : Math.round((cov.withAudio / cov.total) * 100);

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Voz grabada</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go('adultos')}>
          ⬅️ Volver
        </button>
      </header>

      <section className="card" aria-labelledby="how-title">
        <h2 id="how-title">Cómo funciona</h2>
        <p>
          La app dice todo con la voz del sistema. Si grabas tu voz, la app la usa en lugar de la voz del sistema; lo que no tenga
          grabación sigue con la voz del sistema. Las grabaciones se guardan solo en este dispositivo.
        </p>
        <ol>
          <li>Graba los textos pendientes (primero los más importantes).</li>
          <li>Exporta el ZIP y procésalo en la computadora (<code>npm run audio:process</code>) para que quede dentro de la app.</li>
        </ol>
        {!secure && (
          <p className="notice notice--due" role="alert">
            <span aria-hidden="true">🔒</span>
            <span>Grabar con el micrófono exige https o localhost. Esta página no es segura, así que no se podrá grabar.</span>
          </p>
        )}
        <div className="row">
          <button type="button" className="btn btn--good" onClick={() => go('adultos/grabar')}>
            🎙️ Grabar los pendientes
          </button>
          <button type="button" className="btn btn--accent" onClick={() => void exportZip()}>
            📦 Exportar grabaciones (ZIP)
          </button>
        </div>
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
      </section>

      <section className="card" aria-labelledby="cov-title">
        <h2 id="cov-title">Textos con audio</h2>
        <div className="stats">
          <div className="stat">
            <strong>{pct} %</strong>
            <span>con audio</span>
            <small>
              {cov.withAudio} de {cov.total} textos
            </small>
          </div>
          <div className="stat">
            <strong>{recorded}</strong>
            <span>grabaciones</span>
            <small>en este dispositivo</small>
          </div>
          <div className="stat">
            <strong>{manifestClips}</strong>
            <span>clips</span>
            <small>dentro de la app</small>
          </div>
        </div>
        <table className="table">
          <caption className="sr-only">Cobertura de audio por tipo de texto</caption>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Con audio</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(CATEGORY_LABEL) as AudioCategory[]).map((c) => (
              <tr key={c}>
                <th scope="row">{CATEGORY_LABEL[c]}</th>
                <td>{cov.byCategory[c].withAudio}</td>
                <td>{cov.byCategory[c].total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="miss-title">
        <h2 id="miss-title">Textos sin audio</h2>
        {cov.missing.length === 0 ? (
          <p>¡Todos los textos tienen audio!</p>
        ) : (
          <>
            <p className="chart-note">Se muestran por prioridad (1 = primero). Los marcados con ★ se vieron en uso y no estaban en la lista.</p>
            <table className="table">
              <caption className="sr-only">Textos que todavía no tienen audio</caption>
              <thead>
                <tr>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Texto</th>
                </tr>
              </thead>
              <tbody>
                {cov.missing.slice(0, shown).map((t) => (
                  <tr key={t.key}>
                    <td>{t.priority}</td>
                    <td>{CATEGORY_LABEL[t.category]}</td>
                    <td>
                      {t.text}
                      {!known.has(t.key) && ' ★'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown < cov.missing.length && (
              <button type="button" className="btn btn--ghost" onClick={() => setShown((n) => n + PAGE * 4)}>
                Ver más ({cov.missing.length - shown} restantes)
              </button>
            )}
          </>
        )}
        {extra.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              clearSeenMissing();
              setVersion((v) => v + 1);
            }}
          >
            Limpiar la lista de textos vistos en uso
          </button>
        )}
      </section>

      <section className="card" aria-labelledby="del-title">
        <h2 id="del-title">Borrar grabaciones</h2>
        {confirmDelete ? (
          <div className="row">
            <span role="alert">¿Borrar las {recorded} grabaciones de este dispositivo?</span>
            <button type="button" className="btn btn--danger btn--small" onClick={() => void removeAll()}>
              Sí, borrar
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--ghost" disabled={recorded === 0} onClick={() => setConfirmDelete(true)}>
            🗑️ Borrar las grabaciones del dispositivo
          </button>
        )}
      </section>

      <p className="note">{DISCLAIMER}</p>
    </main>
  );
}
