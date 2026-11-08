import { barWidth, contiguousRuns, polylinePoints, shortDate, xPositions, yFor } from '../lib/chartGeometry';
import type { WeekPoint } from '../lib/tracking';

/**
 * Gráficos SVG sin librerías. Reglas: valores escritos junto a cada marca (el color nunca es lo único
 * que identifica), tabla equivalente para lectores de pantalla, texto en color de tinta (no el de la serie).
 */

export interface BarRow {
  id: string;
  label: string;
  /** 0..100 o null si no hay datos. */
  value: number | null;
}

const fmt = (v: number | null) => (v === null ? 'sin datos' : `${v} %`);

/** Tabla equivalente para lectores de pantalla. */
function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  // Un <table> ignora width:1px, así que va dentro de un div que sí recorta (si no, ensancha la página).
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

const W = 600;
const LABEL_W = 210;
const BAR_X = LABEL_W + 10;
const BAR_W = 300;

/** Barras horizontales de una serie (logro por área, 0-100 %). */
export function BarChart({ rows, title }: { rows: BarRow[]; title: string }) {
  const rowH = 38;
  const h = rows.length * rowH + 8;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={`${title}: ${rows.map((r) => `${r.label} ${fmt(r.value)}`).join('; ')}`}>
        {rows.map((r, i) => {
          const y = 4 + i * rowH;
          const bw = barWidth(r.value, BAR_W);
          return (
            <g key={r.id}>
              <text x={0} y={y + 22} className="chart__label">
                {r.label}
              </text>
              <rect x={BAR_X} y={y + 10} width={BAR_W} height={14} rx={7} className="chart__track" />
              {bw > 0 && <rect x={BAR_X} y={y + 10} width={Math.max(bw, 8)} height={14} rx={4} className="chart__bar" />}
              <text x={BAR_X + BAR_W + 12} y={y + 22} className="chart__value">
                {fmt(r.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <SrTable caption={title} head={['Área', 'Logro']} rows={rows.map((r) => [r.label, fmt(r.value)])} />
    </figure>
  );
}

export interface CompareRow {
  id: string;
  label: string;
  baseline: number | null;
  current: number | null;
}

/** Dos series (evaluación inicial y la más reciente) por área, con leyenda y valores escritos. */
export function CompareChart({ rows, title, baselineLabel, currentLabel }: { rows: CompareRow[]; title: string; baselineLabel: string; currentLabel: string }) {
  const rowH = 62;
  const top = 34;
  const h = top + rows.length * rowH + 4;
  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${h}`}
        role="img"
        aria-label={`${title}: ${rows.map((r) => `${r.label}, inicial ${fmt(r.baseline)}, actual ${fmt(r.current)}`).join('; ')}`}
      >
        <g className="chart__legend">
          <rect x={0} y={4} width={14} height={14} rx={3} className="chart__bar chart__bar--baseline" />
          <text x={22} y={16} className="chart__label">
            {baselineLabel}
          </text>
          <rect x={250} y={4} width={14} height={14} rx={3} className="chart__bar" />
          <text x={272} y={16} className="chart__label">
            {currentLabel}
          </text>
        </g>
        {rows.map((r, i) => {
          const y = top + i * rowH;
          const bars: [number | null, string][] = [
            [r.baseline, 'chart__bar chart__bar--baseline'],
            [r.current, 'chart__bar'],
          ];
          return (
            <g key={r.id}>
              <text x={0} y={y + 24} className="chart__label">
                {r.label}
              </text>
              {bars.map(([v, cls], k) => {
                const by = y + 6 + k * 18; // 2 px de separación entre las dos barras
                const bw = barWidth(v, BAR_W);
                return (
                  <g key={k}>
                    {bw > 0 && <rect x={BAR_X} y={by} width={Math.max(bw, 8)} height={16} rx={4} className={cls} />}
                    <text x={BAR_X + Math.max(bw, 8) + 8} y={by + 13} className="chart__value">
                      {fmt(v)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      <SrTable
        caption={title}
        head={['Área', baselineLabel, currentLabel]}
        rows={rows.map((r) => [r.label, fmt(r.baseline), fmt(r.current)])}
      />
    </figure>
  );
}

/** Línea de logro semanal (0-100 %). Las semanas sin práctica cortan la línea. */
export function TrendChart({ points, title }: { points: WeekPoint[]; title: string }) {
  const w = 600;
  const h = 230;
  const left = 44;
  const right = 24;
  const top = 18;
  const bottom = 36;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const xs = xPositions(points.length, left + 12, plotW - 24);
  const values = points.map((p) => p.percent);
  const ys = values.map((v) => (v === null ? 0 : yFor(v, top, plotH)));
  const runs = contiguousRuns(values);
  const lastIdx = values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
  const summary = points.map((p) => `semana del ${shortDate(p.start)}: ${fmt(p.percent)}`).join('; ');

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${title}. ${summary}`}>
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={left} x2={w - right} y1={yFor(g, top, plotH)} y2={yFor(g, top, plotH)} className="chart__grid" />
            <text x={left - 8} y={yFor(g, top, plotH) + 5} textAnchor="end" className="chart__axis">
              {g} %
            </text>
          </g>
        ))}
        {runs.map((run) => (
          <polyline key={run[0]} points={polylinePoints(xs, ys, run)} fill="none" className="chart__line" />
        ))}
        {points.map((p, i) => (
          <g key={p.start}>
            <text x={xs[i]} y={h - 12} textAnchor="middle" className="chart__axis">
              {shortDate(p.start)}
            </text>
            {values[i] !== null && <circle cx={xs[i]} cy={ys[i]} r={5} className="chart__dot" />}
          </g>
        ))}
        {lastIdx >= 0 && (
          <text x={xs[lastIdx]} y={ys[lastIdx] - 12} textAnchor="middle" className="chart__value">
            {values[lastIdx]} %
          </text>
        )}
        {lastIdx < 0 && (
          <text x={w / 2} y={h / 2} textAnchor="middle" className="chart__axis">
            Aún no hay práctica en estas semanas
          </text>
        )}
      </svg>
      <SrTable caption={title} head={['Semana (lunes)', 'Logro', 'Ítems']} rows={points.map((p) => [shortDate(p.start), fmt(p.percent), String(p.n)])} />
    </figure>
  );
}
