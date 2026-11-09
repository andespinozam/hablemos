import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickVoice, waitForVoices } from './speech';

const v = (lang: string, name = lang) => ({ lang, name });

describe('pickVoice', () => {
  it('prefiere es-419, luego es-MX, es-US y es-EC', () => {
    const all = [v('en-US'), v('es-EC'), v('es-US'), v('es-MX'), v('es-419'), v('es-ES')];
    expect(pickVoice(all)?.lang).toBe('es-419');
    expect(pickVoice(all.filter((x) => x.lang !== 'es-419'))?.lang).toBe('es-MX');
    expect(pickVoice(all.filter((x) => !['es-419', 'es-MX'].includes(x.lang)))?.lang).toBe('es-US');
    expect(pickVoice([v('en-US'), v('es-EC'), v('es-ES')])?.lang).toBe('es-EC');
  });
  it('entre voces latinas prefiere la de mejor calidad (Premium/Mejorada) sobre la compacta', () => {
    const compact = v('es-MX', 'Paulina (compact)');
    const premium = v('es-MX', 'Paulina (Premium)');
    const enhanced = v('es-US', 'Marisol (Mejorada)');
    expect(pickVoice([compact, premium])).toBe(premium);
    expect(pickVoice([v('es-419', 'Plain'), enhanced])).toBe(enhanced);
    expect(pickVoice([enhanced, premium])).toBe(premium);
    expect(pickVoice([v('es-MX', 'Microsoft Dalia Online (Natural)'), v('es-419', 'Otra')])?.name).toContain('Natural');
  });
  it('a igual calidad mantiene el orden de región; una voz premium de España no gana a una latina', () => {
    expect(pickVoice([v('es-US', 'A'), v('es-MX', 'B')])?.name).toBe('B');
    expect(pickVoice([v('es-ES', 'Monica (Premium)'), v('es-MX', 'Paulina')])?.name).toBe('Paulina');
  });
  it('acepta guion bajo (Android) y mayúsculas distintas', () => {
    expect(pickVoice([v('es_MX')])?.lang).toBe('es_MX');
    expect(pickVoice([v('ES-mx')])?.lang).toBe('ES-mx');
  });
  it('si no hay latinas usa cualquier español, y null si no hay español', () => {
    expect(pickVoice([v('en-US'), v('es-ES')])?.lang).toBe('es-ES');
    expect(pickVoice([v('es')])?.lang).toBe('es');
    expect(pickVoice([v('en-US'), v('fr-FR')])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
  it('no confunde idiomas que solo empiezan con "es" (p. ej. "est")', () => {
    expect(pickVoice([v('et-EE'), v('est-XX')])).toBeNull();
  });
});

describe('waitForVoices', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function fakeSynth(initial: SpeechSynthesisVoice[]) {
    let voices = initial;
    const listeners = new Set<() => void>();
    return {
      synth: {
        getVoices: () => voices,
        addEventListener: (_: string, l: () => void) => listeners.add(l),
        removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      } as unknown as Pick<SpeechSynthesis, 'getVoices' | 'addEventListener' | 'removeEventListener'>,
      load(next: SpeechSynthesisVoice[]) {
        voices = next;
        [...listeners].forEach((l) => l());
      },
      listenerCount: () => listeners.size,
    };
  }
  const voice = { lang: 'es-MX' } as SpeechSynthesisVoice;

  it('responde de inmediato si las voces ya cargaron', async () => {
    expect(await waitForVoices(fakeSynth([voice]).synth)).toEqual([voice]);
  });
  it('espera el evento voiceschanged cuando cargan después', async () => {
    const f = fakeSynth([]);
    const pending = waitForVoices(f.synth);
    f.load([voice]);
    expect(await pending).toEqual([voice]);
    expect(f.listenerCount()).toBe(0);
  });
  it('no se queda esperando para siempre si nunca llegan voces', async () => {
    const f = fakeSynth([]);
    const pending = waitForVoices(f.synth, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual([]);
    expect(f.listenerCount()).toBe(0);
  });
});
