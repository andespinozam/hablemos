import { ACTIVITIES } from '../activities/registry';
import { BarChart, CompareChart } from '../components/Charts';
import { ReassessmentBanner, formatDate } from '../components/ReassessmentBanner';
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
import { planSize } from '../lib/assessmentPlan';
import { resultsOfAssessment } from '../lib/assessmentStore';
import type { ChildProfile } from '../lib/db';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';
import { useChildData } from '../lib/useChildData';

const MINUTES = 15;

function deltaText(delta: number | null): string {
  if (delta === null) return '—';
  if (delta === 0) return 'sin cambio';
  // Signo y flecha además del color: nunca solo color.
  return delta > 0 ? `▲ +${delta} puntos` : `▼ ${delta} puntos`;
}

export function AssessmentHome({ profile }: { profile: ChildProfile }) {
  const state = useChildData(profile.id);
  const back = () => go(`adultos/seguimiento/${profile.id}`);

  return (
    <main className="screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Evaluación de {profile.name}</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={back}>
          ⬅️ Volver
        </button>
      </header>

      {state.status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {state.status === 'error' && (
        <p className="error-text" role="alert">
          No se pudieron leer los datos del dispositivo.
        </p>
      )}

      {state.status === 'ready' &&
        (() => {
          const { results, assessments } = state.data;
          const baseline = latestBaseline(assessments);
          const reassessment = latestReassessment(assessments);
          const incomplete = assessments.filter((a) => a.completedAt === undefined);
          const status = reassessmentStatus(assessments, Date.now());
          const basePct = baseline ? areaPercents(resultsOfAssessment(results, baseline)) : {};
          const rePct = reassessment ? areaPercents(resultsOfAssessment(results, reassessment)) : null;
          const rows = compareAreas(basePct, rePct ?? {});
          const flagged = lowAreas(rePct ?? basePct);

          return (
            <>
              <ReassessmentBanner status={status} />

              {!baseline ? (
                <section className="card" aria-labelledby="how-title">
                  <h2 id="how-title">Evaluación inicial</h2>
                  <p>
                    Dura unos {MINUTES} minutos ({planSize()} ejercicios) y sirve para conocer el punto de partida y elegir el
                    nivel con el que empieza cada actividad.
                  </p>
                  <ul>
                    <li>Siéntate junto a {profile.name}. La app dice cada instrucción en voz alta.</li>
                    <li>En los ejercicios de decir palabras, marca en tu panel &quot;Lo logró&quot;, &quot;Con ayuda&quot; o &quot;Aún no&quot;.</li>
                    <li>Durante la evaluación no corrijas ni ayudes: para eso están las sesiones de práctica.</li>
                    <li>Si la detienes a la mitad no cuenta como evaluación inicial; podrás empezar otra.</li>
                  </ul>
                  <p className="chart-note">Áreas: {ASSESSMENT_AREAS.map((a) => a.label).join(', ')}.</p>
                  <button type="button" className="btn btn--good btn--big" onClick={() => go(`adultos/evaluar/${profile.id}/baseline`)}>
                    ▶ Empezar evaluación inicial
                  </button>
                  {incomplete.length > 0 && (
                    <p className="note" style={{ marginTop: 16 }}>
                      Hay {incomplete.length} {incomplete.length === 1 ? 'evaluación a medias' : 'evaluaciones a medias'} que no se cuentan.
                    </p>
                  )}
                </section>
              ) : (
                <>
                  <section className="card" aria-labelledby="base-title">
                    <h2 id="base-title">{rePct ? 'Inicial y reevaluación' : 'Resultado de la evaluación inicial'}</h2>
                    <p className="chart-note">
                      Evaluación inicial del {formatDate(baseline.completedAt!)} ({baseline.ageYears} años)
                      {reassessment && <> · Reevaluación del {formatDate(reassessment.completedAt!)}</>}
                    </p>
                    {rePct ? (
                      <CompareChart
                        title="Comparación por área"
                        baselineLabel="Evaluación inicial"
                        currentLabel="Reevaluación"
                        rows={rows.map((r) => ({ id: r.area, label: r.label, baseline: r.baseline, current: r.current }))}
                      />
                    ) : (
                      <BarChart
                        title="Resultado por área"
                        rows={ASSESSMENT_AREAS.map((a) => ({ id: a.id, label: a.label, value: basePct[a.id] ?? null }))}
                      />
                    )}
                  </section>

                  {rePct && (
                    <section className="card" aria-labelledby="delta-title">
                      <h2 id="delta-title">Cambio desde la evaluación inicial</h2>
                      <table className="table">
                        <caption className="sr-only">Cambio por área entre la evaluación inicial y la reevaluación</caption>
                        <thead>
                          <tr>
                            <th scope="col">Área</th>
                            <th scope="col">Inicial</th>
                            <th scope="col">Reevaluación</th>
                            <th scope="col">Cambio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.area}>
                              <th scope="row">{r.label}</th>
                              <td>{r.baseline === null ? '—' : `${r.baseline} %`}</td>
                              <td>{r.current === null ? '—' : `${r.current} %`}</td>
                              <td>{deltaText(r.delta)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}

                  <section className="card" aria-labelledby="lv-title">
                    <h2 id="lv-title">Nivel de partida recomendado</h2>
                    <table className="table">
                      <caption className="sr-only">Nivel recomendado por actividad</caption>
                      <thead>
                        <tr>
                          <th scope="col">Actividad</th>
                          <th scope="col">Nivel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ACTIVITIES.filter((a) => baseline.recommendedLevels?.[a.id] !== undefined).map((a) => (
                          <tr key={a.id}>
                            <th scope="row">
                              <span aria-hidden="true">{a.icon}</span> {a.title}
                            </th>
                            <td>
                              {baseline.recommendedLevels![a.id]} de {a.maxLevel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>

                  {flagged.length > 0 && (
                    <p className="notice notice--due" role="note">
                      <span aria-hidden="true">💬</span>
                      <span>
                        En {flagged.map((id) => AREA_LABELS[id].toLowerCase()).join(' y ')} el logro fue bajo. Este resultado no es un
                        diagnóstico; si te preocupa, conviene comentarlo con un fonoaudiólogo o con el pediatra.
                      </span>
                    </p>
                  )}

                  <section className="card" aria-labelledby="re-title">
                    <h2 id="re-title">Reevaluación</h2>
                    <p>
                      Se repiten <strong>los mismos ejercicios</strong> de la evaluación inicial, en otro orden, para ver cuánto ha
                      cambiado. Se sugiere cada 4 semanas. No cambia los niveles de las actividades.
                    </p>
                    <button type="button" className="btn btn--accent" onClick={() => go(`adultos/evaluar/${profile.id}/reassessment`)}>
                      🔁 Reevaluar con los mismos ítems
                    </button>
                  </section>
                </>
              )}

              <p className="note">{DISCLAIMER}</p>
            </>
          );
        })()}
    </main>
  );
}
