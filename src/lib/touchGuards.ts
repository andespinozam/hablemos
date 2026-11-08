/**
 * Evita zoom accidental (pellizco, gestos de iOS, doble toque) y "pull to refresh" en las
 * pantallas del NIÑO. `overscroll-behavior: none` y `touch-action: manipulation` ya están en
 * global.css; esto cubre Safari, que ignora `user-scalable=no`.
 *
 * En la zona de adultos el zoom se permite (accesibilidad: baja visión): ver `setZoomLocked`.
 */

const LOCKED_VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
const FREE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

let zoomLocked = true;

/** Bloquea (niño) o permite (adultos) el zoom: actualiza la meta viewport y las guardas táctiles. */
export function setZoomLocked(locked: boolean): void {
  zoomLocked = locked;
  document.querySelector?.('meta[name="viewport"]')?.setAttribute('content', locked ? LOCKED_VIEWPORT : FREE_VIEWPORT);
}

export function isZoomLocked(): boolean {
  return zoomLocked;
}

export function installTouchGuards(): () => void {
  const prevent = (e: Event) => {
    if (zoomLocked) e.preventDefault();
  };
  const onTouchMove = (e: TouchEvent) => {
    if (zoomLocked && e.touches.length > 1) e.preventDefault();
  };
  let lastEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    if (zoomLocked && now - lastEnd < 300) e.preventDefault();
    lastEnd = now;
  };

  const options = { passive: false } as const;
  document.addEventListener('gesturestart', prevent);
  document.addEventListener('gesturechange', prevent);
  document.addEventListener('touchmove', onTouchMove, options);
  document.addEventListener('touchend', onTouchEnd, options);
  return () => {
    document.removeEventListener('gesturestart', prevent);
    document.removeEventListener('gesturechange', prevent);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
  };
}
