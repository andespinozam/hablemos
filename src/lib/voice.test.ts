import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioKey, isAudioKey, normalizeSpoken } from './audioKey';
import { resetDbConnection } from './db';
import { deleteAllRecordings, deleteRecording, listRecordings, loadRecordingsForVoice, saveRecording } from './recordingsStore';
import { cancelSpeech, speak } from './speech';
import {
  CLIP_SLOW_RATE,
  EMPTY_MANIFEST,
  clearAllLocalClips,
  clipRate,
  clipSource,
  hasClip,
  loadManifest,
  parseManifest,
  playClip,
  seenMissing,
  setAudioFactory,
  setBaseUrl,
  setFetch,
  setLocalClip,
  setManifest,
  silentWav,
  stopClip,
  type AudioLike,
} from './voice';

describe('audioKey', () => {
  it('es estable: valores fijos (si fallan, se cambió el algoritmo y los clips ya grabados no se encontrarían)', () => {
    expect(audioKey('hola')).toBe('1ef62169777964');
    expect(audioKey('Muy bien')).toBe('1187f1ad863180');
    expect(audioKey('Mamá')).toBe('0a76932f53a859');
    expect(audioKey('¿Dónde va el gato?')).toBe('0fb99469db29cd');
  });
  it('ignora mayúsculas, puntuación y espacios sobrantes', () => {
    const k = audioKey('Muy bien');
    expect(audioKey('¡Muy bien!')).toBe(k);
    expect(audioKey('  muy   BIEN ')).toBe(k);
    expect(audioKey('muy, bien.')).toBe(k);
  });
  it('distingue textos distintos y respeta tildes y ñ', () => {
    expect(audioKey('mamá')).not.toBe(audioKey('mama'));
    expect(audioKey('niño')).not.toBe(audioKey('nino'));
    expect(audioKey('pato')).not.toBe(audioKey('gato'));
  });
  it('normaliza Unicode (é compuesta y descompuesta dan lo mismo)', () => {
    expect(audioKey('café')).toBe(audioKey('café'));
  });
  it('texto vacío o solo puntuación no tiene clave', () => {
    expect(audioKey('')).toBe('');
    expect(audioKey(' ¡! ')).toBe('');
    expect(isAudioKey(audioKey('hola'))).toBe(true);
    expect(isAudioKey('xyz')).toBe(false);
    expect(normalizeSpoken('¿Dónde va el GATO?')).toBe('dónde va el gato');
  });
  it('sin colisiones en un conjunto grande', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 20000; i++) keys.add(audioKey(`texto de prueba número ${i}`));
    expect(keys.size).toBe(20000);
  });
});

describe('manifiesto', () => {
  it('descarta entradas mal formadas (claves raras, archivos con carpetas)', () => {
    const good = audioKey('hola');
    const m = parseManifest({
      clips: {
        [good]: { file: `${good}.opus`, text: 'hola' },
        zzz: { file: 'a.opus' },
        [audioKey('x1')]: { file: '../secreto.opus' },
        [audioKey('x2')]: { file: 'sub/a.opus' },
        [audioKey('x3')]: { file: '.oculto' },
        [audioKey('x4')]: 'nope',
      },
    });
    expect(Object.keys(m.clips)).toEqual([good]);
    expect(parseManifest(null)).toEqual(EMPTY_MANIFEST);
    expect(parseManifest({ clips: 3 })).toEqual(EMPTY_MANIFEST);
    expect(parseManifest('x')).toEqual(EMPTY_MANIFEST);
  });
  it('la velocidad del reintento lento usa el mismo clip a ~0,9', () => {
    expect(clipRate(0.85)).toBe(1);
    expect(clipRate(1)).toBe(1);
    expect(clipRate(0.7)).toBe(CLIP_SLOW_RATE);
    expect(CLIP_SLOW_RATE).toBeCloseTo(0.9);
  });
  it('si no hay manifiesto (404, HTML de respaldo o sin red), queda vacío y no lanza', async () => {
    setFetch(async () => new Response('nope', { status: 404 }));
    expect(await loadManifest()).toEqual(EMPTY_MANIFEST);
    setFetch(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    expect(await loadManifest()).toEqual(EMPTY_MANIFEST);
    setFetch(async () => {
      throw new TypeError('sin red');
    });
    expect(await loadManifest()).toEqual(EMPTY_MANIFEST);
  });
  it('carga un manifiesto válido', async () => {
    const key = audioKey('hola');
    setFetch(async () => new Response(JSON.stringify({ version: 1, clips: { [key]: { file: `${key}.opus` } } }), { status: 200 }));
    expect(Object.keys((await loadManifest()).clips)).toEqual([key]);
  });
  it('un WAV de silencio es válido', () => {
    const w = silentWav();
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...w.slice(8, 12))).toBe('WAVE');
  });
});

