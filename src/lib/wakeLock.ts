/**
 * Wake Lock: evita que la pantalla se apague mientras el niño juega. El navegador lo suelta solo
 * al ocultar la pestaña, así que se vuelve a pedir al regresar. Si no hay soporte (Safari < 16.4)
 * o el sistema lo rechaza (ahorro de batería), la app sigue funcionando sin él.
 */
import { useEffect } from 'react';

interface Sentinel {
  release(): Promise<void>;
}
interface NavLike {
  wakeLock?: { request(type: 'screen'): Promise<Sentinel> };
}
interface DocLike {
  visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface WakeLockController {
  /** Empieza a mantener la pantalla encendida. Devuelve si se logró. */
  start(): Promise<boolean>;
  /** Deja de mantenerla y limpia los oyentes. */
  stop(): Promise<void>;
}

export function isWakeLockSupported(nav: NavLike = navigator as NavLike): boolean {
  return typeof nav.wakeLock?.request === 'function';
}

export function createWakeLock(nav: NavLike = navigator as NavLike, doc: DocLike = document): WakeLockController {
  let sentinel: Sentinel | null = null;
  let wanted = false;

  const acquire = async (): Promise<boolean> => {
    if (!isWakeLockSupported(nav) || sentinel) return sentinel !== null;
    try {
      sentinel = await nav.wakeLock!.request('screen');
      // Si mientras tanto se pidió parar, se suelta de inmediato.
      if (!wanted) {
        await sentinel.release().catch(() => undefined);
        sentinel = null;
        return false;
      }
      return true;
    } catch {
      sentinel = null; // p. ej. ahorro de batería: no es un error de la app
      return false;
    }
  };

  const onVisibility = () => {
    if (doc.visibilityState === 'visible' && wanted) {
      sentinel = null; // el navegador ya lo soltó al ocultarse
      void acquire();
    }
  };

  return {
    async start() {
      wanted = true;
      doc.addEventListener('visibilitychange', onVisibility);
      return acquire();
    },
    async stop() {
      wanted = false;
      doc.removeEventListener('visibilitychange', onVisibility);
      const s = sentinel;
      sentinel = null;
      if (s) await s.release().catch(() => undefined);
    },
  };
}

/** Mantiene la pantalla encendida mientras `active` sea true. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const lock = createWakeLock();
    void lock.start();
    return () => {
      void lock.stop();
    };
  }, [active]);
}
