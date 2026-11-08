import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../activities/registry';
import content from '../content/guide.json';
import { REASSESSMENT_DAYS } from '../lib/assessment';
import { planSize } from '../lib/assessmentPlan';
import { HOLD_MS } from '../lib/gate';
import { DOWN_THRESHOLD, SESSIONS_TO_LEVEL_UP, UP_THRESHOLD } from '../lib/level';
import { parseAdultRoute } from '../lib/router';
import { DISCLAIMER } from '../lib/texts';
import { titleFor } from '../App';

const all = JSON.stringify(content);
const text = (id: string) => {
  const s = content.sections.find((x) => x.id === id)!;
  return [...(s.paragraphs ?? []), ...(s.bullets ?? [])].join(' ');
};

describe('contenido de la guía', () => {
  it('explica cada actividad del registro, y solo las que existen', () => {
    const info = content.activities as Record<string, { what: string; adult: string }>;
    expect(Object.keys(info).sort()).toEqual(ACTIVITIES.map((a) => a.id).sort());
    for (const a of ACTIVITIES) {
      expect(info[a.id].what.length, a.id).toBeGreaterThan(20);
      expect(info[a.id].adult.length, a.id).toBeGreaterThan(10);
    }
  });

  it('dice quién califica: las actividades que califica el adulto lo mencionan y las demás no lo piden', () => {
    const info = content.activities as Record<string, { adult: string }>;
    for (const a of ACTIVITIES) {
      if (a.adultRated) expect(info[a.id].adult, a.id).toMatch(/Tú calificas/);
      else expect(info[a.id].adult, a.id).toMatch(/Se califica sola/);
    }
  });

  it('cada sección tiene id único, título y contenido', () => {
    const ids = content.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of content.sections) {
      expect(s.title.length).toBeGreaterThan(3);
      if (s.id !== 'actividades') {
        const body = [...((s as { paragraphs?: string[] }).paragraphs ?? []), ...((s as { bullets?: string[] }).bullets ?? [])];
        expect(body.length, s.id).toBeGreaterThan(0);
      }
    }
    for (const id of ['empezar', 'sesion', 'tu-papel', 'actividades', 'niveles', 'evaluacion', 'seguimiento', 'privacidad', 'alertas']) {
      expect(ids, id).toContain(id);
    }
  });

  it('los números de la guía coinciden con los del código', () => {
    expect(text('niveles')).toContain(`${Math.round(UP_THRESHOLD * 100)} %`);
    expect(text('niveles')).toContain(`${SESSIONS_TO_LEVEL_UP} sesiones`);
    expect(text('niveles')).toContain(`${Math.round(DOWN_THRESHOLD * 100)} %`);
    expect(text('evaluacion')).toContain(`${planSize()} ejercicios`);
    expect(text('evaluacion')).toContain(`${REASSESSMENT_DAYS / 7} semanas`);
    expect(text('empezar')).toContain(`${HOLD_MS / 1000} segundos`);
    expect(text('tu-papel')).toContain('100 %');
    expect(text('tu-papel')).toContain('50 %');
    expect(text('tu-papel')).toContain('0 %');
  });

  it('aclara que la app no califica la pronunciación, y repite la nota de alcance', () => {
    expect(text('tu-papel')).toMatch(/NO califica la pronunciación/);
    expect(text('alertas')).toContain(DISCLAIMER);
  });

  it('incluye soluciones a problemas frecuentes (voz, datos, sin conexión, iPad)', () => {
    const qa = content.troubleshooting.map((t) => `${t.q} ${t.a}`).join(' ');
    expect(qa).toMatch(/voz/);
    expect(qa).toMatch(/respaldo/i);
    expect(qa).toMatch(/sin internet|sin conexión/);
    expect(qa).toMatch(/iPad/);
    for (const t of content.troubleshooting) {
      expect(t.q.length).toBeGreaterThan(5);
      expect(t.a.length).toBeGreaterThan(20);
    }
  });

  it('no promete cosas que la app no hace', () => {
    expect(all.toLowerCase()).not.toContain('diagnostica');
    expect(all.toLowerCase()).not.toContain('cuenta de usuario');
    expect(content.sections.find((s) => s.id === 'privacidad')!.paragraphs!.join(' ')).toMatch(/sin internet/);
  });
});

describe('ruta de la guía', () => {
  it('se reconoce y tiene título propio', () => {
    expect(parseAdultRoute('adultos/guia')).toEqual({ name: 'guia' });
    expect(parseAdultRoute('adultos/guia/x')).toEqual({ name: 'desconocida' });
    expect(titleFor('adultos/guia')).toBe('Guía para adultos · Hablemos');
  });
});
