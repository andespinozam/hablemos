/**
 * Piezas puras para generar los clips con una voz neuronal (Azure AI Speech): SSML, selección de
 * textos, estimaciones y tope de caracteres. No toca red ni disco: lo usa `scripts/audio-tts.mjs`.
 * La app en ejecución no importa este archivo (no entra al paquete final).
 */
import type { AudioText } from './audioTexts';
import type { ClipSource } from './voice';

/** Categorías que NO se sintetizan: fonemas aislados y onomatopeyas, que la TTS lee mal. */
export const EXCLUDED_CATEGORIES: readonly string[] = ['sonido'];

/** Velocidad por defecto (porcentaje de `prosody rate`): un poco más lenta, para niños. */
export const DEFAULT_RATE_PCT = -10;
/** Pausa tras punto, cierre de exclamación o de pregunta, entre oraciones. */
export const SENTENCE_BREAK_MS = 300;
/** Tope de caracteres facturables pendientes (se puede saltar con `--allow-over`). */
export const DEFAULT_CHAR_CAP = 450_000;
/** Precio de voces neuronales estándar: USD por millón de caracteres (docs de Azure, oct. 2026). */
export const PRICE_PER_MILLION_CHARS = 15;
/** Cuota mensual gratuita de F0 (caracteres neuronales; ver la página de precios vigente). */
export const F0_FREE_CHARS_PER_MONTH = 500_000;
/** F0: 20 transacciones por 60 s (no ajustable). S0: 30 por segundo por defecto. */
export const F0_REQUESTS_PER_MINUTE = 20;
export const S0_REQUESTS_PER_SECOND = 30;

// ---------- SSML ----------

/** Escapa los cinco caracteres especiales de XML. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** `es-EC-AndreaNeural` → `es-EC`. Lanza si el nombre no tiene la forma `xx-YY-Nombre`. */
export function localeOfVoice(voice: string): string {
  const m = /^([a-z]{2,3}-[A-Z]{2})-[A-Za-z0-9]+$/.exec(voice);
  if (!m) throw new Error(`Nombre de voz no válido: ${voice}`);
  return m[1];
}

/** `-10` → `-10%`; `5` → `+5%`. */
export function formatRate(pct: number): string {
  if (!Number.isFinite(pct) || pct < -50 || pct > 50) throw new Error(`La velocidad debe estar entre -50 y 50 (recibí ${pct})`);
  return `${pct > 0 ? '+' : ''}${Math.round(pct)}%`;
}

/** Texto ya escapado + pausa breve entre oraciones (no tras la última). */
function withPauses(escaped: string): string {
  return escaped.trim().replace(/([.!?…]+)\s+(?=\S)/g, `$1<break time="${SENTENCE_BREAK_MS}ms"/> `);
}

/**
 * SSML de un texto. `ratePct = 0` omite `prosody` (cada etiqueta cuenta como carácter facturable:
 * ver `billableChars`). El texto se escapa para XML.
 */
export function buildSsml(text: string, voice: string, ratePct: number = DEFAULT_RATE_PCT): string {
  const locale = localeOfVoice(voice);
  const body = withPauses(escapeXml(text));
  const inner = ratePct === 0 ? body : `<prosody rate="${formatRate(ratePct)}">${body}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voice}">${inner}</voice></speak>`;
}

/**
 * Caracteres facturables de un SSML: todo lo que va dentro de `<voice>` (texto, puntuación y
 * etiquetas como `prosody` o `break`); `speak` y `voice` no cuentan (docs de Azure, «Billable characters»).
 */
export function billableChars(ssml: string): number {
  const m = /<voice\b[^>]*>([\s\S]*)<\/voice>/.exec(ssml);
  return m ? [...m[1]].length : 0;
}

// ---------- Selección ----------

export interface SelectOptions {
  maxPriority?: number;
  category?: string;
  limit?: number;
  /** Rehacer clips `tts` ya existentes (nunca los `human`). */
  force?: boolean;
}
export interface Selection {
  todo: AudioText[];
  /** Fonemas y onomatopeyas: se graban a mano. */
  skippedSound: AudioText[];
  /** Ya existe un clip con tu voz: nunca se pisa. */
  skippedHuman: AudioText[];
  /** Ya existe un clip tts (reanudación). */
  skippedDone: AudioText[];
}

/**
 * Qué textos hay que sintetizar. `existing` = procedencia de los clips que ya hay en disco
 * (clave → source). Orden: prioridad y luego el orden del guion. `--category` y `--max-priority`
 * filtran lo que se ofrece; `--limit` recorta lo pendiente.
 */
export function selectTexts(texts: readonly AudioText[], existing: Readonly<Record<string, ClipSource | undefined>>, opts: SelectOptions = {}): Selection {
  const out: Selection = { todo: [], skippedSound: [], skippedHuman: [], skippedDone: [] };
  for (const t of texts) {
    if (opts.maxPriority !== undefined && t.priority > opts.maxPriority) continue;
    if (opts.category && t.category !== opts.category) continue;
    if (EXCLUDED_CATEGORIES.includes(t.category)) {
      out.skippedSound.push(t);
      continue;
    }
    const have = existing[t.key];
    if (have === 'human') out.skippedHuman.push(t);
    else if (have === 'tts' && !opts.force) out.skippedDone.push(t);
    else out.todo.push(t);
  }
  out.todo.sort((a, b) => a.priority - b.priority);
  if (opts.limit !== undefined && opts.limit >= 0) out.todo = out.todo.slice(0, opts.limit);
  return out;
}

// ---------- Estimaciones ----------

export interface Totals {
  count: number;
  /** Facturables (con etiquetas SSML). */
  billable: number;
  /** Solo el texto. */
  plain: number;
}