/** Audio de mentira: guarda qué se tocó y deja terminar o cortar a voluntad. */
class FakeAudio implements AudioLike {
  static instances: FakeAudio[] = [];
  src = '';
  playbackRate = 1;
  played: string[] = [];
  paused = 0;
  private handlers = new Map<string, Set<() => void>>();
  allowPlay = true;
  constructor() {
    FakeAudio.instances.push(this);
  }
  play(): Promise<void> {
    if (!this.allowPlay) return Promise.reject(new DOMException('no', 'NotAllowedError'));
    this.played.push(this.src);
    return Promise.resolve();
  }
  pause(): void {
    this.paused++;
  }
  addEventListener(type: string, fn: () => void): void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(fn);
    this.handlers.set(type, set);
  }
  removeEventListener(type: string, fn: () => void): void {
    this.handlers.get(type)?.delete(fn);
  }
  emit(type: string): void {
    for (const fn of [...(this.handlers.get(type) ?? [])]) fn();
  }
}

class FakeUtterance {
  voice: unknown;
  lang = '';
  rate = 1;
  pitch = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function installSynth() {
  const spoken: { text: string; rate: number }[] = [];
  const synth = {
    cancel: vi.fn(),
    getVoices: () => [{ lang: 'es-MX', name: 'x' }],
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    speak: (u: FakeUtterance) => {
      spoken.push({ text: u.text, rate: u.rate });
      queueMicrotask(() => u.onend?.());
    },
  };
  vi.stubGlobal('window', { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance, setTimeout, clearTimeout });
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  return { synth, spoken };
}

describe('speak: clip grabado con respaldo de voz del sistema', () => {
  let audio: FakeAudio;
  beforeEach(() => {
    FakeAudio.instances = [];
    clearAllLocalClips();
    setManifest(EMPTY_MANIFEST);
    audio = new FakeAudio();
    setAudioFactory(() => audio);
    setBaseUrl('http://localhost/app/');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => `blob:fake/${Math.random()}`, revokeObjectURL: () => undefined }));
  });
  afterEach(() => {
    cancelSpeech();
    vi.unstubAllGlobals();
  });

  it('sin clip usa speechSynthesis, igual que antes', async () => {
    const { spoken } = installSynth();
    await speak('Hola mundo', 0.85);
    expect(spoken).toEqual([{ text: 'Hola mundo', rate: 0.85 }]);
    expect(audio.played).toEqual([]);
  });

  it('con clip local lo toca (a velocidad normal) y NO usa la voz del sistema', async () => {
    const { spoken } = installSynth();
    setLocalClip(audioKey('Hola mundo'), new ArrayBuffer(8), 'audio/webm');
    const p = speak('¡Hola mundo!', 0.85);
    await vi.waitFor(() => expect(audio.played).toHaveLength(1));
    expect(audio.playbackRate).toBe(1);
    audio.emit('ended');
    await p;
    expect(spoken).toEqual([]);
    expect(clipSource('hola mundo')).toBe('local');
  });

  it('el reintento lento usa el mismo clip con playbackRate ~0,9', async () => {
    installSynth();
    setLocalClip(audioKey('Vamos otra vez'), new ArrayBuffer(8), 'audio/webm');
    const p = speak('Vamos otra vez', 0.7);
    await vi.waitFor(() => expect(audio.played).toHaveLength(1));
    expect(audio.playbackRate).toBeCloseTo(0.9);
    audio.emit('ended');
    await p;
  });

  it('con clip del manifiesto lo baja del servidor y lo toca desde una URL blob', async () => {
    installSynth();
    const key = audioKey('Muy bien');
    setManifest({ version: 1, clips: { [key]: { file: `${key}.opus` } } });
    const urls: string[] = [];
    setFetch(async (u) => {
      urls.push(u);
      return new Response(new Blob([new Uint8Array([1, 2, 3])]), { status: 200, headers: { 'content-type': 'audio/ogg' } });
    });
    const p = speak('Muy bien');
    await vi.waitFor(() => expect(audio.played).toHaveLength(1));
    expect(urls).toEqual([`http://localhost/app/audio/${key}.opus`]);
    expect(audio.played[0]).toMatch(/^blob:/);
    audio.emit('ended');
    await p;
    // la segunda vez no vuelve a bajar
    const q = speak('Muy bien');
    await vi.waitFor(() => expect(audio.played).toHaveLength(2));
    expect(urls).toHaveLength(1);
    audio.emit('ended');
    await q;
  });

  it('si el clip del manifiesto no se puede bajar (sin red o HTML), cae a la voz del sistema', async () => {
    const { spoken } = installSynth();
    const key = audioKey('Bravo');
    setManifest({ version: 1, clips: { [key]: { file: `${key}.opus` } } });
    setFetch(async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    await speak('Bravo');
    expect(spoken.map((s) => s.text)).toEqual(['Bravo']);
    setFetch(async () => {
      throw new TypeError('sin red');
    });
    await speak('Bravo');
    expect(spoken).toHaveLength(2);
  });

  it('si el navegador no deja sonar (sin toque previo) o el clip falla, cae a la voz del sistema', async () => {
    const { spoken } = installSynth();
    setLocalClip(audioKey('Hola'), new ArrayBuffer(8), 'audio/webm');
    audio.allowPlay = false;
    await speak('Hola');
    expect(spoken.map((s) => s.text)).toEqual(['Hola']);
    audio.allowPlay = true;
    const p = speak('Hola');
    await vi.waitFor(() => expect(audio.played).toHaveLength(1));
    audio.emit('error');
    await p;
    expect(spoken.map((s) => s.text)).toEqual(['Hola', 'Hola']);
  });

  it('un clip a la vez: pedir otro corta el anterior (y lo libera)', async () => {
    installSynth();
    setLocalClip(audioKey('Uno'), new ArrayBuffer(8), 'audio/webm');
    setLocalClip(audioKey('Dos'), new ArrayBuffer(8), 'audio/webm');
    const first = speak('Uno');
    await vi.waitFor(() => expect(audio.played).toHaveLength(1));
    const second = speak('Dos');
    await first; // el primero se libera apenas llega el segundo
    await vi.waitFor(() => expect(audio.played).toHaveLength(2));
    expect(audio.paused).toBeGreaterThan(0);
    expect(FakeAudio.instances).toHaveLength(1); // un solo elemento de audio
    audio.emit('ended');
    await second;
  });

  it('un clip corta también la voz del sistema que estuviera sonando, y cancelSpeech corta el clip', async () => {
    const { synth } = installSynth();
    setLocalClip(audioKey('Uno'), new ArrayBuffer(8), 'audio/webm');
    const p = speak('Uno');
    await vi.waitFor(() => expect(audio.played).toHaveLength(1));
    expect(synth.cancel).toHaveBeenCalled();
    cancelSpeech();
    await p;
    expect(audio.paused).toBeGreaterThan(0);
  });

  it('anota los textos que no tenían clip para el diagnóstico', async () => {
    installSynth();
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    await speak('Una frase nueva sin clip');
    expect(seenMissing()).toContain('Una frase nueva sin clip');
    expect(hasClip('Una frase nueva sin clip')).toBe(false);
  });

  it('playClip y stopClip son seguros sin audio ni clip', async () => {
    expect(await playClip('', 1)).toBe(false);
    expect(await playClip('sin clip', 1)).toBe(false);
    expect(() => stopClip()).not.toThrow();
  });
});

