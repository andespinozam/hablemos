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

/** es-419 > es-MX > es-US > es-EC > cualquier es-*; null si no hay voces en español. */
export function pickVoice<T extends { lang: string }>(voices: readonly T[]): T | null {
  for (const lang of PREFERRED_LANGS) {
    const found = voices.find((v) => normLang(v.lang) === lang);
    if (found) return found;
  }
  return voices.find((v) => /^es(-|$)/.test(normLang(v.lang))) ?? null;
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