export function totalsFor(texts: readonly AudioText[], voice: string, ratePct: number): Totals {
  let billable = 0;
  let plain = 0;
  for (const t of texts) {
    billable += billableChars(buildSsml(t.text, voice, ratePct));
    plain += [...t.text].length;
  }
  return { count: texts.length, billable, plain };
}

/** Duración aproximada de un clip (s): ~13,5 caracteres por segundo a -10 %, mínimo 0,6 s. Heurística. */
export function estimateSeconds(text: string, ratePct: number = DEFAULT_RATE_PCT): number {
  const cps = 15 * (1 + ratePct / 100);
  return Math.max(0.6, [...text].length / cps) + 0.15;
}

/** Peso aproximado en disco (bytes) de un clip Opus: bitrate × duración + ~600 B de cabeceras Ogg/Opus. */
export function estimateBytes(text: string, bitrateKbps: number, ratePct: number = DEFAULT_RATE_PCT): number {
  return Math.round(((bitrateKbps * 1000) / 8) * estimateSeconds(text, ratePct) + 600);
}

export function estimateTotalBytes(texts: readonly AudioText[], bitrateKbps: number, ratePct: number = DEFAULT_RATE_PCT): number {
  return texts.reduce((n, t) => n + estimateBytes(t.text, bitrateKbps, ratePct), 0);
}

/** Segundos de pared según los límites vigentes: F0 = 20 peticiones por minuto; S0 ≈ 10 por segundo efectivas (límite 30 TPS). */
export function estimateWallSeconds(requests: number, tier: 'f0' | 's0'): number {
  return tier === 'f0' ? Math.ceil((requests / F0_REQUESTS_PER_MINUTE) * 60) : Math.ceil(requests / 10);
}

/** Costo en USD de `chars` caracteres facturables, descontando la cuota gratuita mensual si `freeChars > 0`. */
export function estimateCostUsd(chars: number, freeChars = 0): number {
  return (Math.max(0, chars - freeChars) / 1_000_000) * PRICE_PER_MILLION_CHARS;
}

export interface CapResult {
  ok: boolean;
  message: string;
}
/** Tope de caracteres pendientes: se niega a seguir si se supera, salvo `allowOver`. */
export function checkCharCap(pendingChars: number, cap: number, allowOver: boolean): CapResult {
  if (pendingChars <= cap) return { ok: true, message: `${pendingChars} caracteres pendientes (tope ${cap}).` };
  if (allowOver) return { ok: true, message: `Aviso: ${pendingChars} caracteres superan el tope de ${cap}; sigo porque usaste --allow-over.` };
  return { ok: false, message: `Me detengo: ${pendingChars} caracteres pendientes superan el tope de ${cap}. Usa --max-priority/--category/--limit para acotar, sube --max-chars o agrega --allow-over.` };
}

export function formatDuration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const m = Math.round(seconds / 60);
  return m < 90 ? `${m} min` : `${(m / 60).toFixed(1)} h`;
}
export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---------- Textos delicados y muestras ----------

/** Textos con dígitos, abreviaturas, siglas o símbolos: la TTS puede leerlos distinto a lo esperado. */
export function findRiskyTexts(texts: readonly AudioText[]): { text: AudioText; why: string }[] {
  const checks: [RegExp, string][] = [
    [/\d/, 'dígitos'],
    [/(?:^|[^\p{L}])(?:Sr|Sra|Srta|Dr|Dra|etc|pág|vs|aprox|núm|kg|cm|km|ml)(?![\p{L}])\.?/iu, 'abreviatura (o sílaba que suena a una)'],
    [/\b[A-ZÁÉÍÓÚÑ]{2,}\b/, 'sigla o mayúsculas'],
    [/[%&@#$€+=/\\*²³°_|~^<>]/, 'símbolo'],
    [/\.{2,}|…/, 'puntos suspensivos'],
  ];
  const out: { text: AudioText; why: string }[] = [];
  for (const t of texts) {
    const why = checks.filter(([re]) => re.test(t.text)).map(([, w]) => w);
    if (why.length) out.push({ text: t, why: why.join(', ') });
  }
  return out;
}

/**
 * ~`n` textos representativos (sin «sonido»): palabras sueltas (una con sílabas), instrucciones
 * cortas, una frase de cuento (varias oraciones), refuerzo, frase fija, intro, repeticiones y
 * escalera. Determinista: toma el elemento central de cada grupo.
 */
export function pickSamples(texts: readonly AudioText[], n = 12): AudioText[] {
  const pool = texts.filter((t) => !EXCLUDED_CATEGORIES.includes(t.category));
  const mid = (list: AudioText[], offset = 0) => list[Math.min(list.length - 1, Math.floor(list.length / 2) + offset)];
  const words = pool.filter((t) => t.category === 'palabra' && !t.text.includes(','));
  const syll = pool.filter((t) => t.category === 'palabra' && t.text.includes(','));
  const instr = pool.filter((t) => t.category === 'instruccion' && [...t.text].length <= 50);
  const story = pool.filter((t) => t.category === 'instruccion' && /[.!?]\s+\S/.test(t.text) && [...t.text].length > 60);
  const of = (c: string) => pool.filter((t) => t.category === c);
  const picks = [
    mid(words), mid(words, 40), mid(syll), mid(instr), mid(instr, 30), mid(story), mid(of('refuerzo')),
    mid(of('frase')), mid(of('intro')), mid(of('repeticion')), mid(of('repeticion'), 25), mid(of('ejercicio')),
  ].filter((t): t is AudioText => Boolean(t));
  const seen = new Set<string>();
  const unique = picks.filter((t) => !seen.has(t.key) && seen.add(t.key));
  return unique.slice(0, n);
}
