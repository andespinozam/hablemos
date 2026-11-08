import content from '../content/alerts.json';

interface Props {
  /** Si se da, se muestran las señales de esa edad (o la más cercana); si no, todas. */
  age?: number;
  /** Título (por defecto "Señales de alerta"). */
  heading?: string;
}

/** Señales de alerta orientativas, con la recomendación de consultar a un profesional. */
export function AlertSigns({ age, heading = 'Señales de alerta' }: Props) {
  const groups = age === undefined ? content.byAge : content.byAge.filter((g) => g.age === Math.min(5, Math.max(3, age)));
  return (
    <section className="card alerts" aria-labelledby="alerts-title">
      <h2 id="alerts-title">{heading}</h2>
      <p>{content.intro}</p>
      <h3>En cualquier edad</h3>
      <ul>
        {content.general.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {groups.map((g) => (
        <div key={g.age}>
          <h3>A los {g.age} años</h3>
          <ul>
            {g.signs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="note">{content.advice}</p>
    </section>
  );
}
