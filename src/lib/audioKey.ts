/**
 * Clave estable de un texto hablado: el mismo texto (sin importar mayúsculas, puntuación ni
 * espacios sobrantes) da siempre la misma clave, también en los scripts de Node.
 * Es el nombre del clip de audio y la entrada del manifiesto. Nunca cambiar el algoritmo:
 * invalidaría todos los clips ya grabados.
 */

/** Minúsculas, sin puntuación (se conservan letras, números, acentos y ñ) y con espacios simples. */
export function normalizeSpoken(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** cyrb53: hash de 53 bits, rápido, sin dependencias y estable. */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** 14 caracteres hexadecimales (p. ej. `0a1b2c3d4e5f60`). Texto vacío → cadena vacía. */
export function audioKey(text: string): string {
  const norm = normalizeSpoken(text);
  if (!norm) return '';
  return cyrb53(norm).toString(16).padStart(14, '0');
}

/** ¿Parece una clave de audio? (para leer nombres de archivo) */
export function isAudioKey(value: string): boolean {
  return /^[0-9a-f]{14}$/.test(value);
}
