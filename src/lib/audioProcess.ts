/**
 * Piezas puras del procesado de audio (las usan `scripts/audio-process.mjs` y la exportación del
 * modo de grabación). Aquí no se toca ni ffmpeg ni el disco, para poder probarlas.
 */
import { isAudioKey } from './audioKey';
import type { RecordingRecord } from './db';
import { extensionFor } from './recorder';
import type { AudioManifest, ClipSource } from './voice';
import type { ZipFile } from './zip';

/** Objetivo de volumen (LUFS integrados) y bitrate pedidos. */
export const TARGET_LUFS = -16;
export const OPUS_BITRATE = '64k';

const TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05';

/**
 * Argumentos de ffmpeg: recorta el silencio del inicio y del final (se invierte el audio para
 * recortar el final con el mismo filtro), normaliza a ~-16 LUFS y convierte a Opus mono de 64 kbps.
 */
export function ffmpegArgs(input: string, output: string, bitrate: string = OPUS_BITRATE): string[] {
  const filters = [TRIM, 'areverse', TRIM, 'areverse', `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11`].join(',');
  return ['-y', '-v', 'error', '-i', input, '-af', filters, '-ac', '1', '-c:a', 'libopus', '-b:a', bitrate, '-application', 'voip', output];
}

const AUDIO_EXT = new Set(['webm', 'ogg', 'm4a', 'mp4', 'aac', 'wav', 'mp3', 'opus', 'bin']);

/** `0a1b2c3d4e5f60.webm` → la clave; otros nombres → null. */
export function keyFromFileName(name: string): string | null {
  const m = /^([0-9a-f]{14})\.([a-z0-9]+)$/.exec(name.toLowerCase());
  return m && isAudioKey(m[1]) && AUDIO_EXT.has(m[2]) ? m[1] : null;
}

/**
 * Manifiesto a partir de los clips que existen. Conserva el texto de entradas anteriores y usa
 * `texts` (clave → texto) para las nuevas. Los archivos que no tienen forma de clave se ignoran.
 * Procedencia: `marks[clave]` manda (clips recién procesados); si no, la del manifiesto anterior;
 * y si tampoco hay, `human` (un .opus sin registro viene de una grabación).
 */
export function buildManifest(
  opusFiles: readonly string[],
  texts: Record<string, string>,
  previous?: AudioManifest,
  marks: Record<string, ClipSource> = {},
  priorities: Record<string, number> = {},
): AudioManifest {
  const clips: AudioManifest['clips'] = {};
  for (const file of [...opusFiles].sort()) {
    const m = /^([0-9a-f]{14})\.opus$/.exec(file);
    if (!m) continue;
    const key = m[1];
    const priority = priorities[key] ?? previous?.clips[key]?.priority;
    clips[key] = {
      file,
      text: texts[key] ?? previous?.clips[key]?.text,
      source: marks[key] ?? previous?.clips[key]?.source ?? 'human',
      ...(priority ? { priority } : {}),
    };
  }
  return { version: 1, clips };
}

/** Archivos del ZIP de grabaciones: un audio por texto y `grabaciones.json` con los textos. */
export function recordingsToZipFiles(records: readonly RecordingRecord[]): ZipFile[] {
  const enc = new TextEncoder();
  const files: ZipFile[] = [];
  const index: Record<string, { texto: string; archivo: string }> = {};
  for (const r of [...records].sort((a, b) => a.key.localeCompare(b.key))) {
    const archivo = `${r.key}.${extensionFor(r.mime)}`;
    files.push({ name: archivo, data: new Uint8Array(r.data) });
    index[r.key] = { texto: r.text, archivo };
  }
  files.push({ name: 'grabaciones.json', data: enc.encode(JSON.stringify(index, null, 2) + '\n') });
  return files;
}

/** Lee `grabaciones.json` → clave → texto. Tolera archivos mal formados. */
export function textsFromIndex(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, { texto?: unknown }>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) if (typeof v?.texto === 'string') out[k] = v.texto;
    return out;
  } catch {
    return {};
  }
}
