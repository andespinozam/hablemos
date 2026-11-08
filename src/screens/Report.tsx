import { ACTIVITIES } from '../activities/registry';
import { AlertSigns } from '../components/AlertSigns';
import { BarChart, CompareChart, TrendChart } from '../components/Charts';
import { LadderSummary } from '../components/LadderSummary';
import { PronunciationResults } from '../components/PronunciationResults';
import { formatDate } from '../components/ReassessmentBanner';
import { ageInYears, formatAge } from '../lib/age';
import {
  AREA_LABELS,
  ASSESSMENT_AREAS,
  areaPercents,
  compareAreas,
  latestBaseline,
  latestReassessment,
  lowAreas,
  reassessmentStatus,
} from '../lib/assessment';
import { resultsOfAssessment } from '../lib/assessmentStore';
import type { ChildProfile } from '../lib/db';
import { getPhoneme } from '../lib/phonemes';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';
import { phonemeProgress, practiceResults, practiceSessionCount, streaks, weeklyTrend } from '../lib/tracking';
import { useChildData } from '../lib/useChildData';

const AREA_ORDER = ['receptivo', 'expresivo', 'ordenes', 'conceptos', 'frases', 'fonemas', 'discriminacion', 'praxias', 'narrativa'];

/** Reporte por niño, pensado para imprimir o guardar como PDF (window.print + CSS de impresión). */
export function Report({ profile }: { profile: ChildProfile }) {
  const state = useChildData(profile.id);
  const now = new Date();

  return (
    <main className="screen report">
      <div className="row no-print">
        <button type="button" className="btn btn--ghost" onClick={() => go(`adultos/seguimiento/${profile.id}`)}>
          ⬅️ Volver
        </button>
        <span className="spacer" />
        <button type="button" className="btn btn--good" onClick={() => window.print()}>
          🖨️ Imprimir o guardar PDF
        </button>
      </div>

      <header className="report__head">
        <h1>Reporte de lenguaje · Hablemos</h1>
        <p>
          <strong>{profile.name}</strong> · {formatAge(profile.birthDate, now)} · generado el {formatDate(now.getTime())}
        </p>
      </header>

      {state.status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {state.status === 'error' && (
        <p className="error-text" role="alert">
          No se pudieron leer los datos del dispositivo.
        </p>
      )}

      {state.status === 'ready' &&
        (() => {
          const { results, sessions, assessments, levels, pronunciation, ladders } = state.data;
          const practice = practiceResults(results, sessions);
          const percents = areaPercents(practice);
          const areaRows = AREA_ORDER.filter((id) => percents[id] !== undefined).map((id) => ({ id, label: AREA_LABELS[id] ?? id, value: percents[id] ?? null }));
          const phonemes = phonemeProgress(practice);
          const s = streaks(results, sessions, now);
          const baseline = latestBaseline(assessments);
          const reassessment = latestReassessment(assessments);
          const basePct = baseline ? areaPercents(resultsOfAssessment(results, baseline)) : {};
          const rePct = reassessment ? areaPercents(resultsOfAssessment(results, reassessment)) : null;
          const status = reassessmentStatus(assessments, now.getTime());
          const flagged = lowAreas(rePct ?? basePct);

          return (
            <>
              <section className="report-section">
                <h2>Resumen</h2>
                <ul>
                  <li>Sesiones de práctica: {practiceSessionCount(results, sessions)}</li>
                  <li>
                    Días con práctica: {s.daysPracticed} (racha actual: {s.current}, mejor racha: {s.best})
                  </li>
                  <li>
                    Evaluación inicial: {baseline ? `${formatDate(baseline.completedAt!)} (${baseline.ageYears} años)` : 'aún no realizada'}
                  </li>
                  {reassessment && <li>Última reevaluación: {formatDate(reassessment.completedAt!)}</li>}
                  <li>
                    {status.state === 'due'
                      ? 'Se sugiere una reevaluación (han pasado 4 semanas o más).'
                      : status.state === 'ok'
                        ? `Próxima reevaluación sugerida: ${formatDate(status.dueAt)}.`
                        : 'Se sugiere hacer la evaluación inicial.'}
                  </li>
                </ul>
              </section>

              {baseline && (
                <section className="report-section">
                  <h2>{rePct ? 'Evaluación inicial y reevaluación' : 'Evaluación inicial'}</h2>
                  {rePct ? (
                    <>
                      <CompareChart
                        title="Comparación por área"
                        baselineLabel="Evaluación inicial"
                        currentLabel="Reevaluación"
                        rows={compareAreas(basePct, rePct).map((r) => ({ id: r.area, label: r.label, baseline: r.baseline, current: r.current }))}
                      />
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Área</th>
                            <th scope="col">Inicial</th>
                            <th scope="col">Reevaluación</th>
                            <th scope="col">Cambio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareAreas(basePct, rePct).map((r) => (
                            <tr key={r.area}>
                              <th scope="row">{r.label}</th>
                              <td>{r.baseline === null ? '—' : `${r.baseline} %`}</td>
                              <td>{r.current === null ? '—' : `${r.current} %`}</td>
                              <td>{r.delta === null ? '—' : r.delta === 0 ? 'sin cambio' : r.delta > 0 ? `▲ +${r.delta}` : `▼ ${r.delta}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <BarChart title="Resultado por área" rows={ASSESSMENT_AREAS.map((a) => ({ id: a.id, label: a.label, value: basePct[a.id] ?? null }))} />
                  )}
                  {flagged.length > 0 && (
                    <p className="note">
                      El logro fue bajo en {flagged.map((id) => AREA_LABELS[id].toLowerCase()).join(' y ')}. No es un diagnóstico: se
                      recomienda comentarlo con un fonoaudiólogo o con el pediatra.
                    </p>
                  )}
                </section>
              )}

              {pronunciation.some((r) => r.completedAt !== undefined) && (
                <section className="report-section">
                  <h2>Evaluación de pronunciación</h2>
                  <PronunciationResults records={pronunciation} ladders={ladders} />
                </section>
              )}

              {ladders.length > 0 && (
                <section className="report-section">
                  <h2>Escalera de pronunciación</h2>
                  <LadderSummary ladders={ladders} />
                  <p className="chart-note">Sube de escalón con “Lo logró” en 3 sesiones distintas. La sustitución es la observada y marcada por el adulto.</p>
                </section>
              )}

              {practice.length > 0 && (
                <>
                  <section className="report-section">
                    <h2>Logro en la práctica, por área</h2>
                    <p className="chart-note">Lo logró = 100 %, Con ayuda = 50 %, Aún no = 0 %.</p>
                    <BarChart rows={areaRows} title="Logro por área de lenguaje" />
                  </section>
                  <section className="report-section">
                    <h2>Tendencia semanal</h2>
                    <TrendChart points={weeklyTrend(practice, now, 8)} title="Logro por semana, últimas 8 semanas" />
                  </section>
                  {phonemes.length > 0 && (
                    <section className="report-section">
                      <h2>Logro por fonema</h2>
                      <table className="table">
                        <thead>
                          <tr>
                            <th scope="col">Fonema</th>
                            <th scope="col">Ítems</th>
                            <th scope="col">Logro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phonemes.map((p) => (
                            <tr key={p.phoneme}>
                              <th scope="row">{getPhoneme(p.phoneme)?.name ?? p.phoneme}</th>
                              <td>{p.n}</td>
                              <td>{p.percent} %</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </>
              )}

              <section className="report-section">
                <h2>Nivel actual por actividad</h2>
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Actividad</th>
                      <th scope="col">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIVITIES.map((a) => (
                      <tr key={a.id}>
                        <th scope="row">{a.title}</th>
                        <td>
                          {Math.min(levels[a.id] ?? 1, a.maxLevel)} de {a.maxLevel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <div className="report-section">
                <AlertSigns age={ageInYears(profile.birthDate, now) ?? undefined} />
              </div>
            </>
          );
        })()}

      <footer className="report__foot">
        <p>{DISCLAIMER}</p>
        <p>Los resultados dependen de la calificación del adulto que acompañó cada ejercicio. La app no califica la pronunciación.</p>
      </footer>
    </main>
  );
}
