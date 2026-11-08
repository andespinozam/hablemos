/**
 * Evita zoom accidental (pellizco, gestos de iOS, doble toque) y "pull to refresh".
 * `overscroll-behavior: none` y `touch-action: manipulation` ya están en global.css;
 * esto cubre Safari, que ignora `user-scalable=no`.
 */
export function installTouchGuards(): () => void {
  const prevent = (e: Event) => e.preventDefault();
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  let lastEnd = 0;
  const onTouchEnd = (e: TouchEvent) => {
    const now = Date.now();
    if (now - lastEnd < 300) e.preventDefault();
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
