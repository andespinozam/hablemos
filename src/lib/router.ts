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
