import { describe, expect, it } from 'vitest';
import type { AudioCategory, AudioText } from './audioTexts';
import { audioKey } from './audioKey';
import {
  DEFAULT_CHAR_CAP,
  billableChars,
  buildSsml,
  checkCharCap,
  escapeXml,
  estimateBytes,
  estimateCostUsd,
  estimateWallSeconds,
  findRiskyTexts,
  formatRate,
  localeOfVoice,
  pickSamples,
  selectTexts,
  totalsFor,
} from './tts';

function at(text: string, category: AudioCategory = 'palabra', priority = 5): AudioText {
  return { key: audioKey(text), text, category, priority, how: '' };
}
const VOICE = 'es-EC-AndreaNeural';

describe('SSML', () => {
  it('usa el idioma de la voz y envuelve el texto en prosody', () => {
    const s = buildSsml('gato', VOICE, -10);
    expect(s).toContain('xml:lang="es-EC"');
    expect(s).toContain('<voice name="es-EC-AndreaNeural">');
    expect(s).toContain('<prosody rate="-10%">gato</prosody>');
    expect(buildSsml('gato', 'es-MX-DaliaNeural')).toContain('xml:lang="es-MX"');
    expect(buildSsml('gato', 'es-US-PalomaNeural')).toContain('xml:lang="es-US"');
  });
  it('escapa los caracteres especiales de XML', () => {
    expect(escapeXml(`a & b < c > "d" 'e'`)).toBe('a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');
    const s = buildSsml('Tom & Jerry <3', VOICE);
    expect(s).toContain('Tom &amp; Jerry &lt;3');
    expect(s).not.toContain('Tom & Jerry');
  });
  it('agrega una pausa breve tras los puntos, entre oraciones y no al final', () => {
    const s = buildSsml('¡Muy bien! Toca el gato. ¿Dónde está?', VOICE);
    expect(s.match(/<break time="300ms"\/>/g)).toHaveLength(2);
    expect(s).toContain('¡Muy bien!<break time="300ms"/> Toca el gato.<break time="300ms"/> ¿Dónde está?</prosody>');
    expect(buildSsml('gato.', VOICE)).not.toContain('<break');
  });
  it('velocidad: formato, omitir con 0 y rango válido', () => {
    expect(formatRate(-10)).toBe('-10%');
    expect(formatRate(5)).toBe('+5%');
    expect(() => formatRate(80)).toThrow();
    expect(buildSsml('gato', VOICE, 0)).not.toContain('prosody');
  });
  it('rechaza nombres de voz raros', () => {
    expect(localeOfVoice(VOICE)).toBe('es-EC');
    expect(() => localeOfVoice('"><inyeccion')).toThrow();
  });
  it('los caracteres facturables incluyen etiquetas internas pero no speak ni voice', () => {
    const s = buildSsml('gato', VOICE, -10);
    expect(billableChars(s)).toBe('<prosody rate="-10%">gato</prosody>'.length);
    expect(billableChars(buildSsml('gato', VOICE, 0))).toBe(4);
    expect(billableChars('nada')).toBe(0);
  });
});

describe('selección de textos', () => {
  const texts = [
    at('¡Muy bien!', 'refuerzo', 1),
    at('uno', 'frase', 1),
    at('mmm', 'sonido', 2),
    at('beee, beee', 'sonido', 2),
    at('Toca el gato.', 'instruccion', 3),
    at('Con calma: gato', 'repeticion', 4),
    at('gato', 'palabra', 5),
    at('perro', 'palabra', 5),
  ];
  it('excluye siempre la categoría sonido y la reporta aparte', () => {
    const s = selectTexts(texts, {});
    expect(s.todo.map((t) => t.text)).not.toContain('mmm');
    expect(s.skippedSound.map((t) => t.text)).toEqual(['mmm', 'beee, beee']);
    expect(selectTexts(texts, {}, { category: 'sonido' }).todo).toEqual([]);
  });
  it('nunca pisa clips human, ni siquiera con --force', () => {
    const existing = { [audioKey('gato')]: 'human' as const, [audioKey('perro')]: 'tts' as const };
    const normal = selectTexts(texts, existing);
    expect(normal.skippedHuman.map((t) => t.text)).toEqual(['gato']);
    expect(normal.skippedDone.map((t) => t.text)).toEqual(['perro']);
    const forced = selectTexts(texts, existing, { force: true });
    expect(forced.todo.map((t) => t.text)).toContain('perro');
    expect(forced.todo.map((t) => t.text)).not.toContain('gato');
  });
  it('reanudación: lo ya hecho se salta', () => {
    const existing = Object.fromEntries(texts.map((t) => [t.key, 'tts' as const]));
    expect(selectTexts(texts, existing).todo).toEqual([]);
  });
  it('filtra por prioridad y categoría y recorta con limit', () => {
    expect(selectTexts(texts, {}, { maxPriority: 1 }).todo.map((t) => t.text)).toEqual(['¡Muy bien!', 'uno']);
    expect(selectTexts(texts, {}, { category: 'palabra' }).todo).toHaveLength(2);
    expect(selectTexts(texts, {}, { limit: 3 }).todo).toHaveLength(3);
  });
  it('ordena por prioridad', () => {
    const shuffled = [texts[6], texts[0], texts[4]];
    expect(selectTexts(shuffled, {}).todo.map((t) => t.priority)).toEqual([1, 3, 5]);
  });
});

