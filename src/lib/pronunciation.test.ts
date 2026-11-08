import { describe, expect, it } from 'vitest';
import substitutions from '../content/substitutions.json';
import type { PronunciationItem, PronunciationRecord, PronunciationResponse, PronunciationStatus } from './db';
import { PHONEMES, getPhoneme } from './phonemes';
import {
  BLOCK_TARGET,
  CONSOLIDATED_RATIO,
  analyzeProcesses,
  analyzeSounds,
  blockProgress,
  buildPronunciationItems,
  chunkBlocks,
  classify,
  cleanSubstitution,
  clampAge,
  compareSounds,
  dominantSubstitution,
  optionalPhonemes,
  pendingPronunciation,
  pickWordsByPosition,
  processItems,
  pronunciationStatus,
  requiredPhonemes,
  shuffleForRepeat,
  substitutionOptions,
  upsertResponse,
  workOrder,
} from './pronunciation';
import { seeded } from './random';

const DAY = 24 * 60 * 60 * 1000;

function record(ageYears: number, seed = 1): PronunciationRecord {
  return {
    id: 'r1',
    profileId: 'p1',
    kind: 'baseline',
    createdAt: 1,
    ageYears,
    items: buildPronunciationItems(ageYears, seeded(seed)),
    responses: [],
  };
}

function answer(
  rec: PronunciationRecord,
  fn: (item: PronunciationItem) => { status: PronunciationStatus; substitution?: string; mode?: 'espontanea' | 'repetida' },
): PronunciationRecord {
  const responses: PronunciationResponse[] = rec.items.map((item) => {
    const a = fn(item);
    return { itemId: item.id, mode: a.mode ?? 'espontanea', status: a.status, substitution: a.substitution, at: 10 };
  });
  return { ...rec, responses };
}

describe('selección de palabras por posición', () => {
  it('cubre inicio, medio y final cuando hay palabras en las tres posiciones', () => {
    const p = getPhoneme('p')!;
    for (let seed = 1; seed <= 20; seed++) {
      const words = pickWordsByPosition(p, seeded(seed));
      expect(words.map((w) => w.position)).toEqual(['inicio', 'medio', 'final'].filter((x) => p.words.some((w) => w.position === x)).slice(0, 3));
      expect(new Set(words.map((w) => w.word)).size).toBe(words.length);
    }
  });

  it('toma 2-3 palabras de cada fonema, distintas y en posiciones distintas si se puede', () => {
    for (const p of PHONEMES.filter((x) => x.kind === 'sound')) {
      const words = pickWordsByPosition(p, seeded(3));
      expect(words.length, p.id).toBeGreaterThanOrEqual(2);
      expect(words.length, p.id).toBeLessThanOrEqual(3);
      const positions = new Set(p.words.map((w) => w.position));
      expect(new Set(words.map((w) => w.position)).size, p.id).toBe(Math.min(words.length, positions.size));
    }
  });

  it('es reproducible con la misma semilla', () => {
    const a = buildPronunciationItems(4, seeded(9)).map((i) => i.id);
    const b = buildPronunciationItems(4, seeded(9)).map((i) => i.id);
    expect(a).toEqual(b);
  });
});

describe('ítems por edad', () => {
  it('a los 3 años evalúa solo fonemas de 3 años y deja como opcionales 1-2 de 4 años', () => {
    const items = buildPronunciationItems(3, seeded(2));
    const required = items.filter((i) => i.phonemeId && !i.optional);
    expect(required.every((i) => getPhoneme(i.phonemeId!)!.age <= 3)).toBe(true);
    const optional = [...new Set(items.filter((i) => i.optional).map((i) => i.phonemeId))];
    expect(optional.length).toBeGreaterThanOrEqual(1);
    expect(optional.length).toBeLessThanOrEqual(2);
    expect(optional.every((id) => getPhoneme(id!)!.age === 4)).toBe(true);
  });

  it('a los 5 años nunca incluye avanzados como obligatorios; los opcionales son avanzados', () => {
    expect(requiredPhonemes(5).some((p) => p.advanced)).toBe(false);
    const opt = optionalPhonemes(5, seeded(4));
    expect(opt.length).toBe(2);
    expect(opt.every((p) => p.advanced)).toBe(true);
  });

  it('no usa los grupos "kind: syllables" como sonido, y fija la edad al rango 3-5', () => {
    expect(requiredPhonemes(5).some((p) => p.kind === 'syllables')).toBe(false);
    expect(clampAge(2)).toBe(3);
    expect(clampAge(7)).toBe(5);
    expect(requiredPhonemes(2).map((p) => p.id)).toEqual(requiredPhonemes(3).map((p) => p.id));
  });

  it('los ids son únicos y la posición coincide con positionOf (viene de phonemes.json)', () => {
    const items = buildPronunciationItems(5, seeded(5));
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items.filter((x) => x.phonemeId)) {
      const w = getPhoneme(i.phonemeId!)!.words.find((x) => x.word === i.word)!;
      expect(i.position).toBe(w.position);
    }
  });
});

