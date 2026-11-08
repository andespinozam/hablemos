import { describe, expect, it, vi } from 'vitest';
import { createWakeLock, isWakeLockSupported } from './wakeLock';

function fakeDoc() {
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: 'visible',
    addEventListener: (_: 'visibilitychange', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'visibilitychange', l: () => void) => listeners.delete(l),
    hide() {
      doc.visibilityState = 'hidden';
      listeners.forEach((l) => l());
    },
    show() {
      doc.visibilityState = 'visible';
      listeners.forEach((l) => l());
    },
    count: () => listeners.size,
  };
  return doc;
}

function fakeNav() {
  const sentinels: { released: boolean; release: () => Promise<void> }[] = [];
  const request = vi.fn(async () => {
    const s = {
      released: false,
      release: async () => {
        s.released = true;
      },
    };
    sentinels.push(s);
    return s;
  });
  return { nav: { wakeLock: { request } }, request, sentinels };
}

describe('isWakeLockSupported', () => {
  it('detecta si el navegador lo ofrece', () => {
    expect(isWakeLockSupported({})).toBe(false);
    expect(isWakeLockSupported(fakeNav().nav)).toBe(true);
  });
});

describe('createWakeLock', () => {
  it('pide la pantalla encendida al empezar y la suelta al parar', async () => {
    const { nav, request, sentinels } = fakeNav();
    const doc = fakeDoc();
    const lock = createWakeLock(nav, doc);
    expect(await lock.start()).toBe(true);
    expect(request).toHaveBeenCalledWith('screen');
    expect(doc.count()).toBe(1);
    await lock.stop();
    expect(sentinels[0].released).toBe(true);
    expect(doc.count()).toBe(0); // sin oyentes colgados
  });

  it('lo vuelve a pedir al regresar a la pestaña (el navegador lo suelta al ocultarla)', async () => {
    const { nav, request } = fakeNav();
    const doc = fakeDoc();
    const lock = createWakeLock(nav, doc);
    await lock.start();
    doc.hide();
    expect(request).toHaveBeenCalledTimes(1); // oculta: no se pide
    doc.show();
    await Promise.resolve();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    await lock.stop();
  });

  it('no vuelve a pedirlo después de parar', async () => {
    const { nav, request } = fakeNav();
    const doc = fakeDoc();
    const lock = createWakeLock(nav, doc);
    await lock.start();
    await lock.stop();
    doc.show();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('sin soporte no falla: start devuelve false y stop no hace nada', async () => {
    const lock = createWakeLock({}, fakeDoc());
    expect(await lock.start()).toBe(false);
    await expect(lock.stop()).resolves.toBeUndefined();
  });

  it('si el sistema lo rechaza (ahorro de batería) no es un error', async () => {
    const nav = { wakeLock: { request: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } };
    const lock = createWakeLock(nav, fakeDoc());
    expect(await lock.start()).toBe(false);
    await expect(lock.stop()).resolves.toBeUndefined();
  });

  it('si se para mientras la petición está pendiente, se suelta de inmediato', async () => {
    let resolve!: (s: { release: () => Promise<void> }) => void;
    let released = false;
    const nav = { wakeLock: { request: () => new Promise<{ release: () => Promise<void> }>((r) => (resolve = r)) } };
    const lock = createWakeLock(nav, fakeDoc());
    const started = lock.start();
    await lock.stop();
    resolve({ release: async () => { released = true; } });
    expect(await started).toBe(false);
    expect(released).toBe(true);
  });

  it('start dos veces no pide dos pantallas', async () => {
    const { nav, request } = fakeNav();
    const lock = createWakeLock(nav, fakeDoc());
    await lock.start();
    await lock.start();
    expect(request).toHaveBeenCalledTimes(1);
    await lock.stop();
  });
});
