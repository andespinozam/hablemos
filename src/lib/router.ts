import { useEffect, useState } from 'react';

/** Router mínimo por hash (`#/ruta`): funciona sin servidor y en cualquier subruta. */
function currentRoute(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = `/${path}`;
}

export type AdultRoute =
  | { name: 'home' }
  | { name: 'nuevo' }
  | { name: 'editar'; id: string }
  | { name: 'seguimiento'; id: string }
  | { name: 'evaluacion'; id: string }
  | { name: 'evaluar'; id: string; kind: 'baseline' | 'reassessment' }
  | { name: 'pronunciacion'; id: string }
  | { name: 'escalera'; id: string }
  | { name: 'pronunciar'; id: string; recordId: string }
  | { name: 'reporte'; id: string }
  | { name: 'respaldo' }
  | { name: 'alertas' }
  | { name: 'guia' }
  | { name: 'voz' }
  | { name: 'grabar' }
  | { name: 'desconocida' };

/** Interpreta una ruta de la zona de adultos; null si la ruta no es de esa zona. */
export function parseAdultRoute(route: string): AdultRoute | null {
  if (route !== 'adultos' && !route.startsWith('adultos/')) return null;
  const [, a, b, c] = route.split('/');
  if (!a) return { name: 'home' };
  if (a === 'nuevo' && !b) return { name: 'nuevo' };
  if (a === 'respaldo' && !b) return { name: 'respaldo' };
  if (a === 'alertas' && !b) return { name: 'alertas' };
  if (a === 'guia' && !b) return { name: 'guia' };
  if (a === 'voz' && !b) return { name: 'voz' };
  if (a === 'grabar' && !b) return { name: 'grabar' };
  if (b && !c) {
    if (a === 'editar') return { name: 'editar', id: b };
    if (a === 'seguimiento') return { name: 'seguimiento', id: b };
    if (a === 'evaluacion') return { name: 'evaluacion', id: b };
    if (a === 'escalera') return { name: 'escalera', id: b };
    if (a === 'pronunciacion') return { name: 'pronunciacion', id: b };
    if (a === 'reporte') return { name: 'reporte', id: b };
  }
  if (a === 'pronunciar' && b && c) return { name: 'pronunciar', id: b, recordId: c };
  if (a === 'evaluar' && b && (c === 'baseline' || c === 'reassessment')) return { name: 'evaluar', id: b, kind: c };
  return { name: 'desconocida' };
}
