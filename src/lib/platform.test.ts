import { describe, expect, it } from 'vitest';
import { titleFor } from '../App';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Se leen los archivos reales: los guardas de zoom, selección y "pull to refresh" viven en CSS y HTML.
const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const indexHtml = read('index.html');
const viteConfig = read('vite.config.ts');
const globalCss = read('src/styles/global.css');
const themeCss = read('src/styles/theme.css');

describe('index.html', () => {
  const html = indexHtml;
  it('bloquea el zoom accidental (viewport) y respeta el notch (viewport-fit)', () => {
    const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)![1];
    expect(viewport).toContain('maximum-scale=1');
    expect(viewport).toContain('user-scalable=no');
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).toContain('width=device-width');
  });
  it('declara el idioma latino y las metas de app instalable (Android e iPad)', () => {
    expect(html).toContain('<html lang="es-419">');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('mobile-web-app-capable');
    expect(html).toContain('rel="apple-touch-icon"');
    expect(html).toContain('name="theme-color"');
  });
  it('no carga nada de la red: sin scripts ni hojas de estilo externos', () => {
    expect(html).not.toMatch(/(src|href)="https?:\/\//);
  });
});

describe('CSS global', () => {
  const css = globalCss;
  it('sin "pull to refresh" ni rebote: overscroll-behavior none', () => {
    expect(css).toMatch(/overscroll-behavior:\s*none/);
  });
  it('sin zoom por doble toque: touch-action manipulation', () => {
    expect(css).toMatch(/touch-action:\s*manipulation/);
  });
  it('las zonas de juego no permiten seleccionar texto', () => {
    expect(css).toMatch(/\.play-zone[\s\S]{0,80}user-select:\s*none/);
  });
  it('foco visible y movimiento reducido', () => {
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*5px/);
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
  it('los botones miden al menos 72 px', () => {
    expect(themeCss).toMatch(/--tap-min:\s*72px/);
    expect(css).toMatch(/\.btn\s*{[^}]*min-height:\s*var\(--tap-min\)/);
  });
});

describe('manifiesto y despliegue', () => {
  const config = viteConfig;
  it('rutas relativas: funciona en GitHub Pages (subruta) y en Netlify', () => {
    expect(config).toContain("base: './'");
  });
  it('precarga fuentes e íconos para usar sin conexión', () => {
    expect(config).toContain('woff2');
    expect(config).toContain('navigateFallback');
  });
});

describe('titleFor', () => {
  it('da un título propio a cada pantalla', () => {
    expect(titleFor('')).toBe('Hablemos');
    expect(titleFor('inicio')).toBe('Inicio · Hablemos');
    expect(titleFor('jugar')).toBe('Jugando · Hablemos');
    expect(titleFor('puerta')).toBe('Zona de adultos · Hablemos');
    expect(titleFor('adultos')).toBe('Zona de adultos · Hablemos');
    expect(titleFor('adultos/respaldo')).toBe('Respaldo · Hablemos');
    expect(titleFor('adultos/seguimiento/x')).toBe('Seguimiento · Hablemos');
    expect(titleFor('adultos/evaluar/x/baseline')).toBe('Evaluando · Hablemos');
    expect(titleFor('adultos/escalera/x')).toBe('Escalera de pronunciación · Hablemos');
    expect(titleFor('adultos/pronunciacion/x')).toBe('Pronunciación · Hablemos');
    expect(titleFor('adultos/pronunciar/x/y')).toBe('Evaluando pronunciación · Hablemos');
    expect(titleFor('adultos/cosa-rara')).toBe('Zona de adultos · Hablemos');
  });
});
