import { useEffect, useMemo, useState } from 'react';
import type { ChildProfile, PronunciationItem, PronunciationMode, PronunciationRecord, PronunciationStatus } from '../lib/db';
import { markWord, getPhoneme } from '../lib/phonemes';
import {
  POSITION_LABEL,
  PROCESS_LABEL,
  blockProgress,
  chunkBlocks,
  cleanSubstitution,
  responseOf,
  substitutionOptions,
} from '../lib/pronunciation';
import { getPronunciation, saveResponse } from '../lib/pronunciationStore';
import { go } from '../lib/router';
import { speak } from '../lib/speech';

interface Props {
  profile: ChildProfile;
  recordId: string;
}

type Phase = 'item' | 'block-end';

const STATUS_BUTTONS: { status: PronunciationStatus; label: string; icon: string; cls: string }[] = [
  { status: 'correcta', label: 'Correcta', icon: '✅', cls: 'btn btn--good' },
  { status: 'sustituida', label: 'Sustituida', icon: '🔁', cls: 'btn btn--accent' },
  { status: 'omitida', label: 'Omitida', icon: '➖', cls: 'btn btn--ghost' },
  { status: 'distorsionada', label: 'Distorsionada', icon: '〰️', cls: 'btn btn--ghost' },
];

/** Palabra para el adulto, con el sonido objetivo resaltado (o con guiones entre sílabas en los procesos). */
function WordForAdult({ item }: { item: PronunciationItem }) {
  const phoneme = item.phonemeId ? getPhoneme(item.phonemeId) : undefined;
  if (!phoneme || phoneme.kind !== 'sound') return <strong>{item.syllables.join('-')}</strong>;
  return (
    <strong>
      {markWord(item.word, phoneme.patterns).map((s, i) =>
        s.hit ? (
          <mark key={i} className="pron-hit">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </strong>
  );
}

export function PronunciationRunner({ profile, recordId }: Props) {
  const [record, setRecord] = useState<PronunciationRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [blockIdx, setBlockIdx] = useState(0);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<Phase>('item');
  const [mode, setMode] = useState<PronunciationMode>('espontanea');
  const [picking, setPicking] = useState(false);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  const toHub = () => go(`adultos/pronunciacion/${profile.id}`);

  useEffect(() => {
    let alive = true;
    getPronunciation(recordId)
      .then((r) => {
        if (!alive) return;
        if (!r || r.profileId !== profile.id) {
          setMissing(true);
          return;
        }
        // Retomar: el primer bloque con palabras sin responder y, dentro, la primera sin responder.
        const blocks = chunkBlocks(r.items);
        const p = blockProgress(r);
        const bi = p.done ? Math.max(0, blocks.length - 1) : p.nextBlock;
        const answered = new Set(r.responses.map((x) => x.itemId));
        const first = blocks[bi]?.findIndex((i) => !answered.has(i.id)) ?? 0;
        setBlockIdx(bi);
        setPos(Math.max(0, first));
        setRecord(r);
      })
      .catch(() => alive && setMissing(true));
    return () => {
      alive = false;
    };
  }, [recordId, profile.id]);

  const blocks = useMemo(() => (record ? chunkBlocks(record.items) : []), [record]);
  const block = blocks[blockIdx];
  const item = block?.[pos];

  // Al cambiar de palabra se recuerda cómo se marcó antes (si se vuelve atrás) o se parte de "solo".
  const itemId = item?.id;
  useEffect(() => {
    if (!record || !itemId) return;
    setMode(responseOf(record.responses, itemId)?.mode ?? 'espontanea');
    setPicking(false);
    setCustom('');
    // Solo al cambiar de palabra: guardar una respuesta no debe reiniciar la marca de modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  if (missing) {
    return (
      <main className="screen screen--center">
        <h1>Evaluación no encontrada</h1>
        <p role="alert">No se encontró esta evaluación en el dispositivo.</p>
        <button type="button" className="btn" onClick={toHub}>
          ⬅️ Volver
        </button>
      </main>
    );
  }
  if (!record || !block || !item) {
    return (
      <main className="screen screen--center" aria-busy="true">
        <h1 className="sr-only">Cargando evaluación</h1>
        <p className="avatar bob" aria-hidden="true">
          🗣️
        </p>
      </main>
    );
  }

  const progress = blockProgress(record);

  async function mark(status: PronunciationStatus, substitution?: string) {
    if (!record || !item || busy) return;
    setBusy(true);
    setSaveError(false);
    try {
      const saved = await saveResponse(record.id, { itemId: item.id, mode, status, substitution, at: Date.now() });
      if (!saved) throw new Error('sin registro');
      setRecord(saved);
      if (pos + 1 < block.length) setPos(pos + 1);
      else setPhase('block-end');
    } catch (e) {
      console.error(e);
      setSaveError(true);
    } finally {
      setBusy(false);
    }
  }

  function onStatus(status: PronunciationStatus) {
    if (status === 'sustituida') setPicking(true);
    else void mark(status);
  }

  const isProcess = item.process !== undefined;
  const options = item.phonemeId ? substitutionOptions(item.phonemeId) : [];
  const existing = responseOf(record.responses, item.id);

  if (phase === 'block-end') {
    const last = progress.done;
    return (
      <main className="screen screen--center">
        <h1>{last ? '¡Evaluación terminada!' : `Terminaste el bloque ${blockIdx + 1} de ${blocks.length}`}</h1>
        <p className="avatar" aria-hidden="true">
          {last ? '🎉' : '⏸️'}
        </p>
        <p>
          {last
            ? `Ya están todas las palabras (${progress.total}). Mira los resultados.`
            : `Llevan ${progress.answered} de ${progress.total} palabras. Puedes seguir ahora o pausar y retomar otro día: lo marcado ya está guardado.`}
        </p>
        <div className="row row--center">
          {last ? (
            <button type="button" className="btn btn--good btn--big" onClick={toHub}>
              📊 Ver resultados
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--good btn--big"
                onClick={() => {
                  setBlockIdx(blockIdx + 1);
                  setPos(0);
                  setPhase('item');
                }}
              >
                ▶ Siguiente bloque
              </button>
              <button type="button" className="btn btn--ghost" onClick={toHub}>
                ⏸️ Pausar y salir
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              setPos(block.length - 1);
              setPhase('item');
            }}
          >
            ⬅️ Revisar la última
          </button>
        </div>
      </main>
    );
  }

  const title = isProcess ? PROCESS_LABEL[item.process!] : `Sonido ${getPhoneme(item.phonemeId!)?.name ?? ''} ${POSITION_LABEL[item.position]}`;

  return (
    <main className="screen pron-run">
      <header className="row">
        <h1 style={{ margin: 0, fontSize: 'var(--fs-big)' }}>Pronunciación de {profile.name}</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost btn--small" onClick={toHub}>
          ⏸️ Pausar y salir
        </button>
      </header>
      <p className="chart-note" aria-live="polite">
        Bloque {blockIdx + 1} de {blocks.length} · palabra {pos + 1} de {block.length}
        {item.optional && ' · opcional (meta suave)'}
      </p>

      <section className="pron-card" aria-label="Dibujo para el niño">
        <p className="pron-emoji" role="img" aria-label={`Dibujo de ${item.word}`}>
          {item.emoji}
        </p>
        <p className="pron-ask">Pregunta: “¿Qué es esto?”</p>
      </section>

      <aside className="adult-panel no-print pron-panel" aria-label="Panel para el adulto">
        <p className="adult-panel__target">
          <span aria-hidden="true">👤</span> Palabra: <WordForAdult item={item} /> <small>· {title}</small>
        </p>

        <fieldset className="pron-mode">
          <legend>¿Cómo la dijo?</legend>
          <label className="pron-radio">
            <input type="radio" name="mode" checked={mode === 'espontanea'} onChange={() => setMode('espontanea')} />
            <span>Solo (espontánea)</span>
          </label>
          <label className="pron-radio">
            <input type="radio" name="mode" checked={mode === 'repetida'} onChange={() => setMode('repetida')} />
            <span>Repitiéndola (tras escucharte)</span>
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => {
              setMode('repetida');
              void speak(item.word);
            }}
          >
            🔊 Decir la palabra
          </button>
        </fieldset>

        {picking ? (
          <div className="pron-sub" role="group" aria-label="¿Qué sonido dijo en su lugar?">
            <p>
              ¿Qué dijo en lugar de <WordForAdult item={item} />?
            </p>
            <div className="row">
              {options.map((o) => (
                <button key={o} type="button" className="btn btn--accent pron-chip" disabled={busy} onClick={() => void mark('sustituida', o)}>
                  “{o}”
                </button>
              ))}
            </div>
            <div className="row">
              <label htmlFor="pron-other">Otra:</label>
              <input
                id="pron-other"
                className="input pron-other"
                value={custom}
                maxLength={8}
                autoComplete="off"
                onChange={(e) => setCustom(e.target.value)}
              />
              <button
                type="button"
                className="btn btn--good"
                disabled={busy || cleanSubstitution(custom) === ''}
                onClick={() => void mark('sustituida', cleanSubstitution(custom))}
              >
                Guardar
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => setPicking(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : isProcess ? (
          <div className="adult-panel__actions">
            <button type="button" className="btn btn--good" disabled={busy} onClick={() => void mark('correcta')}>
              ✅ Dijo todo
            </button>
            <button type="button" className="btn btn--accent" disabled={busy} onClick={() => void mark('omitida')}>
              ➖ Omitió o redujo
            </button>
          </div>
        ) : (
          <div className="adult-panel__actions">
            {STATUS_BUTTONS.map((b) => (
              <button key={b.status} type="button" className={b.cls} disabled={busy} onClick={() => onStatus(b.status)}>
                <span aria-hidden="true">{b.icon}</span> {b.label}
              </button>
            ))}
          </div>
        )}

        {existing && !picking && (
          <p className="chart-note">
            Marcada antes: {existing.status}
            {existing.substitution ? ` (“${existing.substitution}”)` : ''}. Si marcas otra, se reemplaza.
          </p>
        )}
        {saveError && (
          <p className="error-text" role="alert">
            No se pudo guardar. Revisa el almacenamiento del dispositivo e inténtalo de nuevo.
          </p>
        )}
        <div className="row">
          <button type="button" className="btn btn--ghost btn--small" disabled={pos === 0} onClick={() => setPos(pos - 1)}>
            ⬅️ Anterior
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={!existing}
            onClick={() => (pos + 1 < block.length ? setPos(pos + 1) : setPhase('block-end'))}
          >
            Siguiente ➡️
          </button>
        </div>
      </aside>
    </main>
  );
}
