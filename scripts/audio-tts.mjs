// npm run audio:tts -- [--dry-run | --samples] [opciones]
// --dry-run: análisis (conteo, peso, tiempo, costo). --samples: muestras de voz. Sin ninguna de las dos: genera los clips.
// Generación: por tandas de prioridad, reanudable (salta los clips que ya existen salvo --force), nunca pisa un clip
// 'human', y pasa el WAV de Azure por la misma tubería de audio:process (recorte, ~-16 LUFS, Opus mono).
//
// Credenciales: SOLO de las variables de entorno AZURE_SPEECH_KEY y AZURE_SPEECH_REGION
// (también se leen de .env.local, que está en .gitignore). La clave nunca se imprime.
//
// Opciones: --voice <nombre>  --max-priority N  --category <c>  --limit N  --dry-run  --samples
//           --force  --rate <porcentaje, defecto -10>  --bitrate <p. ej. 32k|64k>
//           --max-chars N (tope, defecto 450000)  --allow-over  --tier f0|s0 (defecto s0)  --concurrency N (defecto 4 en s0, 1 en f0)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, withApp } from './_load.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const num = (name, fallback) => {
  const v = opt(name, undefined);
  if (v === undefined) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`${name} necesita un número (recibí "${v}")`);
  return n;
};
function fail(msg) {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

try {
  process.loadEnvFile(path.join(root, '.env.local')); // no pisa variables ya definidas
} catch {
  /* sin .env.local: solo variables de entorno */
}

const SAMPLE_VOICES = ['es-EC-AndreaNeural', 'es-EC-LuisNeural', 'es-MX-DaliaNeural', 'es-US-PalomaNeural'];
const voice = opt('--voice', 'es-EC-AndreaNeural');
const ratePct = num('--rate', -10);
const bitrate = opt('--bitrate', '64k');
const tier = opt('--tier', 's0');
if (!['f0', 's0'].includes(tier)) fail('--tier debe ser f0 o s0');
const cap = num('--max-chars', 450_000);
const audioDir = path.join(root, 'public', 'audio');

const pad = (s, n) => String(s).padStart(n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Azure ----------

function credentials() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    fail('Faltan AZURE_SPEECH_KEY y/o AZURE_SPEECH_REGION. Defínelas como variables de entorno o en .env.local (ignorado por git), p. ej.:\n  AZURE_SPEECH_KEY=...\n  AZURE_SPEECH_REGION=eastus');
  }
  if (!/^[a-z0-9-]+$/i.test(region)) fail('AZURE_SPEECH_REGION no parece una región válida (p. ej. eastus, brazilsouth).');
  return { key, region };
}

/** Intervalo mínimo entre peticiones: F0 = 20 por minuto (no ajustable) → una cada 3,2 s. */
const MIN_INTERVAL_MS = tier === 'f0' ? 3200 : 60;
let nextSlot = 0;
/** Reserva un turno (seguro con varios trabajadores a la vez): nunca más rápido que el límite de peticiones. */
async function throttle() {
  const at = Math.max(Date.now(), nextSlot);
  nextSlot = at + MIN_INTERVAL_MS;
  const wait = at - Date.now();
  if (wait > 0) await sleep(wait);
}

/** POST de SSML con reintentos de espera creciente ante 429/5xx. Devuelve los bytes de audio. */
async function synthesize({ key, region }, ssml, outputFormat) {
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  for (let attempt = 0; ; attempt++) {
    await throttle();
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': outputFormat,
          'User-Agent': 'hablemos-audio-tts',
        },
        body: ssml,
      });
    } catch (e) {
      if (attempt >= 5) throw new Error(`Sin conexión con Azure: ${e.message}`);
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`Azure rechazó las credenciales (HTTP ${res.status}). Revisa AZURE_SPEECH_KEY y AZURE_SPEECH_REGION.`), { fatal: true });
    throw new Error(`Azure respondió HTTP ${res.status}: ${detail}`);
  }
}

async function listVoices({ key, region }) {
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': key },
  });
  if (!res.ok) throw new Error(`No pude listar las voces (HTTP ${res.status}).`);
  return (await res.json()).map((v) => v.ShortName);
}

// ---------- Programa ----------