describe('mini revisión de procesos', () => {
  it('3 palabras de 3+ sílabas y 3 con grupos distintos', () => {
    const items = processItems(seeded(6));
    const sil = items.filter((i) => i.process === 'silabas');
    const gru = items.filter((i) => i.process === 'grupos');
    expect(sil).toHaveLength(3);
    expect(gru).toHaveLength(3);
    expect(sil.every((i) => i.syllables.length >= 3)).toBe(true);
    expect(gru.every((i) => /(bl|pl|cl|fl|gl|br|pr|cr|fr|gr|tr|dr)/.test(i.word))).toBe(true);
  });

  it('se resumen como no observado / ocasional / frecuente', () => {
    const rec = answer(record(4), (i) => ({ status: i.process === 'silabas' ? 'omitida' : 'correcta' }));
    const [sil, gru] = analyzeProcesses(rec);
    expect(sil).toMatchObject({ process: 'silabas', n: 3, affected: 3, level: 'frecuente' });
    expect(gru).toMatchObject({ process: 'grupos', affected: 0, level: 'no-observado' });
    let one = 0;
    const rec2 = answer(record(4), (i) => ({ status: i.process === 'grupos' && one++ === 0 ? 'omitida' : 'correcta' }));
    expect(analyzeProcesses(rec2).find((p) => p.process === 'grupos')!.level).toBe('ocasional');
  });
});

describe('bloques', () => {
  it('son de ~5 minutos y no separan las palabras de un mismo fonema', () => {
    for (const age of [3, 4, 5]) {
      const items = buildPronunciationItems(age, seeded(7));
      const blocks = chunkBlocks(items);
      expect(blocks.flat().map((i) => i.id)).toEqual(items.map((i) => i.id));
      for (const b of blocks) expect(b.length).toBeLessThanOrEqual(BLOCK_TARGET);
      for (const p of new Set(items.filter((i) => i.phonemeId).map((i) => i.phonemeId))) {
        const inBlocks = blocks.filter((b) => b.some((i) => i.phonemeId === p));
        expect(inBlocks.length, `${p} a los ${age}`).toBe(1);
      }
    }
  });

  it('el progreso permite pausar y retomar en el primer bloque incompleto', () => {
    const rec = record(4);
    const blocks = chunkBlocks(rec.items);
    expect(blockProgress(rec)).toMatchObject({ answered: 0, nextBlock: 0, done: false, blocks: blocks.length });
    const half: PronunciationRecord = {
      ...rec,
      responses: blocks[0].map((i) => ({ itemId: i.id, mode: 'espontanea', status: 'correcta', at: 1 })),
    };
    expect(blockProgress(half)).toMatchObject({ nextBlock: 1, done: false, answered: blocks[0].length });
    const all = answer(rec, () => ({ status: 'correcta' }));
    expect(blockProgress(all)).toMatchObject({ nextBlock: -1, done: true, answered: rec.items.length });
  });

  it('responder de nuevo un ítem reemplaza la respuesta', () => {
    const r1: PronunciationResponse = { itemId: 'a', mode: 'espontanea', status: 'omitida', at: 1 };
    const r2: PronunciationResponse = { itemId: 'a', mode: 'repetida', status: 'correcta', at: 2 };
    expect(upsertResponse([r1], r2)).toEqual([r2]);
    expect(upsertResponse([r1], { ...r2, itemId: 'b' })).toHaveLength(2);
  });

  it('retoma la evaluación a medias más reciente', () => {
    const a = { ...record(3), id: 'a', createdAt: 1 };
    const b = { ...record(3), id: 'b', createdAt: 5 };
    const c = { ...record(3), id: 'c', createdAt: 9, completedAt: 10 };
    expect(pendingPronunciation([a, b, c])!.id).toBe('b');
    expect(pendingPronunciation([c])).toBeUndefined();
  });
});

