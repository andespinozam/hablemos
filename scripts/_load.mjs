// Carga módulos TypeScript/TSX de la app desde Node usando Vite (sin copiar lógica a los scripts).
import { createServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Ejecuta `fn(load)`; `load('/src/lib/x.ts')` devuelve el módulo. */
export async function withApp(fn) {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    return await fn((p) => server.ssrLoadModule(p));
  } finally {
    await server.close();
  }
}
