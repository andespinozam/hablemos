import { describe, expect, it } from 'vitest';
import { audioKey, isAudioKey } from './audioKey';
import { OPUS_BITRATE, TARGET_LUFS, buildManifest, ffmpegArgs, keyFromFileName, recordingsToZipFiles, textsFromIndex } from './audioProcess';
import { CATEGORY_LABEL, collectAudioTexts, coverage, toCsv, type AudioCategory } from './audioTexts';
import { PHONEMES } from './phonemes';
import { FINISH_PHRASE, PRAISES, retryPhrase } from './phrases';
import { MIME_CANDIDATES, extensionFor, micErrorMessage, pickMimeType, recordingSupport } from './recorder';
import { crc32, makeZip, readZip } from './zip';
import { ladderContent } from './ladder';

describe('recolector de textos (audio:list)', () => {
  const texts = collectAudioTexts();

  it('no tiene duplicados ni claves vacías, y es determinista', () => {
    expect(new Set(texts.map((t) => t.key)).size).toBe(texts.length);
    expect(texts.every((t) => isAudioKey(t.key))).toBe(true);
    expect(collectAudioTexts().map((t) => t.key)).toEqual(texts.map((t) => t.key));
    for (const t of texts) expect(audioKey(t.text), t.text).toBe(t.key);
  });
  it('trae las frases fijas, los elogios, el conteo y las introducciones (prioridad 1)', () => {
    const byText = new Map(texts.map((t) => [t.text, t]));
    for (const p of PRAISES) expect(byText.get(p)?.priority, p).toBe(1);
    expect(byText.get(FINISH_PHRASE)?.priority).toBe(1);
    expect(byText.get('tres')?.category).toBe('frase');
    expect(texts.filter((t) => t.category === 'intro')).toHaveLength(13);
    expect(texts.slice(0, 20).every((t) => t.priority === 1)).toBe(true);
  });
  it('cada texto trae cómo decirlo; los sonidos se dicen como sonido, no como nombre de letra', () => {
    for (const t of texts) expect(t.how.length, t.text).toBeGreaterThan(10);
    for (const p of PHONEMES.filter((x) => x.kind === 'sound')) {
      const say = ladderContent(p.id)!.say;
      const entry = texts.find((t) => t.key === audioKey(say));
      expect(entry, `${p.id}/${say}`).toBeDefined();
      // Si el sonido es el único texto, su categoría es "sonido"; si es una palabra real, manda la más prioritaria.
      expect(entry!.priority).toBeLessThanOrEqual(5);
    }
    const sss = texts.find((t) => t.text === 'sss')!;
    expect(sss.category).toBe('sonido');
    expect(sss.how).toMatch(/SONIDO, no el nombre de la letra/);
  });
  it('incluye las palabras de los fonemas, las repeticiones con calma y las instrucciones de las actividades', () => {
    const keys = new Set(texts.map((t) => t.key));
    for (const p of PHONEMES) for (const w of p.words) expect(keys.has(audioKey(w.word)), w.word).toBe(true);
    expect(keys.has(audioKey(retryPhrase('pato')))).toBe(true);
    expect(texts.some((t) => t.category === 'instruccion' && /^Toca /.test(t.text))).toBe(true);
    expect(texts.some((t) => t.category === 'ejercicio' && /^Mira la boca/.test(t.text))).toBe(true);
  });
  it('se ordena por prioridad y la cobertura cuenta lo que ya tiene audio', () => {
    for (let i = 1; i < texts.length; i++) expect(texts[i].priority).toBeGreaterThanOrEqual(texts[i - 1].priority);
    const have = new Set(texts.slice(0, 10).map((t) => t.key));
    const cov = coverage(texts, (t) => have.has(t.key));
    expect(cov.total).toBe(texts.length);
    expect(cov.withAudio).toBe(10);
    expect(cov.missing).toHaveLength(texts.length - 10);
    const sum = (Object.keys(CATEGORY_LABEL) as AudioCategory[]).reduce((n, c) => n + cov.byCategory[c].total, 0);
    expect(sum).toBe(texts.length);
  });
  it('el CSV tiene encabezado, comillas escapadas y una fila por texto', () => {
    const csv = toCsv([{ key: audioKey('di "hola"'), text: 'di "hola"', category: 'frase', priority: 1, how: 'claro' }]);
    expect(csv.split('\n')[0]).toBe('clave,prioridad,categoria,texto,como_decirlo');
    expect(csv).toContain('"di ""hola"""');
    expect(toCsv(texts).trim().split('\n')).toHaveLength(texts.length + 1);
  });
});

