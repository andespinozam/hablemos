import { describe, expect, it } from 'vitest';
import { INITIAL_CHOICE, choose, showHint } from './choice';
import { ratingForMistakes, tryMove } from './orders';
import { seeded } from './random';

describe('choose', () => {
  it('acertar a la primera = Lo logró', () => {
    expect(choose(INITIAL_CHOICE, 'a', 'a')).toEqual({ kind: 'correct', rating: 'full' });
  });
  it('equivocarse descarta la opción sin terminar el ítem', () => {
    const out = choose(INITIAL_CHOICE, 'b', 'a');
    expect(out).toEqual({ kind: 'wrong', state: { wrong: ['b'] } });
  });
  it('acertar después de equivocarse = Con ayuda', () => {
    const wrong = choose(INITIAL_CHOICE, 'b', 'a');
    if (wrong.kind !== 'wrong') throw new Error('esperaba wrong');
    expect(choose(wrong.state, 'a', 'a')).toEqual({ kind: 'correct', rating: 'help' });
  });
  it('nunca produce "Aún no": equivocarse solo ayuda más', () => {
    let state = INITIAL_CHOICE;
    for (const id of ['b', 'c']) {
      const out = choose(state, id, 'a');
      if (out.kind === 'wrong') state = out.state;
    }
    expect(choose(state, 'a', 'a')).toEqual({ kind: 'correct', rating: 'help' });
  });
  it('ignora una opción ya descartada', () => {
    expect(choose({ wrong: ['b'] }, 'b', 'a')).toEqual({ kind: 'ignored' });
  });
  it('da pista tras 2 errores', () => {
    expect(showHint({ wrong: ['b'] })).toBe(false);
    expect(showHint({ wrong: ['b', 'c'] })).toBe(true);
  });
});

describe('órdenes', () => {
  const moves = [
    { obj: 'pelota', place: 'caja' },
    { obj: 'osito', place: 'cama' },
  ];
  it('acepta un paso correcto y lo quita de los pendientes', () => {
    expect(tryMove(moves, 'pelota', 'caja')).toEqual({ ok: true, remaining: [moves[1]] });
  });
  it('acepta los pasos en cualquier orden', () => {
    expect(tryMove(moves, 'osito', 'cama').ok).toBe(true);
  });
  it('rechaza objeto o lugar equivocado sin cambiar nada', () => {
    expect(tryMove(moves, 'pelota', 'cama')).toEqual({ ok: false, remaining: moves });
    expect(tryMove(moves, 'libro', 'caja').ok).toBe(false);
  });
  it('no acepta el mismo paso dos veces', () => {
    const once = tryMove(moves, 'pelota', 'caja').remaining;
    expect(tryMove(once, 'pelota', 'caja').ok).toBe(false);
  });
  it('califica según los errores', () => {
    expect(ratingForMistakes(0)).toBe('full');
    expect(ratingForMistakes(1)).toBe('help');
    expect(ratingForMistakes(7)).toBe('help');
  });
});

describe('seeded', () => {
  it('es reproducible y está en [0, 1)', () => {
    const a = seeded(42);
    const b = seeded(42);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});
