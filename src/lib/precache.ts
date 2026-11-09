/**
 * Qué clips de voz se precargan en el service worker. Solo los de prioridad 1 a 3 (elogios,
 * introducciones, instrucciones y escalera) entran al precaché: así el núcleo de cada sesión suena sin
 * conexión desde la primera visita. El resto (palabras y repeticiones) se guarda en ejecución
 * (CacheFirst con tope, ver `vite.config.ts`) y, si no está, `speak` usa la voz del sistema.
 * Los clips sin prioridad anotada (grabaciones tuyas procesadas antes de existir el campo) se
 * precargan siempre: son pocos y son los que más importan. Lo usa `vite.config.ts` al compilar.
 */
import type { AudioManifest } from './voice';

export const PRECACHE_MAX_PRIORITY = 3;

/** Nombres de archivo (`<clave>.opus`) que van al precaché, ordenados. */
export function precacheFiles(manifest: AudioManifest, maxPriority: number = PRECACHE_MAX_PRIORITY): string[] {
  return Object.values(manifest.clips)
    .filter((c) => c.priority === undefined || c.priority <= maxPriority)
    .map((c) => c.file)
    .sort();
}
