/**
 * Voz grabada: clips de audio por texto, con `speechSynthesis` como respaldo (lo decide `speak`).
 * Orden de búsqueda: grabación hecha en este dispositivo → clip del manifiesto (`audio/manifest.json`).
 * Un clip a la vez: pedir otro corta el anterior. Los clips se descargan (o salen del caché del
 * service worker) y se tocan desde una URL `blob:`, así no dependen de peticiones parciales (Range),
 * que Safari exige y el caché sin conexión no atiende.
 */
import { audioKey } from './audioKey';

export interface ClipEntry {
  /** Nombre del archivo dentro de `audio/` (sin carpetas). */
  file: string;
  text?: string;
}
export interface AudioManifest {
  version: number;
  clips: Record<string, ClipEntry>;
}

export const EMPTY_MANIFEST: AudioManifest = { version: 1, clips: {} };
/** Por debajo de esta velocidad se usa el clip más despacio (reintento con calma). */
const SLOW_THRESHOLD = 0.78;
/** El clip lento se toca a esta velocidad (el mismo clip, sin grabar otro). */
export const CLIP_SLOW_RATE = 0.9;

/** Velocidad de reproducción del clip según la velocidad pedida a `speak`. */
export function clipRate(rate: number): number {
  return rate < SLOW_THRESHOLD ? CLIP_SLOW_RATE : 1;
}

/** Valida el manifiesto; descarta entradas mal formadas (archivos con carpetas, claves raras). */
export function parseManifest(raw: unknown): AudioManifest {
  if (typeof raw !== 'object' || raw === null) return EMPTY_MANIFEST;
  const clips = (raw as { clips?: unknown }).clips;
  if (typeof clips !== 'object' || clips === null) return EMPTY_MANIFEST;
  const out: Record<string, ClipEntry> = {};
  for (const [key, value] of Object.entries(clips)) {
    if (!/^[0-9a-f]{14}$/.test(key) || typeof value !== 'object' || value === null) continue;
    const file = (value as { file?: unknown }).file;
    if (typeof file !== 'string' || !/^[\w.-]+$/.test(file) || file.startsWith('.')) continue;
    const text = (value as { text?: unknown }).text;
    out[key] = { file, text: typeof text === 'string' ? text : undefined };
  }
  return { version: 1, clips: out };
}

// ---------- Estado ----------

let manifest: AudioManifest = EMPTY_MANIFEST;
/** Grabaciones hechas en este dispositivo: clave → URL blob. */
const local = new Map<string, string>();
/** Clips del manifiesto ya descargados: archivo → URL blob. */
const fetched = new Map<string, string>();
const missing = new Set<string>();

export function setManifest(m: AudioManifest): void {
  manifest = m;
  fetched.clear();
}
export function getManifest(): AudioManifest {
  return manifest;
}

export function setLocalClip(key: string, data: ArrayBuffer, mime: string): void {
  clearLocalClip(key);
  local.set(key, URL.createObjectURL(new Blob([data], { type: mime })));
}
export function clearLocalClip(key: string): void {
  const url = local.get(key);
  if (url) URL.revokeObjectURL(url);
  local.delete(key);
}
export function clearAllLocalClips(): void {
  for (const k of [...local.keys()]) clearLocalClip(k);
}

/** ¿Hay clip (local o del manifiesto) para este texto? */
export function hasClip(text: string): boolean {
  const key = audioKey(text);
  return key !== '' && (local.has(key) || key in manifest.clips);
}
export function clipSource(text: string): 'local' | 'manifiesto' | null {
  const key = audioKey(text);
  if (!key) return null;
  if (local.has(key)) return 'local';
  return key in manifest.clips ? 'manifiesto' : null;
}

/** Textos pedidos a `speak` que no tenían clip (para el diagnóstico). Se guarda en el dispositivo. */
const MISSING_STORAGE_KEY = 'hablemos-audio-missing';
const MISSING_MAX = 800;

export function noteMissing(text: string): void {
  const t = text.trim();
  if (!t || missing.has(t) || missing.size >= MISSING_MAX) return;
  missing.add(t);
  try {
    globalThis.localStorage?.setItem(MISSING_STORAGE_KEY, JSON.stringify([...missing]));
  } catch {
    /* sin almacenamiento: solo queda en memoria */
  }
}
export function seenMissing(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(MISSING_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(saved)) for (const t of saved) if (typeof t === 'string') missing.add(t);
  } catch {
    /* ignorar */
  }
  return [...missing];
}
export function clearSeenMissing(): void {
  missing.clear();
  try {
    globalThis.localStorage?.removeItem(MISSING_STORAGE_KEY);
  } catch {
    /* ignorar */
  }
}

// ---------- Reproducción (un clip a la vez) ----------

