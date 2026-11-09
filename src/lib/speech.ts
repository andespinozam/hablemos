/**
 * Voz: `speak` es el ÚNICO punto de salida de voz de la app. Si hay un clip grabado del texto
 * (`voice.ts`) lo toca; si no, usa speechSynthesis (español latino, lenta ~0.85, con carga
 * asíncrona de voces).
 */
import { playClip, stopClip } from './voice';

export const SPEECH_RATE = 0.85;
export const SLOW_RATE = 0.7;
/** Orden de preferencia; después, cualquier voz en español. */
const PREFERRED_LANGS = ['es-419', 'es-mx', 'es-us', 'es-ec'];
const VOICES_TIMEOUT_MS = 2000;

function normLang(lang: string): string {
  return lang.replace('_', '-').toLowerCase(); // Android usa es_MX
}

/**
 * Calidad aproximada por el nombre (el navegador no la informa): las voces "Premium", "Mejorada",
 * "Natural"/"Neural" suenan mucho mejor que las "compactas" que trae el iPad por defecto.
 */
export function voiceQuality(name: string | undefined): number {
  if (!name) return 0;
  const n = name.toLowerCase();
  if (/premium|natural|neural/.test(n)) return 3;
  if (/enhanced|mejorad|siri/.test(n)) return 2;
  if (/compact/.test(n)) return -1;
  return 0;
}

/**
 * Entre las voces latinas (es-419, es-MX, es-US, es-EC) elige la de mejor calidad; a igual calidad,
 * respeta ese orden. Sin latinas, lo mismo con cualquier español. Null si no hay voces en español.
 */
export function pickVoice<T extends { lang: string; name?: string }>(voices: readonly T[]): T | null {
  const latin = voices.filter((v) => PREFERRED_LANGS.includes(normLang(v.lang)));
  const pool = latin.length > 0 ? latin : voices.filter((v) => /^es(-|$)/.test(normLang(v.lang)));
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const v of pool) {
    const rank = PREFERRED_LANGS.indexOf(normLang(v.lang));
    const score = voiceQuality(v.name) * 10 - (rank < 0 ? PREFERRED_LANGS.length : rank);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

type SynthLike = Pick<SpeechSynthesis, 'getVoices' | 'addEventListener' | 'removeEventListener'>;

/** Las voces cargan de forma asíncrona (Chrome, Safari): espera `voiceschanged` con un tiempo máximo. */
export function waitForVoices(synth: SynthLike, timeoutMs = VOICES_TIMEOUT_MS): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    const timer = window.setTimeout(finish, timeoutMs);
    synth.addEventListener('voiceschanged', finish);
  });
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

let latest = 0;

/**
 * Dice el texto en voz alta. Corta lo que esté sonando. Resuelve al terminar
 * (o de inmediato si no hay voz): nunca se queda esperando ni lanza errores.
 */
export async function speak(text: string, rate: number = SPEECH_RATE): Promise<void> {
  if (!text) return;
  const mine = ++latest;
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  // Un clip a la vez: playClip corta el anterior. Con clip, no se usa la voz del sistema.
  if (await playClip(text, rate)) return;
  if (mine !== latest || !isSpeechSupported()) return;
  const synth = window.speechSynthesis;
  const voices = await waitForVoices(synth);
  if (mine !== latest) return; // otra instrucción se pidió mientras cargaban las voces

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(voices);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'es-419';
  }
  utterance.rate = rate;
  utterance.pitch = 1.05;

  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}

export function cancelSpeech(): void {
  latest++;
  stopClip();
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}
