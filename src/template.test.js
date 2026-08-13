import { describe, expect, it } from 'vitest';
import { TPL } from './template.js';

describe('Satzarten der Cycle-Vorlage', () => {
  it('führt die 10–15er-Boxen der B-Tage als feste MIDDLES', () => {
    const okMiddle = TPL['OK-P'].blocks.filter((b) => b.type === 'middle');
    const ukMiddle = TPL['UK-P'].blocks.filter((b) => b.type === 'middle');

    expect(okMiddle.map((b) => b.id)).toEqual([
      'chest_comp',
      'back_thick',
      'back_wide',
      'biceps_iso',
      'triceps_iso',
    ]);
    expect(ukMiddle.map((b) => b.id)).toEqual(['legs_comp']);
    expect([...okMiddle, ...ukMiddle].every((b) => b.reps === '10–15' && !b.free)).toBe(true);
  });

  it('trennt die drei Wiederholungsbereiche sauber', () => {
    const heavy = [...TPL['OK-H'].blocks, ...TPL['UK-H'].blocks];
    const bTage = [...TPL['OK-P'].blocks, ...TPL['UK-P'].blocks];
    expect(heavy.every((b) => b.reps === '6–10')).toBe(true);
    expect(bTage.filter((b) => b.type === 'middle').every((b) => b.reps === '10–15')).toBe(true);
    expect(bTage.filter((b) => b.type === 'pump').every((b) => b.reps === '15–25')).toBe(true);
  });

  it('lässt bei allen drei Satzarten 0 RIR zu', () => {
    const heavy = [...TPL['OK-H'].blocks, ...TPL['UK-H'].blocks];
    const bTage = [...TPL['OK-P'].blocks, ...TPL['UK-P'].blocks];
    expect(heavy.every((b) => b.rir === '0–1 RIR')).toBe(true);
    expect(bTage.filter((b) => b.type === 'middle').every((b) => b.rir === '0–2 RIR')).toBe(true);
    expect(bTage.filter((b) => b.type === 'pump').every((b) => b.rir === '0–1 RIR')).toBe(true);
  });

  it('reduziert Level II und den Level-III-Start bei Brust-Comp und Rücken-Dicke-MIDDLE', () => {
    expect(TPL['OK-H'].blocks.find((b) => b.id === 'chest_comp').sets).toEqual([2, 2, 2]);
    expect(TPL['OK-P'].blocks.find((b) => b.id === 'chest_comp').sets).toEqual([2, 2, 2]);
    expect(TPL['OK-P'].blocks.find((b) => b.id === 'back_thick').sets).toEqual([2, 2, 2]);
  });

  it('hält Rücken-Dicke bei HEAVYS ab Standard auf zwei Sätzen', () => {
    expect(TPL['OK-H'].blocks.find((b) => b.id === 'back_thick').sets).toEqual([2, 2, 2]);
  });

  it('hält seitliche/hintere Schulter bei HEAVYS und PUMPS auf zwei Sätzen', () => {
    expect(TPL['OK-H'].blocks.find((b) => b.id === 'delt_iso').sets).toEqual([2, 2, 2]);
    expect(TPL['OK-P'].blocks.find((b) => b.id === 'delt_iso').sets).toEqual([2, 2, 2]);
  });

  it('hält Beine-Comps bei Standard auf zwei und Waden auf drei Sätzen', () => {
    expect(TPL['UK-H'].blocks.find((b) => b.id === 'legs_comp').sets).toEqual([2, 2, 2]);
    expect(TPL['UK-P'].blocks.find((b) => b.id === 'legs_comp').sets).toEqual([2, 2, 2]);
    expect(TPL['UK-H'].blocks.find((b) => b.id === 'calves_iso').sets).toEqual([3, 3, 3]);
    expect(TPL['UK-P'].blocks.find((b) => b.id === 'calves_iso').sets).toEqual([3, 3, 3]);
  });

  it('benennt die B-Tage als MIDDLES & PUMPS', () => {
    expect(TPL['OK-P'].short).toBe('OK · MIDDLES & PUMPS');
    expect(TPL['UK-P'].short).toBe('UK · MIDDLES & PUMPS');
  });
});
