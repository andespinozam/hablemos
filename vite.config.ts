import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseManifest } from './src/lib/voice';
import { precacheFiles } from './src/lib/precache';

/**
 * Política de seguridad de contenido: la app no hace ninguna llamada de red al ejecutarse, así que se
 * prohíbe cualquier conexión externa. Va como <meta> (solo al compilar) para que también valga en
 * GitHub Pages, que no permite encabezados propios. El servidor de desarrollo la necesita desactivada.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspMeta = (): Plugin => ({
  name: 'hablemos-csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
});

/**
 * Clips de voz del precaché: solo prioridad 1-3 (ver `src/lib/precache.ts`). Cada entrada lleva como
 * `revision` el hash del archivo: el nombre es la clave del texto, así que si reemplazas un clip por tu
 * voz el nombre no cambia y sin revisión el service worker serviría el viejo.
 */
function audioPrecache(): { url: string; revision: string }[] {
  const dir = new URL('./public/audio/', import.meta.url);
  const manifestPath = new URL('manifest.json', dir);
  if (!existsSync(manifestPath)) return [];
  const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
  return precacheFiles(manifest)
    .filter((f) => existsSync(new URL(f, dir)))
    .map((f) => ({ url: `audio/${f}`, revision: createHash('md5').update(readFileSync(new URL(f, dir))).digest('hex') }));
}

export default defineConfig({
  // Rutas relativas: funciona en GitHub Pages (subruta) y en Netlify.
  base: './',
  plugins: [
    react(),
    cspMeta(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Hablemos',
        short_name: 'Hablemos',
        description: 'Juegos para estimular el lenguaje de niños de 3 a 5 años.',
        lang: 'es-419',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FFF6E0',
        theme_color: '#2F6FED',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precarga todo (JS, CSS, fuentes, íconos, JSON de contenido) para uso sin conexión.
        // Los clips de voz (audio/*.opus) NO van en el patrón: solo los de prioridad 1-3 se precargan
        // (additionalManifestEntries) y el resto se guarda en ejecución (runtimeCaching). Sí va el manifiesto.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        additionalManifestEntries: audioPrecache(),
        runtimeCaching: [
          {
            // Palabras y repeticiones: se guardan la primera vez que suenan con conexión; con tope.
            urlPattern: ({ url }: { url: URL }) => /\/audio\/[0-9a-f]{14}\.opus$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hablemos-audio',
              expiration: { maxEntries: 4500, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
