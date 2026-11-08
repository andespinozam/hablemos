/**
 * Frases fijas que dice la app. Están aquí (y no escritas en cada pantalla) para que el recolector
 * de textos de audio (`audioTexts.ts`) conozca exactamente lo que la app puede decir.
 */

export const PRAISES = ['¡Muy bien!', '¡Bravo!', '¡Qué bien lo haces!', '¡Eso es!', '¡Genial!', '¡Excelente!'] as const;

/** Al terminar la sesión. Sin el nombre del niño, para poder grabarla una sola vez. */
export const FINISH_PHRASE = '¡Terminaste! ¡Qué bien jugaste!';

/** Lo que se dice con calma tras un "Aún no": el modelo, sin puntuación doble. */
export function retryPhrase(model: string): string {
  const clean = model.trim().replace(/[.!?¡¿,;:\s]+$/, '');
  return `Vamos otra vez, con calma. ${clean}.`;
}

/** Al equivocarse al elegir: se repite la instrucción con calma. */
export function lookAgain(prompt: string): string {
  return `Mira otra vez. ${prompt}`;
}

/** Al equivocarse al escuchar. */
export function listenAgain(word: string): string {
  return `Escucha otra vez. ${word}.`;
}

/** Al soltar un objeto en el grupo equivocado (Categorías). */
export function whereGoes(article: string, word: string): string {
  return `¿Dónde va ${article} ${word}?`;
}

export function tryAgainWhere(article: string, word: string): string {
  return `Probemos otra vez. ${whereGoes(article, word)}`;
}