describe('reevaluación', () => {
  it('repite los mismos ítems en otro orden, con opcionales y procesos al final', () => {
    const items = buildPronunciationItems(4, seeded(8));
    const again = shuffleForRepeat(items, seeded(99));
    expect(again.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    expect(again.map((i) => i.id)).not.toEqual(items.map((i) => i.id));
    const firstProcess = again.findIndex((i) => i.process);
    expect(again.slice(firstProcess).every((i) => i.process)).toBe(true);
    const lastRequired = again.map((i) => !i.optional && !i.process).lastIndexOf(true);
    const firstOptional = again.findIndex((i) => i.optional);
    expect(firstOptional).toBeGreaterThan(lastRequired);
    // los bloques siguen sin separar fonemas
    for (const p of new Set(again.filter((i) => i.phonemeId).map((i) => i.phonemeId))) {
      expect(chunkBlocks(again).filter((b) => b.some((i) => i.phonemeId === p)).length).toBe(1);
    }
  });

  it('se sugiere 28 días después de la última evaluación terminada', () => {
    const done = { ...record(4), completedAt: 100 * DAY };
    expect(pronunciationStatus([], 1)).toEqual({ state: 'none' });
    expect(pronunciationStatus([record(4)], 1)).toEqual({ state: 'none' });
    expect(pronunciationStatus([done], 110 * DAY)).toMatchObject({ state: 'ok', daysLeft: 18 });
    expect(pronunciationStatus([done], 128 * DAY)).toMatchObject({ state: 'due', daysOverdue: 0 });
    expect(pronunciationStatus([done], 130 * DAY)).toMatchObject({ state: 'due', daysOverdue: 2 });
  });
});

describe('clasificación', () => {
  it('consolidado con >= 80 %, esperable si es de edad mayor o avanzado, a estimular si ya toca', () => {
    expect(CONSOLIDATED_RATIO).toBe(0.8);
    expect(classify({ age: 4, advanced: false }, 4, 0.8)).toBe('consolidado');
    expect(classify({ age: 4, advanced: false }, 4, 0.79)).toBe('estimular');
    expect(classify({ age: 3, advanced: false }, 5, 0)).toBe('estimular');
    expect(classify({ age: 5, advanced: false }, 4, 0)).toBe('esperable');
    expect(classify({ age: 5, advanced: true }, 5, 0)).toBe('esperable');
    expect(classify({ age: 5, advanced: true }, 5, 1)).toBe('consolidado');
  });
});

describe('resultados por sonido y posición', () => {
  it('resume estado, sustitución dominante y constancia', () => {
    const rec = answer(record(4, 3), (i) => {
      if (i.phonemeId === 's' && i.position === 'inicio') return { status: 'sustituida', substitution: 't' };
      if (i.phonemeId === 'l') return i.position === 'inicio' ? { status: 'omitida' } : { status: 'sustituida', substitution: 'd' };
      return { status: 'correcta' };
    });
    const results = analyzeSounds(rec);
    const s = results.find((r) => r.phonemeId === 's')!;
    const sInicio = s.positions.find((p) => p.position === 'inicio')!;
    expect(sInicio).toMatchObject({ state: 'con-errores', substitution: 't', consistency: 'constante' });
    expect(s.substitution).toBe('t');
    expect(s.consistency).toBe('variable'); // bien en otras posiciones y mal al inicio
    expect(s.classification).toBe('estimular');
    const l = results.find((r) => r.phonemeId === 'l')!;
    expect(l.consistency).toBe('variable'); // omitida + sustituida
    expect(l.accuracy).toBe(0);
    const p = results.find((r) => r.phonemeId === 'p')!;
    expect(p.consistency).toBeNull();
    expect(p.classification).toBe('consolidado');
    expect(p.positions.every((x) => x.state === 'correcta')).toBe(true);
  });

  it('una sustitución siempre igual es constante', () => {
    const rec = answer(record(3, 4), (i) => (i.phonemeId === 'k' ? { status: 'sustituida', substitution: 't' } : { status: 'correcta' }));
    const k = analyzeSounds(rec).find((r) => r.phonemeId === 'k')!;
    expect(k.consistency).toBe('constante');
    expect(k.positions.every((p) => p.consistency === 'constante')).toBe(true);
  });

  it('cuenta las respuestas repetidas y solo analiza lo respondido', () => {
    const rec = record(4, 3);
    const first = rec.items.find((i) => i.phonemeId === 'p')!;
    const partial = { ...rec, responses: [{ itemId: first.id, mode: 'repetida' as const, status: 'correcta' as const, at: 1 }] };
    const results = analyzeSounds(partial);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ phonemeId: 'p', n: 1, repeated: 1 });
  });

  it('la sustitución más frecuente gana', () => {
    const mk = (substitution: string): PronunciationResponse => ({ itemId: 'x', mode: 'espontanea', status: 'sustituida', substitution, at: 1 });
    expect(dominantSubstitution([mk('t'), mk('d'), mk('d')])).toBe('d');
    expect(dominantSubstitution([])).toBeUndefined();
  });
});