export interface AudioLike {
  src: string;
  playbackRate: number;
  muted?: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

let audioFactory: () => AudioLike = () => new Audio() as unknown as AudioLike;
let element: AudioLike | null = null;
let token = 0;
let finishCurrent: (() => void) | null = null;

/** Solo para pruebas. */
export function setAudioFactory(factory: () => AudioLike): void {
  audioFactory = factory;
  element = null;
}

function getElement(): AudioLike {
  element ??= audioFactory();
  return element;
}

/** Corta el clip que esté sonando (y libera a quien lo esperaba). */
export function stopClip(): void {
  token++;
  finishCurrent?.();
  finishCurrent = null;
  element?.pause();
}

let fetchImpl: (url: string) => Promise<Response> = (u) => fetch(u);
export function setFetch(fn: (url: string) => Promise<Response>): void {
  fetchImpl = fn;
}
let base = '';
export function setBaseUrl(url: string): void {
  base = url;
}
function baseUrl(): string {
  return base || (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');
}

/** Baja un clip del manifiesto (del caché del service worker si no hay red) y devuelve su URL blob. */
async function urlForManifestClip(entry: ClipEntry): Promise<string | null> {
  const cached = fetched.get(entry.file);
  if (cached) return cached;
  try {
    const res = await fetchImpl(new URL(`audio/${entry.file}`, baseUrl()).href);
    const type = res.headers.get('content-type') ?? '';
    // Un servidor con "página de respaldo" devuelve HTML (200) para archivos que no existen.
    if (!res.ok || type.includes('text/html')) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    const url = URL.createObjectURL(blob);
    fetched.set(entry.file, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Toca el clip del texto, si existe. Devuelve true si lo tocó (o lo cortaron a la mitad) y false
 * si no hay clip o no se pudo tocar: entonces `speak` usa la voz del sistema.
 */
export async function playClip(text: string, rate: number): Promise<boolean> {
  const key = audioKey(text);
  if (!key) return false;
  const mine = ++token;
  finishCurrent?.();
  finishCurrent = null;
  element?.pause();

  let url = local.get(key) ?? null;
  if (!url) {
    const entry = manifest.clips[key];
    if (entry) url = await urlForManifestClip(entry);
  }
  if (mine !== token) return true; // se pidió otra cosa mientras se bajaba: no hablar encima
  if (!url) {
    noteMissing(text);
    return false;
  }

  const el = getElement();
  return new Promise<boolean>((resolve) => {
    const done = (value: boolean) => {
      el.removeEventListener('ended', onEnd);
      el.removeEventListener('error', onError);
      if (finishCurrent === release) finishCurrent = null;
      resolve(value);
    };
    const onEnd = () => done(true);
    const onError = () => done(false);
    const release = () => done(true); // cortado por otro clip o por cancelar
    finishCurrent = release;
    el.addEventListener('ended', onEnd);
    el.addEventListener('error', onError);
    el.src = url;
    el.playbackRate = clipRate(rate);
    el.play().catch(() => done(false)); // sin permiso para sonar (aún sin toque): voz del sistema
  });
}

/** Silencio de WAV (mono, 8 kHz, ~0,05 s) para "desbloquear" el elemento de audio con un toque. */
export function silentWav(): Uint8Array {
  const samples = 400;
  const bytes = new Uint8Array(44 + samples * 2);
  const dv = new DataView(bytes.buffer);
  const text = (o: number, s: string) => [...s].forEach((c, i) => bytes.set([c.charCodeAt(0)], o + i));
  text(0, 'RIFF');
  dv.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 16000, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  text(36, 'data');
  dv.setUint32(40, samples * 2, true);
  return bytes;
}

/**
 * Llamar dentro de un toque (junto con `unlockAudio`): en iPad/Safari el elemento de audio solo
 * puede sonar después si ya sonó una vez en respuesta a un toque.
 */
export function primeAudio(): void {
  try {
    const el = getElement();
    if (el.src) return;
    const url = URL.createObjectURL(new Blob([silentWav() as BlobPart], { type: 'audio/wav' }));
    el.src = url;
    el.play().then(
      () => {
        el.pause();
      },
      () => undefined,
    );
  } catch {
    /* sin audio: no pasa nada */
  }
}

/** Carga el manifiesto (si hay). Nunca lanza: sin manifiesto, todo se dice con la voz del sistema. */
export async function loadManifest(): Promise<AudioManifest> {
  try {
    const res = await fetchImpl(new URL('audio/manifest.json', baseUrl()).href);
    if (!res.ok) return EMPTY_MANIFEST;
    return parseManifest(await res.json());
  } catch {
    return EMPTY_MANIFEST;
  }
}

export async function initVoice(loadLocal: () => Promise<{ key: string; data: ArrayBuffer; mime: string }[]>): Promise<void> {
  setManifest(await loadManifest());
  try {
    for (const r of await loadLocal()) setLocalClip(r.key, r.data, r.mime);
  } catch {
    /* sin grabaciones locales */
  }
}
