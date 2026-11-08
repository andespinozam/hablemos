import { ACTIVITIES } from '../activities/registry';
import content from '../content/guide.json';
import { go } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';

interface Section {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

const SECTIONS = content.sections as Section[];
const ACTIVITY_INFO = content.activities as Record<string, { what: string; adult: string }>;

/** Lleva al inicio de una sección. No usa enlaces con # porque la app usa el hash para sus rutas. */
function scrollTo(id: string) {
  const el = document.getElementById(`guia-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

export function Guide() {
  return (
    <main className="screen guide-screen">
      <header className="row">
        <h1 style={{ margin: 0 }}>Guía para adultos</h1>
        <span className="spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => go('adultos')}>
          ⬅️ Volver
        </button>
      </header>

      <p>{content.intro}</p>

      <nav aria-label="Contenido de la guía">
        <ul className="toc">
          {[...SECTIONS.map((s) => ({ id: s.id, title: s.title })), { id: 'problemas', title: 'Problemas frecuentes' }].map((s) => (
            <li key={s.id}>
              <button type="button" className="btn btn--ghost btn--small" onClick={() => scrollTo(s.id)}>
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {SECTIONS.map((s) => (
        <section key={s.id} className="card guide-section" aria-labelledby={`guia-${s.id}`}>
          <h2 id={`guia-${s.id}`} tabIndex={-1}>
            {s.title}
          </h2>
          {s.paragraphs?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {s.bullets && (
            <ul>
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {s.id === 'actividades' && (
            <ol className="activity-guide">
              {ACTIVITIES.map((a) => {
                const info = ACTIVITY_INFO[a.id];
                return (
                  <li key={a.id}>
                    <h3>
                      <span aria-hidden="true">{a.icon}</span> {a.title}
                    </h3>
                    {info && (
                      <>
                        <p>{info.what}</p>
                        <p className="chart-note">
                          <strong>Tu parte:</strong> {info.adult}
                        </p>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {s.id === 'alertas' && (
            <button type="button" className="btn btn--accent" onClick={() => go('adultos/alertas')}>
              ⚠️ Ver las señales de alerta
            </button>
          )}
        </section>
      ))}

      <section className="card guide-section" aria-labelledby="guia-problemas">
        <h2 id="guia-problemas" tabIndex={-1}>
          Problemas frecuentes
        </h2>
        {content.troubleshooting.map((t) => (
          <details key={t.q} className="faq">
            <summary>{t.q}</summary>
            <p>{t.a}</p>
          </details>
        ))}
      </section>

      <p className="note">{DISCLAIMER}</p>
    </main>
  );
}
