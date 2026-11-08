import { describe, expect, it, vi } from 'vitest';
import { formatBytes, requestPersistence, storageStatus } from './storage';

describe('requestPersistence', () => {
  it('si ya es persistente, no vuelve a pedir', async () => {
    const persist = vi.fn();
    expect(await requestPersistence({ persisted: async () => true, persist })).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });
  it('si no lo es, lo pide y devuelve la respuesta', async () => {
    expect(await requestPersistence({ persisted: async () => false, persist: async () => true })).toBe(true);
    expect(await requestPersistence({ persisted: async () => false, persist: async () => false })).toBe(false);
  });
  it('sin la API, o con errores, devuelve false sin lanzar', async () => {
    expect(await requestPersistence(undefined)).toBe(false);
    expect(await requestPersistence({})).toBe(false);
    expect(await requestPersistence({ persist: async () => { throw new Error('x'); } })).toBe(false);
  });
});

describe('storageStatus', () => {
  it('informa soporte, persistencia y uso', async () => {
    const s = await storageStatus({ persisted: async () => true, persist: async () => true, estimate: async () => ({ usage: 2048, quota: 9e9 }) });
    expect(s).toEqual({ supported: true, persistent: true, usage: 2048 });
  });
  it('tolera APIs que faltan o fallan', async () => {
    expect(await storageStatus(undefined)).toEqual({ supported: false, persistent: false });
    const s = await storageStatus({ persist: async () => false, persisted: async () => { throw new Error('x'); }, estimate: async () => { throw new Error('y'); } });
    expect(s).toEqual({ supported: true, persistent: false, usage: undefined });
  });
});

describe('formatBytes', () => {
  it('B, KB y MB con coma decimal', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3.4 * 1024 * 1024)).toBe('3,4 MB');
  });
});