await withApp(async (load) => {
  const { collectAudioTexts, CATEGORY_LABEL } = await load('/src/lib/audioTexts.ts');
  const { parseManifest } = await load('/src/lib/voice.ts');
  const T = await load('/src/lib/tts.ts');

  const texts = collectAudioTexts();

  // Clips que ya existen: procedencia según el manifiesto (un .opus sin registro cuenta como 'human').
  let manifest = { version: 1, clips: {} };
  try {
    manifest = parseManifest(JSON.parse(await readFile(path.join(audioDir, 'manifest.json'), 'utf8')));
  } catch {
    /* sin manifiesto */
  }
  const existing = {};
  if (existsSync(audioDir)) {
    for (const f of await readdir(audioDir)) {
      const m = /^([0-9a-f]{14})\.opus$/.exec(f);
      if (m) existing[m[1]] = manifest.clips[m[1]]?.source ?? 'human';
    }
  }

  const sel = T.selectTexts(texts, existing, {
    maxPriority: opt('--max-priority') === undefined ? undefined : num('--max-priority'),
    category: opt('--category'),
    limit: opt('--limit') === undefined ? undefined : num('--limit'),
    force: flag('--force'),
  });

  if (flag('--samples')) return runSamples(texts);
  if (flag('--dry-run')) return dryRun(sel, texts);
  return generate(sel, texts, manifest, existing);

  // ----- --dry-run -----
  function dryRun(sel, all) {
    const rows = {}; // categoría → prioridad → { n, billable }
    for (const t of sel.todo) {
      const r = ((rows[t.category] ??= {})[t.priority] ??= { n: 0, billable: 0 });
      r.n += 1;
      r.billable += T.billableChars(T.buildSsml(t.text, voice, ratePct));
    }
    const tot = T.totalsFor(sel.todo, voice, ratePct);
    console.log(`Voz: ${voice} · velocidad ${ratePct}% · tier ${tier.toUpperCase()}\n`);
    console.log('Pendiente por categoría y prioridad (caracteres facturables = texto + etiquetas SSML):');
    console.log(`  ${'categoría'.padEnd(34)} prio  textos  facturables`);
    for (const [cat, byPrio] of Object.entries(rows)) {
      for (const [p, v] of Object.entries(byPrio).sort((a, b) => a[0] - b[0])) {
        console.log(`  ${String(CATEGORY_LABEL[cat] ?? cat).padEnd(34)} ${pad(p, 4)}  ${pad(v.n, 6)}  ${pad(v.billable, 11)}`);
      }
    }
    console.log(`  ${'TOTAL'.padEnd(34)}       ${pad(tot.count, 6)}  ${pad(tot.billable, 11)}   (solo texto: ${tot.plain})`);

    console.log('\nNo se sintetizan / ya resueltos:');
    const soundChars = sel.skippedSound.reduce((n, t) => n + [...t.text].length, 0);
    console.log(`  Sonidos (los grabas tú): ${sel.skippedSound.length} textos, ${soundChars} caracteres. Ejemplos: ${sel.skippedSound.slice(0, 8).map((t) => `"${t.text}"`).join(', ')}`);
    console.log(`  Con clip human (no se tocan): ${sel.skippedHuman.length} · ya con clip tts (reanudación): ${sel.skippedDone.length}`);

    const risky = T.findRiskyTexts(sel.todo);
    console.log(`\nTextos con números, abreviaturas, siglas o símbolos: ${risky.length}`);
    const byWhy = {};
    for (const r of risky) for (const w of r.why.split(', ')) (byWhy[w] ??= []).push(r.text.text);
    for (const [w, list] of Object.entries(byWhy)) console.log(`  ${w}: ${list.length} · ej.: ${[...new Set(list)].slice(0, 4).map((x) => `"${x}"`).join(' ')}`);

    console.log('\nPeso estimado en disco (heurística; se confirma con las muestras):');
    for (const k of [64, 32]) console.log(`  Opus ${k}k: ${T.formatBytes(T.estimateTotalBytes(sel.todo, k, ratePct))}`);
    const wall = T.estimateWallSeconds(tot.count, tier);
    console.log(`\nTiempo estimado (${tier.toUpperCase()}): ${T.formatDuration(wall)} (${tier === 'f0' ? `${tot.count} peticiones a 20 por minuto, límite fijo de F0` : `${tot.count} peticiones, límite 30 por segundo`}; sin contar reintentos 429)`);
    console.log(`Costo estimado: $${T.estimateCostUsd(tot.billable).toFixed(2)} a $${T.PRICE_PER_MILLION_CHARS}/millón; con la cuota gratuita mensual de F0 (${T.F0_FREE_CHARS_PER_MONTH} caracteres): $${T.estimateCostUsd(tot.billable, tier === 'f0' ? T.F0_FREE_CHARS_PER_MONTH : 0).toFixed(2)}`);
    if (tier === 'f0' && tot.billable > T.F0_FREE_CHARS_PER_MONTH) {
      console.log(`  ⚠ Pasa de la cuota gratuita mensual: en F0 la síntesis se detiene al agotarla; reparte la tarea en dos meses (--max-priority) o usa S0.`);
    }
    if (ratePct !== 0) {
      const tags = tot.billable - tot.plain;
      console.log(`  ℹ Las etiquetas SSML se cobran: ${tags} caracteres (${Math.round((tags / Math.max(1, tot.plain)) * 100)} % extra). Con --rate 0 se omite prosody (la velocidad se ajustaría después con ffmpeg).`);
    }

    const capResult = T.checkCharCap(tot.billable, cap, flag('--allow-over'));
    console.log(`\n${capResult.ok ? '✔' : '✖'} ${capResult.message}`);
    if (!capResult.ok) process.exit(2);
  }

  // ----- generación -----
  async function generate(sel, all, manifest, existing) {
    const creds = credentials();
    const { ffmpegArgs, buildManifest } = await load('/src/lib/audioProcess.ts');
    if (sel.todo.length === 0) {
      console.log(`Nada pendiente (ya con clip tts: ${sel.skippedDone.length}, human: ${sel.skippedHuman.length}, sonidos sin sintetizar: ${sel.skippedSound.length}).`);
      return;
    }
    const tot = T.totalsFor(sel.todo, voice, ratePct);
    const capResult = T.checkCharCap(tot.billable, cap, flag('--allow-over'));
    console.log(`Voz ${voice} · ${ratePct}% · Opus ${bitrate} · tier ${tier.toUpperCase()} · ${tot.count} clips · ${tot.billable} caracteres facturables (≈ $${T.estimateCostUsd(tot.billable).toFixed(2)})`);
    console.log(`${capResult.ok ? '✔' : '✖'} ${capResult.message}`);
    if (!capResult.ok) process.exit(2);
    const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0) fail('No se encontró ffmpeg en el PATH. Instálalo y abre una terminal nueva.');
    const available = await listVoices(creds);
    if (!available.includes(voice)) fail(`La voz ${voice} no está disponible en la región ${creds.region}.`);

    const tmpDir = path.join(root, 'audio-work', 'tts');
    await mkdir(tmpDir, { recursive: true });
    await mkdir(audioDir, { recursive: true });
    const textByKey = Object.fromEntries(all.map((t) => [t.key, t.text]));
    const prioByKey = Object.fromEntries(all.map((t) => [t.key, t.priority]));
    const marks = {}; // claves generadas en esta corrida
    const failed = [];
    let done = 0;
    let chars = 0;
    let stopping = false;
    let fatal = null;
    const conc = Math.max(1, Math.floor(num('--concurrency', tier === 's0' ? 4 : 1)));

    async function flush() {
      const files = (await readdir(audioDir)).filter((f) => /^[0-9a-f]{14}\.opus$/.test(f));
      const m = buildManifest(files, textByKey, manifest, marks, prioByKey);
      await writeFile(path.join(audioDir, 'manifest.json'), JSON.stringify(m, null, 1) + '\n', 'utf8');
    }
    process.on('SIGINT', () => {
      if (stopping) process.exit(130);
      stopping = true;
      console.log('\nDeteniendo: termino los clips en curso y guardo el manifiesto (Ctrl+C otra vez para salir ya)…');
    });
    const runFfmpeg = (cmd) =>
      new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', cmd, { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        p.stderr.on('data', (d) => (err += d));
        p.on('error', reject);
        p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg: ${err.trim().split('\n').pop()}`))));
      });

    async function doOne(t) {
      if (existing[t.key] === 'human') return; // red de seguridad: nunca se pisa tu voz
      const ssml = T.buildSsml(t.text, voice, ratePct);
      const wav = await synthesize(creds, ssml, 'riff-24khz-16bit-mono-pcm');
      const wavPath = path.join(tmpDir, `${t.key}.wav`);
      const part = path.join(audioDir, `${t.key}.part.opus`);
      await writeFile(wavPath, wav);
      try {
        await runFfmpeg(ffmpegArgs(wavPath, part, bitrate));
        await rename(part, path.join(audioDir, `${t.key}.opus`));
      } finally {
        await unlink(wavPath).catch(() => {});
        await unlink(part).catch(() => {});
      }
      marks[t.key] = 'tts';
      chars += T.billableChars(ssml);
    }

    const started = Date.now();
    for (const batch of T.planBatches(sel.todo)) {
      if (stopping || fatal) break;
      const queue = [...batch.items];
      let n = 0;
      console.log(`\nTanda de prioridad ${batch.priority}: ${queue.length} clips`);
      // Subida gradual de la carga (recomendado por Azure): los trabajadores arrancan escalonados.
      const worker = async (i) => {
        await sleep(i * 1500);
        while (!stopping && !fatal) {
          const t = queue.shift();
          if (!t) return;
          try {
            await doOne(t);
            done++;
          } catch (e) {
            if (e.fatal) {
              fatal = e;
              return;
            }
            failed.push({ key: t.key, text: t.text, error: String(e.message).slice(0, 200) });
          }
          n++;
          process.stdout.write(`\r  ${pad(n, 5)}/${batch.items.length} · total ${done}/${sel.todo.length} · fallos ${failed.length} · ${T.formatDuration((Date.now() - started) / 1000)}   `);
          if (done % 50 === 0) await flush();
        }
      };
      await Promise.all(Array.from({ length: Math.min(conc, queue.length) }, (_, i) => worker(i)));
      await flush();
    }
    process.stdout.write('\n');
    await flush();

    let bytes = 0;
    for (const f of await readdir(audioDir)) if (f.endsWith('.opus')) bytes += (await stat(path.join(audioDir, f))).size;
    if (failed.length) await writeFile(path.join(root, 'audio-work', 'tts-fallidos.json'), JSON.stringify(failed, null, 1), 'utf8');
    console.log(`\n✔ ${done} clips generados · caracteres facturados ≈ ${chars} (≈ $${T.estimateCostUsd(chars).toFixed(2)}) · public/audio pesa ahora ${T.formatBytes(bytes)}`);
    if (fatal) console.log(`✖ Se detuvo: ${fatal.message}`);
    if (failed.length) console.log(`⚠ ${failed.length} clips fallaron (lista en audio-work/tts-fallidos.json). Vuelve a correr el mismo comando: reanuda solo con los que faltan.`);
    if (stopping) console.log('Detenido por ti: vuelve a correr el mismo comando para reanudar.');
    if (fatal || failed.length) process.exitCode = 1;
  }

  // ----- --samples -----
  async function runSamples(all) {
    const creds = credentials();
    const picks = T.pickSamples(all);
    const base = path.join(root, 'audio-work', 'muestras');
    const voices = flag('--voice') ? [voice] : SAMPLE_VOICES;

    console.log(`Región: ${creds.region}. Verificando que las voces existan…`);
    const available = new Set(await listVoices(creds));
    for (const v of voices) console.log(`  ${available.has(v) ? '✔' : '✖ NO disponible en esta región:'} ${v}`);
    const usable = voices.filter((v) => available.has(v));
    if (usable.length === 0) fail('Ninguna de las voces está disponible en esta región.');

    let chars = 0;
    let requests = 0;
    const eta = T.formatDuration(T.estimateWallSeconds(usable.length * picks.length, tier));
    console.log(`\nSintetizando ${picks.length} textos × ${usable.length} voces (${usable.length * picks.length} peticiones, ~${eta} en ${tier.toUpperCase()})…`);
    for (const v of usable) {
      await mkdir(path.join(base, v), { recursive: true });
      for (const t of picks) {
        const file = path.join(base, v, `${t.key}.mp3`);
        if (existsSync(file) && !flag('--force')) continue; // reanudación: no gasta cuota
        const ssml = T.buildSsml(t.text, v, ratePct);
        const bytes = await synthesize(creds, ssml, 'audio-24khz-48kbitrate-mono-mp3');
        await writeFile(file, bytes);
        chars += T.billableChars(ssml);
        requests += 1;
        process.stdout.write(`\r  ${v} ${pad(requests, 3)}/${usable.length * picks.length}`);
      }
    }
    process.stdout.write('\n');

    await writeFile(path.join(base, 'index.html'), samplesPage(picks, usable), 'utf8');
    console.log(`\n✔ Muestras en audio-work/muestras/index.html (ábrelo en el navegador).`);
    console.log(`Caracteres facturados en esta corrida: ${chars} en ${requests} peticiones (≈ $${T.estimateCostUsd(chars).toFixed(3)} sin cuota gratuita; ${chars} de ${T.F0_FREE_CHARS_PER_MONTH} de la cuota mensual de F0).`);
  }

  function samplesPage(picks, voices) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const head = voices.map((v) => `<th>${esc(v)}</th>`).join('');
    const body = picks
      .map(
        (t) =>
          `<tr><td><b>${esc(t.text)}</b><br><small>${esc(t.category)}</small></td>${voices
            .map((v) => `<td><audio controls preload="none" src="${v}/${t.key}.mp3"></audio></td>`)
            .join('')}</tr>`,
      )
      .join('\n');
    return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Muestras de voz</title>
<style>body{font:16px system-ui;margin:1rem}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.5rem;vertical-align:top}audio{width:230px}</style>
<h1>Muestras de voz (velocidad ${ratePct}%)</h1><p>Compáralas lado a lado: cada fila es el mismo texto con cada voz.</p>
<table><tr><th>Texto</th>${head}</tr>
${body}
</table></html>`;
  }
});
