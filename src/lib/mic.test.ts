import { afterEach, describe, expect, it, vi } from 'vitest';
import { micSupport, startMic } from './mic';

class FakeRecorder {
  static types = new Set(['audio/mp4']);
  static isTypeSupported = (m: string) => FakeRecorder.types.has(m);
  state: 'inactive' | 'recording' = 'inactive';
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    public stream: unknown,
    opts?: { mimeType?: string },
  ) {
    this.mimeType = opts?.mimeType ?? 'audio/webm';
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
    queueMicrotask(() => this.onstop?.());
  }
}

function install() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  vi.stubGlobal('window', { isSecureContext: true, setTimeout, clearTimeout });
  return { track };
}

afterEach(() => vi.unstubAllGlobals());

describe('micrófono', () => {
  it('graba en el formato que soporta el dispositivo (Safari: mp4), entrega el audio y suelta el micrófono', async () => {
    const { track } = install();
    const session = await startMic();
    const blob = await session.stop();
    expect(blob.type).toBe('audio/mp4');
    expect(blob.size).toBe(3);
    expect(track.stop).toHaveBeenCalled();
  });
  it('si el navegador no soporta ningún formato conocido, deja que elija el suyo', async () => {
    install();
    FakeRecorder.types.clear();
    const blob = await (await startMic()).stop();
    expect(blob.type).toBe('audio/webm');
    FakeRecorder.types.add('audio/mp4');
  });
  it('cancelar descarta y también suelta el micrófono', async () => {
    const { track } = install();
    const session = await startMic();
    session.cancel();
    await expect(session.done).rejects.toThrow();
    expect(track.stop).toHaveBeenCalled();
  });
  it('se corta solo al llegar al tiempo máximo', async () => {
    install();
    const session = await startMic(5);
    const blob = await session.done;
    expect(blob.size).toBe(3);
  });
  it('sin https o sin micrófono, avisa en vez de intentar', () => {
    vi.stubGlobal('window', { isSecureContext: false });
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => undefined } });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    expect(micSupport().ok).toBe(false);
    vi.stubGlobal('window', { isSecureContext: true });
    expect(micSupport().ok).toBe(true);
    vi.stubGlobal('navigator', {});
    expect(micSupport().ok).toBe(false);
  });
});