describe('grabaciones guardadas en el dispositivo', () => {
  beforeEach(async () => {
    await resetDbConnection();
    globalThis.indexedDB = new IDBFactory();
    clearAllLocalClips();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:fake/x', revokeObjectURL: () => undefined }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('se guardan, se leen y dejan lista la voz; regrabar reemplaza', async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    const r = await saveRecording('¡Muy bien!', data, 'audio/mp4', 5);
    expect(r.key).toBe(audioKey('muy bien'));
    expect(hasClip('Muy bien')).toBe(true);
    await saveRecording('muy bien', new Uint8Array([9]).buffer, 'audio/webm', 6);
    const all = await listRecordings();
    expect(all).toHaveLength(1);
    expect(all[0].mime).toBe('audio/webm');
    expect((await loadRecordingsForVoice())[0].key).toBe(r.key);
  });
  it('se borran una a una o todas', async () => {
    await saveRecording('uno', new ArrayBuffer(1), 'audio/webm');
    await saveRecording('dos', new ArrayBuffer(1), 'audio/webm');
    await deleteRecording(audioKey('uno'));
    expect(await listRecordings()).toHaveLength(1);
    expect(hasClip('uno')).toBe(false);
    await deleteAllRecordings();
    expect(await listRecordings()).toEqual([]);
    expect(hasClip('dos')).toBe(false);
  });
  it('no guarda un texto vacío', async () => {
    await expect(saveRecording(' ¡! ', new ArrayBuffer(1), 'audio/webm')).rejects.toThrow();
  });
});
