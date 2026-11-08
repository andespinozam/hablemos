// npm run audio:list
// Extrae todos los textos que la app puede decir (sin duplicados) y la forma de decirlos.
// Escribe audio-work/guion.csv y audio-work/guion.json; muestra la cobertura del manifiesto actual.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, withApp } from './_load.mjs';

const outDir = path.join(root, 'audio-work');

await withApp(async (load) => {
  const { collectAudioTexts, toCsv, coverage, CATEGORY_LABEL } = await load('/src/lib/audioTexts.ts');
  const { parseManifest } = await load('/src/lib/voice.ts');

  const texts = collectAudioTexts();
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'guion.csv'), '﻿' + toCsv(texts), 'utf8'); // BOM: Excel lee bien las tildes
  await writeFile(path.join(outDir, 'guion.json'), JSON.stringify(Object.fromEntries(texts.map((t) => [t.key, t.text])), null, 1) + '\n', 'utf8');

  let manifest = { version: 1, clips: {} };
  try {
    manifest = parseManifest(JSON.parse(await readFile(path.join(root, 'public', 'audio', 'manifest.json'), 'utf8')));
  } catch {
    /* sin manifiesto todavía */
  }
  const cov = coverage(texts, (t) => t.key in manifest.clips);

  console.log(`Textos distintos que la app puede decir: ${cov.total}`);
  console.log(`Con clip en public/audio: ${cov.withAudio} · sin audio: ${cov.missing.length}\n`);
  for (const [cat, v] of Object.entries(cov.byCategory)) {
    console.log(`  ${String(CATEGORY_LABEL[cat]).padEnd(36)} ${String(v.withAudio).padStart(5)} / ${v.total}`);
  }
  console.log('\nGuion escrito en audio-work/guion.csv (clave, prioridad, categoría, texto, cómo decirlo).');
});