describe('ZIP', () => {
  it('crc32 de "123456789" es CBF43926', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('ida y vuelta: nombres con tildes y bytes intactos', () => {
    const files = [
      { name: 'aaaa.webm', data: new Uint8Array([1, 2, 3, 250]) },
      { name: 'niño.txt', data: new TextEncoder().encode('¡hola!') },
      { name: 'vacio.bin', data: new Uint8Array() },
    ];
    const back = readZip(makeZip(files));
    expect(back.map((f) => f.name)).toEqual(files.map((f) => f.name));
    for (let i = 0; i < files.length; i++) expect([...back[i].data]).toEqual([...files[i].data]);
  });
  it('detecta archivos dañados o que no son ZIP', () => {
    expect(() => readZip(new Uint8Array([1, 2, 3]))).toThrow(/ZIP/);
    const zip = makeZip([{ name: 'a.bin', data: new Uint8Array([1, 2, 3, 4]) }]);
    zip[30 + 5] ^= 0xff; // se daña un byte del contenido
    expect(() => readZip(zip)).toThrow(/dañado/);
  });
});

describe('grabación: formato y avisos', () => {
  it('elige el primer formato soportado: Chrome webm, Safari/iPad mp4', () => {
    expect(pickMimeType((m) => m.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickMimeType((m) => m === 'audio/mp4')).toBe('audio/mp4');
    expect(pickMimeType((m) => m === 'audio/mp4;codecs=mp4a.40.2')).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(pickMimeType(() => false)).toBe(''); // el navegador elige
    expect(MIME_CANDIDATES[0]).toMatch(/webm/);
  });
  it('extensiones por tipo (con o sin códec)', () => {
    expect(extensionFor('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionFor('audio/mp4')).toBe('m4a');
    expect(extensionFor('audio/ogg;codecs=opus')).toBe('ogg');
    expect(extensionFor('audio/wav')).toBe('wav');
    expect(extensionFor('cosa/rara')).toBe('bin');
  });
  it('avisa si no hay https/localhost, micrófono o MediaRecorder', () => {
    expect(recordingSupport({ isSecureContext: true, hasGetUserMedia: true, hasMediaRecorder: true })).toEqual({ ok: true });
    const insecure = recordingSupport({ isSecureContext: false, hasGetUserMedia: true, hasMediaRecorder: true });
    expect(insecure.ok).toBe(false);
    expect(!insecure.ok && insecure.reason).toMatch(/https/);
    expect(recordingSupport({ hasGetUserMedia: false, hasMediaRecorder: true }).ok).toBe(false);
    expect(recordingSupport({ hasGetUserMedia: true, hasMediaRecorder: false }).ok).toBe(false);
  });
  it('traduce los errores del micrófono', () => {
    expect(micErrorMessage({ name: 'NotAllowedError' })).toMatch(/permiso/);
    expect(micErrorMessage({ name: 'NotFoundError' })).toMatch(/ningún micrófono/);
    expect(micErrorMessage(null)).toMatch(/No se pudo/);
  });
});

describe('procesado de audio (audio:process)', () => {
  it('ffmpeg: recorta silencios, normaliza a -16 LUFS y convierte a Opus de 64 kbps', () => {
    const a = ffmpegArgs('in.webm', 'out.opus');
    expect(TARGET_LUFS).toBe(-16);
    expect(OPUS_BITRATE).toBe('64k');
    const filters = a[a.indexOf('-af') + 1];
    expect(filters).toContain('silenceremove');
    expect(filters.split('areverse')).toHaveLength(3); // inicio y final
    expect(filters).toContain('loudnorm=I=-16');
    expect(a).toContain('libopus');
    expect(a[a.indexOf('-b:a') + 1]).toBe('64k');
    expect(a.at(-1)).toBe('out.opus');
    expect(a[a.indexOf('-i') + 1]).toBe('in.webm');
  });
  it('reconoce nombres de archivo de grabación', () => {
    const k = audioKey('hola');
    expect(keyFromFileName(`${k}.webm`)).toBe(k);
    expect(keyFromFileName(`${k}.M4A`)).toBe(k);
    expect(keyFromFileName('grabaciones.json')).toBeNull();
    expect(keyFromFileName('zzz.webm')).toBeNull();
    expect(keyFromFileName(`${k}.txt`)).toBeNull();
  });
  it('el manifiesto lista los .opus, conserva textos anteriores y ordena por clave', () => {
    const a = audioKey('a');
    const b = audioKey('b');
    const m = buildManifest([`${b}.opus`, `${a}.opus`, 'manifest.json', 'x.opus'], { [b]: 'be' }, { version: 1, clips: { [a]: { file: `${a}.opus`, text: 'a vieja' } } });
    expect(Object.keys(m.clips)).toEqual([a, b].sort());
    expect(m.clips[a].text).toBe('a vieja');
    expect(m.clips[b]).toEqual({ file: `${b}.opus`, text: 'be', source: 'human' });
    expect(m.clips[a].source).toBe('human'); // sin registro previo de procedencia
  });
  it('procedencia: marks manda, luego el manifiesto anterior; un .opus nuevo sin registro es human', () => {
    const a = audioKey('a');
    const b = audioKey('b');
    const c = audioKey('c');
    const prev = { version: 1, clips: { [a]: { file: `${a}.opus`, source: 'tts' as const }, [b]: { file: `${b}.opus`, source: 'tts' as const } } };
    const m = buildManifest([`${a}.opus`, `${b}.opus`, `${c}.opus`], {}, prev, { [b]: 'human' });
    expect(m.clips[a].source).toBe('tts'); // se conserva
    expect(m.clips[b].source).toBe('human'); // tu grabación reemplaza al clip tts
    expect(m.clips[c].source).toBe('human');
    expect(buildManifest([`${c}.opus`], {}, undefined, { [c]: 'tts' }).clips[c].source).toBe('tts');
  });
  it('el bitrate de ffmpegArgs es configurable', () => {
    const a = ffmpegArgs('a.wav', 'a.opus', '32k');
    expect(a[a.indexOf('-b:a') + 1]).toBe('32k');
  });
  it('el ZIP de grabaciones trae un archivo por texto y un índice que se puede leer de vuelta', () => {
    const key = audioKey('Muy bien');
    const files = recordingsToZipFiles([{ key, text: 'Muy bien', mime: 'audio/mp4', data: new Uint8Array([7, 7]).buffer, at: 1 }]);
    const back = readZip(makeZip(files));
    expect(back.map((f) => f.name).sort()).toEqual([`${key}.m4a`, 'grabaciones.json']);
    const index = back.find((f) => f.name === 'grabaciones.json')!;
    expect(textsFromIndex(new TextDecoder().decode(index.data))).toEqual({ [key]: 'Muy bien' });
    expect(textsFromIndex('no es json')).toEqual({});
  });
});
