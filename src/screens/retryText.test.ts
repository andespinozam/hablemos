import { describe, expect, it } from 'vitest';
import { retryText } from './SessionRunner';

describe('retryText', () => {
  it('usa el modelo del ítem y, si no hay, el objetivo', () => {
    expect(retryText({ id: 'a', target: 'pato', prompt: 'x', model: 'Es el pato.' })).toBe('Vamos otra vez, con calma. Es el pato.');
    expect(retryText({ id: 'a', target: 'pato', prompt: 'x' })).toBe('Vamos otra vez, con calma. pato.');
  });
  it('no duplica la puntuación final', () => {
    expect(retryText({ id: 'a', target: 't', prompt: 'x', model: 'Sopla fuerte.' })).toBe('Vamos otra vez, con calma. Sopla fuerte.');
    expect(retryText({ id: 'a', target: 't', prompt: 'x', model: 'guau, guau,' })).toBe('Vamos otra vez, con calma. guau, guau.');
    expect(retryText({ id: 'a', target: 't', prompt: 'x', model: '¡Hola!  ' })).toBe('Vamos otra vez, con calma. ¡Hola.');
  });
});
