import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installTouchGuards, isZoomLocked, setZoomLocked } from './touchGuards';

/** Evento táctil mínimo: lo que usan las guardas es `touches.length` y `preventDefault`. */
function touch(type: string, fingers: number): Event {
  const e = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(e, 'touches', { value: Array.from({ length: fingers }, () => ({})) });
  return e;
}
const fire = (doc: EventTarget, e: Event) => {
  doc.dispatchEvent(e);
  return e.defaultPrevented;
};

describe('installTouchGuards', () => {
  let doc: EventTarget;
  let remove: () => void;

  beforeEach(() => {
    doc = new EventTarget();
    vi.stubGlobal('document', doc);
    remove = installTouchGuards();
  });
  afterEach(() => {
    setZoomLocked(true);
    remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('bloquea los gestos de pellizco de Safari (gesturestart/gesturechange)', () => {
    expect(fire(doc, new Event('gesturestart', { cancelable: true }))).toBe(true);
    expect(fire(doc, new Event('gesturechange', { cancelable: true }))).toBe(true);
  });

  it('bloquea el movimiento con 2 o más dedos (zoom por pellizco) pero deja pasar el de 1 dedo', () => {
    expect(fire(doc, touch('touchmove', 2))).toBe(true);
    expect(fire(doc, touch('touchmove', 3))).toBe(true);
    expect(fire(doc, touch('touchmove', 1))).toBe(false); // desplazarse sigue funcionando
  });

  it('bloquea el zoom por doble toque rápido, pero no dos toques separados', () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    expect(fire(doc, touch('touchend', 0))).toBe(false); // primer toque
    vi.setSystemTime(10_150);
    expect(fire(doc, touch('touchend', 0))).toBe(true); // 150 ms después: doble toque
    vi.setSystemTime(11_000);
    expect(fire(doc, touch('touchend', 0))).toBe(false); // 850 ms después: toque normal
  });

  it('al desinstalar deja de interferir', () => {
    remove();
    expect(fire(doc, new Event('gesturestart', { cancelable: true }))).toBe(false);
    expect(fire(doc, touch('touchmove', 2))).toBe(false);
    remove = installTouchGuards(); // para el afterEach
  });

  describe('zona de adultos (zoom permitido por accesibilidad)', () => {
    it('con el zoom permitido no bloquea gestos, pellizcos ni doble toque', () => {
      vi.useFakeTimers();
      vi.setSystemTime(50_000);
      setZoomLocked(false);
      expect(isZoomLocked()).toBe(false);
      expect(fire(doc, new Event('gesturestart', { cancelable: true }))).toBe(false);
      expect(fire(doc, touch('touchmove', 2))).toBe(false);
      fire(doc, touch('touchend', 0));
      vi.setSystemTime(50_100);
      expect(fire(doc, touch('touchend', 0))).toBe(false);
    });

    it('al volver a bloquear, vuelven las guardas', () => {
      setZoomLocked(false);
      setZoomLocked(true);
      expect(isZoomLocked()).toBe(true);
      expect(fire(doc, touch('touchmove', 2))).toBe(true);
    });

    it('actualiza la meta viewport: sin user-scalable=no para adultos, con él para el niño', () => {
      let content = '';
      const meta = { setAttribute: (_: string, v: string) => (content = v) };
      (doc as unknown as { querySelector: (s: string) => unknown }).querySelector = (sel) => (sel.includes('viewport') ? meta : null);
      setZoomLocked(false);
      expect(content).not.toContain('user-scalable=no');
      expect(content).not.toContain('maximum-scale');
      expect(content).toContain('width=device-width');
      setZoomLocked(true);
      expect(content).toContain('user-scalable=no');
      expect(content).toContain('maximum-scale=1');
    });
  });
});
