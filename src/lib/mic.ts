/** Envoltorio de MediaRecorder: empezar, detener (o cortar solo a los 15 s) y obtener el audio. */
import { pickMimeType, recordingSupport } from './recorder';

export const MAX_RECORD_MS = 15_000;

export interface MicSession {
  /** Termina y entrega el audio grabado. */
  stop(): Promise<Blob>;
  /** Termina y descarta. */
  cancel(): void;
  /** Se resuelve cuando la grabación terminó (por stop o por tiempo máximo). */
  done: Promise<Blob>;
}

export function micSupport() {
  return recordingSupport({
    isSecureContext: typeof window === 'undefined' ? undefined : window.isSecureContext,
    hasGetUserMedia: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    hasMediaRecorder: typeof MediaRecorder !== 'undefined',
  });
}

/** Pide el micrófono y empieza a grabar. Lanza el error del navegador si no hay permiso. */
export async function startMic(maxMs: number = MAX_RECORD_MS): Promise<MicSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  let discard = false;
  rec.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      window.clearTimeout(timer);
      if (discard) reject(new Error('cancelada'));
      else resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }));
    };
    rec.onerror = () => reject(new Error('Error al grabar'));
  });
  done.catch(() => undefined); // si se cancela, nadie espera: evita un aviso de promesa rechazada
  const timer = window.setTimeout(() => {
    if (rec.state !== 'inactive') rec.stop();
  }, maxMs);
  rec.start();
  return {
    done,
    stop() {
      if (rec.state !== 'inactive') rec.stop();
      return done;
    },
    cancel() {
      discard = true;
      if (rec.state !== 'inactive') rec.stop();
      else stream.getTracks().forEach((t) => t.stop());
    },
  };
}
