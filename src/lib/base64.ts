/** Base64 de bytes (para guardar audio dentro de un respaldo JSON). Por trozos: no revienta con audios largos. */

const CHUNK = 0x8000;

export function toBase64(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/** Lanza si el texto no es base64 válido. */
export function fromBase64(text: string): ArrayBuffer {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

export const isBase64 = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(v) && v.length % 4 === 0;
