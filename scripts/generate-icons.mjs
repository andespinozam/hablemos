// Genera los PNG de la PWA a partir de public/favicon.svg y una versión "maskable".
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'icons');
await mkdir(out, { recursive: true });

const svg = await readFile(path.join(root, 'public', 'favicon.svg'));

// Maskable: fondo a sangre y dibujo dentro de la zona segura (~66 %).
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#2F6FED"/>
  <g transform="translate(91 91) scale(0.645)">
    <path d="M96 150a54 54 0 0 1 54-54h212a54 54 0 0 1 54 54v128a54 54 0 0 1-54 54H250l-84 74v-74h-16a54 54 0 0 1-54-54z" fill="#FFF6E0"/>
    <circle cx="196" cy="214" r="22" fill="#1B2A4A"/>
    <circle cx="316" cy="214" r="22" fill="#1B2A4A"/>
    <path d="M188 262q68 62 136 0" fill="none" stroke="#E8503A" stroke-width="22" stroke-linecap="round"/>
  </g>
</svg>`);

const jobs = [
  [svg, 192, 'icon-192.png'],
  [svg, 512, 'icon-512.png'],
  [svg, 180, 'apple-touch-icon.png'],
  [maskable, 512, 'maskable-512.png'],
];
for (const [input, size, name] of jobs) {
  await sharp(input).resize(size, size).png().toFile(path.join(out, name));
  console.log('icono', name);
}
