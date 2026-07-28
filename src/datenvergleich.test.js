import { describe, expect, it } from 'vitest';
import { strukturellGleich } from './datenvergleich.js';

describe('strukturellGleich', () => {
  it('ignoriert die Schlüsselreihenfolge auch verschachtelt', () => {
    const lokal = {
      data: { 'OK-H': { 1: { brust: { names: ['Bank'], sets: [[{ w: '80', r: '8' }]] } } } },
      week: 1,
      volumen: { prioritaet: {} },
    };
    const server = {
      volumen: { prioritaet: {} },
      week: 1,
      data: { 'OK-H': { 1: { brust: { sets: [[{ r: '8', w: '80' }]], names: ['Bank'] } } } },
    };

    expect(strukturellGleich(lokal, server)).toBe(true);
  });

  it('erkennt echte Wert- und Array-Unterschiede', () => {
    expect(strukturellGleich({ sets: [1, 2] }, { sets: [1, 3] })).toBe(false);
    expect(strukturellGleich({ sets: [1, 2] }, { sets: [2, 1] })).toBe(false);
    expect(strukturellGleich({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
