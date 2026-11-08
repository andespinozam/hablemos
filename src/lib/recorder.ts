/**
 * Grabación con el micrófono (MediaRecorder). La lógica que no toca el navegador va aquí para probarla:
 * elegir el formato que el dispositivo soporta (Safari/iPad graba mp4; Chrome, webm) y avisar si
 * el micrófono no está disponible (exige HTTPS o localhost).
 */

/** En orden de preferencia: Chrome/Firefox/Android → webm/ogg con Opus; Safari/iPad → mp4. */
export const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
] as const;

/** Primer formato soportado; cadena vacía = dejar que el navegador elija el suyo. */
export function pickMimeType(isSupported: (mime: string) => boolean): string {
  return MIME_CANDIDATES.find((m) => isSupported(m)) ?? '';
}

/** Extensión de archivo para un tipo de audio (sin parámetros de códec). */
export function extensionFor(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base === 'audio/webm') return 'webm';
  if (base === 'audio/ogg') return 'ogg';
  if (base === 'audio/mp4' || base === 'audio/x-m4a' || base === 'audio/m4a') return 'm4a';
  if (base === 'audio/aac') return 'aac';
  if (base === 'audio/wav' || base === 'audio/x-wav') return 'wav';
  if (base === 'audio/mpeg') return 'mp3';
  return 'bin';
}

export interface RecordingEnv {
  isSecureContext?: boolean;
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
}

export type RecordingSupport = { ok: true } | { ok: false; reason: string };

/** ¿Se puede grabar? Si no, el motivo en palabras sencillas. */
export function recordingSupport(env: RecordingEnv): RecordingSupport {
  if (env.isSecureContext === false) {
    return { ok: false, reason: 'Grabar con el micrófono exige una página segura (https) o localhost. Abre la app desde su dirección https o desde este mismo equipo.' };
  }
  if (!env.hasGetUserMedia) return { ok: false, reason: 'Este navegador no da acceso al micrófono.' };
  if (!env.hasMediaRecorder) return { ok: false, reason: 'Este navegador no sabe grabar audio (falta MediaRecorder). Prueba con Chrome o Safari actualizado.' };
  return { ok: true };
}

/** Pasa un error de getUserMedia a un mensaje que entienda un adulto. */
export function micErrorMessage(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'No se dio permiso para usar el micrófono. Actívalo en los ajustes del navegador para este sitio.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró ningún micrófono.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'El micrófono está ocupado por otra aplicación.';
  return 'No se pudo usar el micrófono.';
}
