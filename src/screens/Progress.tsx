import { ACTIVITIES } from '../activities/registry';
import { AlertSigns } from '../components/AlertSigns';
import { BarChart, TrendChart } from '../components/Charts';
import { PronunciationResults } from '../components/PronunciationResults';
import { ReassessmentBanner } from '../components/ReassessmentBanner';
import { ageInYears, formatAge } from '../lib/age';
import { AREA_LABELS, areaPercents, reassessmentStatus } from '../lib/assessment';
import type { ChildProfile } from '../lib/db';
import { getPhoneme } from '../lib/phonemes';
import { latestPronunciation, pronunciationStatus } from '../lib/pronunciation';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';
import { phonemeProgress, practiceResults, practiceSessionCount, streaks, weeklyTrend } from '../lib/tracking';
import { useChildData } from '../lib/useChildData';

const AREA_ORDER = ['receptivo', 'expresivo', 'ordenes', 'conceptos', 'frases', 'fonemas', 'discriminacion', 'praxias', 'narrativa'];

export function Progress({ profile }: { profile: ChildProfile }) {
  const state = useChildData(profile.id);
  const now = new Date();
  const age = formatAge(profile.birthDate, now);

  return (
    <main className="screen">
      <header className="row">
        <span className="avatar avatar--small" aria-hidden="true">
          {profile.avatar}
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--fs-big)' }}>Seguimiento de {profile.name}</h1>
          <small>{age}</small>
        </div>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go('adultos')}>
          ⬅️ Volver
        </button>
      </header>

      <nav className="row no-print" aria-label="Acciones del niño">
        <button type="button" className="btn btn--accent" onClick={() => go(`adultos/evaluacion/${profile.id}`)}>
          📝 Evaluación
        </button>
        <button type="button" className="btn btn--accent" onClick={() => go(`adultos/pronunciacion/${profile.id}`)}>
          🗣️ Pronunciación
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => go(`adultos/reporte/${profile.id}`)}>
          🖨️ Reporte
        </button>
      </nav>

      {state.status === 'loading' && <p aria-busy="true">Cargando…</p>}
      {state.status === 'error' && (
        <p className="error-text" role="alert">
          No se pudieron leer los datos del dispositivo.
        </p>
      )}

      {state.status === 'ready' &&
        (() => {
          const { results, sessions, assessments, levels, pronunciation } = state.data;
          const practice = practiceResults(results, sessions);
          const percents = areaPercents(practice);
          const rows = AREA_ORDER.filter((id) => percents[id] !== undefined).map((id) => ({ id, label: AREA_LABELS[id] ?? id, value: percents[id] ?? null }));
          const trend = weeklyTrend(practice, now, 8);
          const phonemes = phonemeProgress(practice);
          const s = streaks(results, sessions, now);
          const sessionCount = practiceSessionCount(results, sessions);
          return (
            <>
              <ReassessmentBanner
                status={reassessmentStatus(assessments, now.getTime())}
                onStart={() => go(`adultos/evaluacion/${profile.id}`)}
              />

              <section aria-labelledby="streak-title">
                <h2 id="streak-title">Constancia</h2>
                <div className="stats">
                  <Stat value={s.current} label={s.current === 1 ? 'día seguido' : 'días seguidos'} hint="racha actual" />
                  <Stat value={s.best} label={s.best === 1 ? 'día' : 'días'} hint="mejor racha" />
                  <Stat value={s.last7} label="de 7 días" hint="con práctica esta semana" />
                  <Stat value={sessionCount} label={sessionCount === 1 ? 'sesión' : 'sesiones'} hint="de práctica en total" />
                </div>
              </section>

              {practice.length === 0 ? (
                <p className="note">Aún no hay práctica registrada. Cuando {profile.name} juegue, aquí aparecerá su progreso.</p>
              ) : (
                <>
                  <section className="card" aria-labelledby="area-title">
                    <h2 id="area-title">Logro por área</h2>
                    <p className="chart-note">Lo logró = 100 %, Con ayuda = 50 %, Aún no = 0 %.</p>
                    <BarChart rows={rows} title="Logro por área de lenguaje" />
                  </section>

                  <section className="card" aria-labelledby="trend-title">
                    <h2 id="trend-title">Tendencia semanal</h2>
                    <TrendChart points={trend} title="Logro por semana, últimas 8 semanas" />
                  </section>

                  <section className="card" aria-labelledby="ph-title">
                    <h2 id="ph-title">Logro por fonema</h2>
                    {phonemes.length === 0 ? (
                      <p>Aún no se han trabajado fonemas.</p>
                    ) : (
                      <table className="table">
                        <caption className="sr-only">Logro por fonema, de menor a mayor</caption>
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
                              <td>
                                <span className="meter" aria-hidden="true">
                                  <span style={{ width: `${p.percent}%` }} />
                                </span>{' '}
                                {p.percent} %
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </>
              )}

              <section className="card" aria-labelledby="pron-title">
                <h2 id="pron-title">Pronunciación</h2>
                {latestPronunciation(pronunciation) ? (
                  <>
                    {pronunciationStatus(pronunciation, now.getTime()).state === 'due' && (
                      <p className="notice notice--due" role="note">
                        <span aria-hidden="true">⏰</span>
                        <span>Se sugiere reevaluar la pronunciación (pasaron más de 4 semanas).</span>
                      </p>
                    )}
                    <PronunciationResults records={pronunciation} />
                  </>
                ) : (
                  <p>Aún no hay una evaluación de pronunciación terminada.</p>
                )}
                <button type="button" className="btn btn--ghost no-print" onClick={() => go(`adultos/pronunciacion/${profile.id}`)}>
                  🗣️ Ir a la evaluación de pronunciación
                </button>
              </section>

              <section className="card" aria-labelledby="lv-title">
                <h2 id="lv-title">Nivel actual por actividad</h2>
                <table className="table">
                  <caption className="sr-only">Nivel actual de cada actividad</caption>
                  <thead>
                    <tr>
                      <th scope="col">Actividad</th>
                      <th scope="col">Nivel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIVITIES.map((a) => (
                      <tr key={a.id}>
                        <th scope="row">
                          <span aria-hidden="true">{a.icon}</span> {a.title}
                        </th>
                        <td>
                          {Math.min(levels[a.id] ?? 1, a.maxLevel)} de {a.maxLevel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <AlertSigns age={ageInYears(profile.birthDate, now) ?? undefined} />
            </>
          );
        })()}

      <p className="note">{DISCLAIMER}</p>
    </main>
  );
}

function Stat({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{hint}</small>
    </div>
  );
}
