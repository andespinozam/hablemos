/**
 * Cuenta de sílabas (heurística) para validar las listas de palabras. Las palabras del
 * contenido ya vienen separadas a mano ("pa-to"); esto detecta errores de captura.
 * Reglas: diptongo = vocal débil (i, u) + otra vocal, o dos débiles; hiato = dos vocales
 * fuertes (a, e, o) o una débil acentuada (í, ú) junto a otra vocal.
 */

const STRONG = 'aeoáéóíú';
const VOWELS = 'aeiouáéíóúü';

function isStrong(ch: string): boolean {
  return STRONG.includes(ch);
}

export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/-/g, '');
  // La u de que/qui/gue/gui no suena.
  w = w.replace(/qu(?=[eiéí])/g, 'q').replace(/gu(?=[eiéí])/g, 'g');
  // La y final suena como i (rey, hoy, muy).
  w = w.replace(/y$/, 'i');
  const groups = w.match(new RegExp(`[${VOWELS}]+`, 'g')) ?? [];
  let count = 0;
  for (const g of groups) {
    count += 1;
    for (let i = 1; i < g.length; i++) {
      if (isStrong(g[i - 1]) && isStrong(g[i])) count += 1; // hiato
    }
  }
  return count;
}

/** Errores típicos de separación silábica en una palabra con guiones; [] si no hay. */
export function hyphenationProblems(hyphenated: string): string[] {
  const problems: string[] = [];
  const w = hyphenated.toLowerCase();
  if (/c-h|l-l|r-r/.test(w)) problems.push('separa un dígrafo (ch, ll, rr)');
  if (/[bcdfgpt]-[lr]/.test(w)) problems.push('separa un grupo consonántico (bl, br, tr, ...)');
  if (/[bcdfghjklmnñpqrstvwxz]-[aeiouáéíóúü]/.test(w)) problems.push('una sílaba termina en consonante antes de una vocal');
  if (/--|^-|-$/.test(w)) problems.push('guiones mal puestos');
  return problems;
}
