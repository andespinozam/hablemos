// npm run audio:process [-- --in <carpeta|zip>] [--out public/audio] [--dry-run]
// Toma las grabaciones (carpeta o ZIP exportado desde la app: <clave>.<ext>), recorta silencios,
// normaliza a ~-16 LUFS y convierte a Opus 64 kbps en public/audio. Luego regenera manifest.json.
// Requiere ffmpeg en el PATH (https://ffmpeg.org).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, withApp } from './_load.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const input = path.resolve(root, opt('--in', 'audio-work/grabaciones'));
const outDir = path.resolve(root, opt('--out', 'public/audio'));
const dryRun = flag('--dry-run');
const bitrate = opt('--bitrate', '64k');

function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

await withApp(async (load) => {
  const { ffmpegArgs, keyFromFileName, buildManifest, textsFromIndex } = await load('/src/lib/audioProcess.ts');
  const { readZip } = await load('/src/lib/zip.ts');
  const { parseManifest } = await load('/src/lib/voice.ts');

  if (!dryRun) {
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0) fail('No se encontró ffmpeg. Instálalo (https://ffmpeg.org) y vuelve a intentar, o usa --dry-run para ver qué haría.');
  }

  // 1. Reunir los archivos de entrada (carpeta o ZIP) y los textos conocidos.
  const sources = []; // { key, file (ruta), bytes? }
  let texts = {};
  const tmp = path.join(root, 'audio-work', 'zip');
  if (input.toLowerCase().endsWith('.zip')) {
    if (!existsSync(input)) fail(`No existe ${input}`);
    await mkdir(tmp, { recursive: true });
    for (const f of readZip(new Uint8Array(await readFile(input)))) {
      if (f.name === 'grabaciones.json') texts = { ...texts, ...textsFromIndex(Buffer.from(f.data).toString('utf8')) };
      else if (keyFromFileName(f.name)) {
        await writeFile(path.join(tmp, f.name), f.data);
        sources.push({ key: keyFromFileName(f.name), file: path.join(tmp, f.name) });
      }
    }
  } else {
    if (!existsSync(input)) fail(`No existe la carpeta ${input}. Exporta el ZIP desde la app (Zona de adultos → Voz) y descomprímelo ahí, o usa --in archivo.zip`);
    for (const name of await readdir(input)) {
      const key = keyFromFileName(name);
      if (key) sources.push({ key, file: path.join(input, name) });
    }
    try {
      texts = textsFromIndex(await readFile(path.join(input, 'grabaciones.json'), 'utf8'));
    } catch {
      /* sin índice: los textos salen de guion.json */
    }
  }
  try {
    const guion = JSON.parse(await readFile(path.join(root, 'audio-work', 'guion.json'), 'utf8'));
    texts = { ...guion, ...texts };
  } catch {
    /* ejecuta npm run audio:list para tener los textos en el manifiesto */
  }
  if (sources.length === 0) fail('No hay grabaciones (archivos <clave>.<ext>) para procesar.');

  // 2. Convertir.
  await mkdir(outDir, { recursive: true });
  let done = 0;
  const marks = {}; // los clips que salen de tus grabaciones son siempre 'human' (reemplazan a un clip tts)
  for (const s of sources) {
    const out = path.join(outDir, `${s.key}.opus`);
    const cmd = ffmpegArgs(s.file, out, bitrate);
    if (dryRun) {
      console.log(`ffmpeg ${cmd.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`);
      continue;
    }
    const r = spawnSync('ffmpeg', cmd, { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`✖ ${path.basename(s.file)}: ${String(r.stderr).trim().split('\n').pop()}`);
      continue;
    }
    done++;
    marks[s.key] = 'human';
  }

  // 3. Manifiesto con todos los .opus que haya (los de antes y los nuevos).
  let previous;
  try {
    previous = parseManifest(JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8')));
  } catch {
    previous = undefined;
  }
  const existing = (await readdir(outDir)).filter((f) => f.endsWith('.opus'));
  const files = dryRun ? [...new Set([...existing, ...sources.map((s) => `${s.key}.opus`)])] : existing;
  const manifest = buildManifest(files, texts, previous, dryRun ? Object.fromEntries(sources.map((s) => [s.key, 'human'])) : marks);
  if (dryRun) {
    console.log(`\n(simulación) Habría ${Object.keys(manifest.clips).length} clips en el manifiesto.`);
    return;
  }
  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n', 'utf8');
  console.log(`✔ ${done} de ${sources.length} clips convertidos. El manifiesto tiene ${Object.keys(manifest.clips).length} clips.`);
  console.log('Ahora: npm run build && npm run preview, y prueba sin conexión.');
});