describe('tope de caracteres y estimaciones', () => {
  it('se niega a seguir sobre el tope salvo --allow-over', () => {
    expect(DEFAULT_CHAR_CAP).toBe(450_000);
    expect(checkCharCap(450_000, DEFAULT_CHAR_CAP, false).ok).toBe(true);
    const over = checkCharCap(450_001, DEFAULT_CHAR_CAP, false);
    expect(over.ok).toBe(false);
    expect(over.message).toContain('--allow-over');
    expect(checkCharCap(500_000, DEFAULT_CHAR_CAP, true).ok).toBe(true);
  });
  it('totales con y sin etiquetas, costo y tiempo', () => {
    const t = totalsFor([at('gato'), at('perro')], VOICE, -10);
    expect(t.plain).toBe(9);
    expect(t.billable).toBe(9 + 2 * '<prosody rate="-10%"></prosody>'.length);
    expect(estimateCostUsd(1_000_000)).toBe(15);
    expect(estimateCostUsd(400_000, 500_000)).toBe(0);
    expect(estimateWallSeconds(40, 'f0')).toBe(120); // 20 por minuto
    expect(estimateWallSeconds(300, 's0')).toBe(30);
  });
  it('el peso estimado crece con el bitrate', () => {
    expect(estimateBytes('Toca el gato.', 64)).toBeGreaterThan(estimateBytes('Toca el gato.', 32));
  });
});

describe('textos delicados y muestras', () => {
  it('detecta dígitos, abreviaturas, siglas y símbolos', () => {
    const r = findRiskyTexts([at('tres'), at('Son 3 gatos'), at('Dr. Gato'), at('USA'), at('uno + uno')]);
    expect(r.map((x) => x.text.text)).toEqual(['Son 3 gatos', 'Dr. Gato', 'USA', 'uno + uno']);
  });
  it('las muestras son ~12, distintas y sin sonido', () => {
    const many: AudioText[] = [];
    const cats: AudioCategory[] = ['palabra', 'instruccion', 'refuerzo', 'frase', 'intro', 'repeticion', 'ejercicio', 'sonido'];
    for (const c of cats) for (let i = 0; i < 90; i++) many.push(at(`${c} corto ${i}`, c));
    for (let i = 0; i < 90; i++) many.push(at(`Primera oración número ${i}. Segunda oración más larga número ${i}.`, 'instruccion'));
    many.push(at('pa, to', 'palabra'));
    const s = pickSamples(many);
    expect(s.length).toBeGreaterThanOrEqual(10);
    expect(s.length).toBeLessThanOrEqual(12);
    expect(new Set(s.map((t) => t.key)).size).toBe(s.length);
    expect(s.some((t) => t.category === 'sonido')).toBe(false);
  });
});

describe('tandas y precarga', () => {
  it('planBatches agrupa por prioridad en orden ascendente', async () => {
    const { planBatches } = await import('./tts');
    const b = planBatches([at('c', 'palabra', 5), at('a', 'refuerzo', 1), at('b', 'instruccion', 3), at('a2', 'refuerzo', 1)]);
    expect(b.map((x) => x.priority)).toEqual([1, 3, 5]);
    expect(b[0].items.map((t) => t.text)).toEqual(['a', 'a2']);
  });
  it('el precaché incluye prioridad 1-3 y los clips sin prioridad; el resto se cachea en ejecución', async () => {
    const { precacheFiles } = await import('./precache');
    const f = (n: string, priority?: number) => ({ file: `${n}.opus`, ...(priority ? { priority } : {}) });
    const m = { version: 1, clips: { [audioKey('a')]: f('a1', 1), [audioKey('b')]: f('b3', 3), [audioKey('c')]: f('c4', 4), [audioKey('d')]: f('d5', 5), [audioKey('e')]: f('e') } };
    expect(precacheFiles(m)).toEqual(['a1.opus', 'b3.opus', 'e.opus']);
  });
  it('parseManifest conserva una prioridad válida y descarta las raras', async () => {
    const { parseManifest } = await import('./voice');
    const a = audioKey('a');
    const b = audioKey('b');
    const m = parseManifest({ clips: { [a]: { file: 'a.opus', priority: 3 }, [b]: { file: 'b.opus', priority: 'x' } } });
    expect(m.clips[a].priority).toBe(3);
    expect(m.clips[b].priority).toBeUndefined();
  });
});
