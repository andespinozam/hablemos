/**
 * Sonidos agradables con Web Audio. Solo refuerzos positivos: esta app NO tiene
 * sonido de error ni de pérdida de puntos, y no debe agregarse ninguno.
 */

import { rhythmDuration, rhythmSchedule, type Pattern } from './rhythm';

export type SoundKind = 'chime' | 'star' | 'fanfare';

interface Note {
  /** Frecuencia en Hz. */
  freq: number;
  /** Inicio en segundos desde el comienzo del sonido. */
  at: number;
  /** Duración en segundos. */
  dur: number;
}

// Notas de escala mayor (Do-Mi-Sol-Do): siempre suenan alegres.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const SOUNDS: Record<SoundKind, readonly Note[]> = {
  chime: [
    { freq: C5, at: 0, dur: 0.35 },
    { freq: E5, at: 0.12, dur: 0.35 },
    { freq: G5, at: 0.24, dur: 0.5 },
  ],
  star: [
    { freq: G5, at: 0, dur: 0.25 },
    { freq: C6, at: 0.1, dur: 0.45 },
  ],
  fanfare: [
    { freq: C5, at: 0, dur: 0.3 },
    { freq: E5, at: 0.16, dur: 0.3 },
    { freq: G5, at: 0.32, dur: 0.3 },
    { freq: C6, at: 0.48, dur: 0.8 },
    { freq: G5, at: 0.64, dur: 0.8 },
  ],
};

const VOLUME = 0.12;
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Llamar dentro de un toque del usuario: Safari/Chrome no dejan sonar antes. */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

/** Una nota suave con ataque y caída sin chasquidos. */
function tone(c: AudioContext, freq: number, start: number, dur: number, volume: number = VOLUME): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Toca un ritmo de golpes cortos y largos. Devuelve cuánto dura (ms). */
export function playRhythm(pattern: Pattern): number {
  const c = getContext();
  if (!c) return 0;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  const start = c.currentTime + 0.05;
  for (const beat of rhythmSchedule(pattern)) tone(c, 440, start + beat.at / 1000, beat.dur / 1000, 0.2);
  return rhythmDuration(pattern);
}

/** Palmada suave al tocar el aplaudidor. */
export function playClap(): void {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  const t = c.currentTime + 0.01;
  tone(c, 330, t, 0.12, 0.22);
  tone(c, 660, t, 0.07, 0.08);
}

export function playSound(kind: SoundKind): void {
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  const start = c.currentTime + 0.02;
  for (const note of SOUNDS[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.freq;
    const t0 = start + note.at;
    // Ataque y caída suaves, sin chasquidos.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(VOLUME, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + note.dur + 0.05);
  }
}
