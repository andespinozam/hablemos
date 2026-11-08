import { describe, expect, it } from 'vitest';
import { parseAdultRoute } from './router';

describe('parseAdultRoute', () => {
  it('rutas fuera de la zona de adultos devuelven null', () => {
    for (const r of ['', 'inicio', 'jugar', 'puerta', 'adultosx', 'otra/adultos']) expect(parseAdultRoute(r)).toBeNull();
  });
  it('reconoce cada pantalla', () => {
    expect(parseAdultRoute('adultos')).toEqual({ name: 'home' });
    expect(parseAdultRoute('adultos/nuevo')).toEqual({ name: 'nuevo' });
    expect(parseAdultRoute('adultos/editar/abc')).toEqual({ name: 'editar', id: 'abc' });
    expect(parseAdultRoute('adultos/seguimiento/abc')).toEqual({ name: 'seguimiento', id: 'abc' });
    expect(parseAdultRoute('adultos/evaluacion/abc')).toEqual({ name: 'evaluacion', id: 'abc' });
    expect(parseAdultRoute('adultos/reporte/abc')).toEqual({ name: 'reporte', id: 'abc' });
    expect(parseAdultRoute('adultos/respaldo')).toEqual({ name: 'respaldo' });
    expect(parseAdultRoute('adultos/alertas')).toEqual({ name: 'alertas' });
    expect(parseAdultRoute('adultos/voz')).toEqual({ name: 'voz' });
    expect(parseAdultRoute('adultos/grabar')).toEqual({ name: 'grabar' });
    expect(parseAdultRoute('adultos/pronunciacion/abc')).toEqual({ name: 'pronunciacion', id: 'abc' });
    expect(parseAdultRoute('adultos/escalera/abc')).toEqual({ name: 'escalera', id: 'abc' });
    expect(parseAdultRoute('adultos/pronunciar/abc/r1')).toEqual({ name: 'pronunciar', id: 'abc', recordId: 'r1' });
    expect(parseAdultRoute('adultos/evaluar/abc/baseline')).toEqual({ name: 'evaluar', id: 'abc', kind: 'baseline' });
    expect(parseAdultRoute('adultos/evaluar/abc/reassessment')).toEqual({ name: 'evaluar', id: 'abc', kind: 'reassessment' });
  });
  it('rutas mal formadas son desconocidas, no se rompen', () => {
    for (const r of ['adultos/nada', 'adultos/evaluar/abc', 'adultos/evaluar/abc/otro', 'adultos/editar', 'adultos/seguimiento/a/b', 'adultos/respaldo/x', 'adultos/pronunciar/abc', 'adultos/pronunciacion/a/b']) {
      expect(parseAdultRoute(r)).toEqual({ name: 'desconocida' });
    }
  });
});
