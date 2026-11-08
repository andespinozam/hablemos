import { formatDate } from './ReassessmentBanner';
import type { PronunciationRecord } from '../lib/db';
import {
  CLASSIFICATION_LABEL,
  POSITION_LABEL,
  PROCESS_LABEL,
  WORK_GROUP_LABEL,
  analyzeProcesses,
  analyzeSounds,
  compareSounds,
  countByClass,
  firstPronunciation,
  latestPronunciation,
  workOrder,
  type Classification,
  type WorkItem,
} from '../lib/pronunciation';

const CLASS_ICON: Record<Classification, string> = { consolidado: '✅', estimular: '🌱', esperable: '🕐' };

/** Texto de la clasificación con ícono: nunca solo color. */
export function ClassLabel({ value }: { value: Classification }) {
  return (
    <span>
      <span aria-hidden="true">{CLASS_ICON[value]}</span> {CLASSIFICATION_LABEL[value]}
    </span>
  );
}

const PROCESS_LEVEL = { 'no-observado': 'No se observó', ocasional: 'Ocasional', frecuente: 'Frecuente' } as const;

interface Props {
  records: readonly PronunciationRecord[];
}

/** Resultado de la evaluación de pronunciación más reciente, y su comparación con la primera. */
export function PronunciationResults({ records }: Props) {
  const latest = latestPronunciation(records);
  if (!latest) return null;
  const first = firstPronunciation(records);
  const sounds = analyzeSounds(latest);
  const counts = countByClass(sounds);
  const order = workOrder(sounds, latest.ageYears);
  const processes = analyzeProcesses(latest);
  const changes = first && first.id !== latest.id ? compareSounds(analyzeSounds(first), sounds) : null;

  const groups: WorkItem['group'][] = ['temprano', 'edad', 'tardio'];

  return (
    <>
      <p className="chart-note">
        Evaluación del {formatDate(latest.completedAt!)} ({latest.ageYears} años) · {latest.kind === 'baseline' ? 'inicial' : 'reevaluación'}.
        La marcó el adulto: la app no califica la pronunciación.
      </p>

      <ul className="class-summary" aria-label="Sonidos por clasificación">
        {(['consolidado', 'estimular', 'esperable'] as const).map((c) => (
          <li key={c}>
            <strong>{counts[c]}</strong> <ClassLabel value={c} />
          </li>
        ))}
      </ul>

      <h3>Por sonido y posición</h3>
      <table className="table">
        <caption className="sr-only">Resultado por sonido y posición</caption>
        <thead>
          <tr>
            <th scope="col">Sonido</th>
            <th scope="col">Posición</th>
            <th scope="col">Estado</th>
            <th scope="col">Dijo</th>
            <th scope="col">Constancia</th>
            <th scope="col">Clasificación</th>
          </tr>
        </thead>
        <tbody>
          {sounds.flatMap((s) =>
            s.positions.map((p, i) => (
              <tr key={`${s.phonemeId}-${p.position}`}>
                <th scope="row">{i === 0 ? s.name : <span className="sr-only">{s.name}</span>}</th>
                <td>{POSITION_LABEL[p.position]}</td>
                <td>
                  {p.state === 'correcta' ? '✔ Correcta' : `✖ ${p.n - p.correct} de ${p.n} con error`}
                </td>
                <td>{p.substitution ? `“${p.substitution}”` : '—'}</td>
                <td>{p.consistency ?? '—'}</td>
                <td>{i === 0 ? <ClassLabel value={s.classification} /> : ''}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      <p className="chart-note">
        “Constante” = siempre lo dijo igual; “variable” = a veces bien y a veces de otra forma. Los sonidos de edades mayores
        marcados como “esperable para su edad” son metas suaves, no motivo de preocupación.
      </p>

      <h3>Orden de trabajo sugerido</h3>
      {order.length === 0 ? (
        <p>Todos los sonidos evaluados están consolidados.</p>
      ) : (
        groups.map((g) => {
          const list = order.filter((o) => o.group === g);
          if (list.length === 0) return null;
          return (
            <div key={g}>
              <h4>{WORK_GROUP_LABEL[g]}</h4>
              <ol>
                {list.map((o) => (
                  <li key={o.phonemeId}>
                    <strong>{o.name}</strong> ({Math.round(o.accuracy * 100)} % correcto)
                    {o.substitution && <> · suele decir “{o.substitution}”</>}
                    {o.soft && <> · opcional</>}
                  </li>
                ))}
              </ol>
            </div>
          );
        })
      )}

      {processes.length > 0 && (
        <>
          <h3>Mini revisión de procesos</h3>
          <table className="table">
            <caption className="sr-only">Procesos de simplificación observados</caption>
            <thead>
              <tr>
                <th scope="col">Proceso</th>
                <th scope="col">Resultado</th>
                <th scope="col">Palabras</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => (
                <tr key={p.process}>
                  <th scope="row">{PROCESS_LABEL[p.process]}</th>
                  <td>
                    {PROCESS_LEVEL[p.level]} ({p.affected} de {p.n})
                  </td>
                  <td>{p.words.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-note">A los 3 años es frecuente simplificar grupos de consonantes; es orientativo.</p>
        </>
      )}

      {changes && first && (
        <>
          <h3>Comparación con la primera evaluación ({formatDate(first.completedAt!)})</h3>
          <table className="table">
            <caption className="sr-only">Cambio por sonido entre la primera evaluación y la última</caption>
            <thead>
              <tr>
                <th scope="col">Sonido</th>
                <th scope="col">Antes</th>
                <th scope="col">Ahora</th>
                <th scope="col">Cambio</th>
                <th scope="col">Clasificación</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.phonemeId}>
                  <th scope="row">{c.name}</th>
                  <td>{c.before === null ? '—' : `${c.before} %`}</td>
                  <td>{c.after === null ? '—' : `${c.after} %`}</td>
                  <td>{c.delta === null ? '—' : c.delta === 0 ? 'sin cambio' : c.delta > 0 ? `▲ +${c.delta}` : `▼ ${c.delta}`}</td>
                  <td>
                    {c.beforeClass ? CLASSIFICATION_LABEL[c.beforeClass] : '—'} → {c.afterClass ? CLASSIFICATION_LABEL[c.afterClass] : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