describe('orden de trabajo', () => {
  it('primero tempranos que falla, luego los de su edad y al final tardíos como metas suaves', () => {
    const rec = answer(record(5, 5), (i) => {
      const age = getPhoneme(i.phonemeId ?? '')?.age;
      if (['t', 'm'].includes(i.phonemeId ?? '')) return { status: 'omitida' }; // temprano (3)
      if (i.phonemeId === 'l') return { status: 'distorsionada' }; // de 4
      if (i.phonemeId === 'r') return { status: 'sustituida', substitution: 'l' }; // de su edad (5)
      if (age === 5 && i.optional) return { status: 'omitida' }; // avanzado opcional
      return { status: 'correcta' };
    });
    const order = workOrder(analyzeSounds(rec), 5);
    const groups = order.map((o) => o.group);
    expect(groups).toEqual([...groups].sort((a, b) => ['temprano', 'edad', 'tardio'].indexOf(a) - ['temprano', 'edad', 'tardio'].indexOf(b)));
    expect(order.filter((o) => o.group === 'temprano').map((o) => o.phonemeId).sort()).toEqual(['l', 'm', 't']);
    expect(order.filter((o) => o.group === 'edad').map((o) => o.phonemeId)).toEqual(['r']);
    const late = order.filter((o) => o.group === 'tardio');
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((o) => o.soft)).toBe(true);
    expect(order.find((o) => o.phonemeId === 'r')!.substitution).toBe('l');
  });

  it('dentro de un grupo, primero lo que menos logra; los consolidados no entran', () => {
    const rec = answer(record(4, 6), (i) => {
      if (i.phonemeId === 'p') return { status: 'omitida' };
      if (i.phonemeId === 'b') return { status: i.position === 'inicio' ? 'omitida' : 'correcta' };
      return { status: 'correcta' };
    });
    const order = workOrder(analyzeSounds(rec), 4);
    expect(order.map((o) => o.phonemeId).slice(0, 2)).toEqual(['p', 'b']);
    expect(order.some((o) => o.phonemeId === 'm')).toBe(false);
  });
});

describe('comparación entre evaluaciones', () => {
  it('muestra antes, ahora y cambio por sonido', () => {
    const base = record(4, 2);
    const before = analyzeSounds(answer(base, (i) => ({ status: i.phonemeId === 's' ? 'omitida' : 'correcta' })));
    const after = analyzeSounds(answer(base, () => ({ status: 'correcta' })));
    const s = compareSounds(before, after).find((c) => c.phonemeId === 's')!;
    expect(s).toMatchObject({ before: 0, after: 100, delta: 100, beforeClass: 'estimular', afterClass: 'consolidado' });
  });
});

describe('sustituciones', () => {
  it('toda clave de substitutions.json es un fonema real y cada fonema tiene entrada', () => {
    const ids = PHONEMES.map((p) => p.id).filter((id) => id !== 'tres-silabas');
    const keys = Object.keys(substitutions.substitutions);
    for (const k of keys) expect(PHONEMES.some((p) => p.id === k), k).toBe(true);
    for (const id of ids) expect(keys, id).toContain(id);
  });

  it('no se sugiere el propio sonido como sustitución', () => {
    for (const [id, list] of Object.entries(substitutions.substitutions)) {
      expect(list, id).not.toContain(id);
      expect(new Set(list).size, id).toBe(list.length);
    }
  });

  it('limpia lo que escribe el adulto', () => {
    expect(cleanSubstitution('  T ')).toBe('t');
    expect(cleanSubstitution('a b')).toBe('ab');
    expect(cleanSubstitution('   ')).toBe('');
    expect(cleanSubstitution('abcdefghijkl')).toHaveLength(8);
    expect(substitutionOptions('rr')).toContain('l');
    expect(substitutionOptions('no-existe')).toEqual([]);
  });
});
