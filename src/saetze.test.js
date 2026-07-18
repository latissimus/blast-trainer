import { describe, it, expect } from 'vitest';
import { targetSets, effTypeOf, exOf, setsForExercise } from './saetze.js';

// Diese Rechnungen scheitern nie laut: Steht eine falsche Satzzahl da, sieht sie
// aus wie eine richtige. Deshalb liegen die Regeln hier fest.

const zwei = { sets: [1, 3, 4], type: 'load', ex: [{ r: 'Comp' }, { r: 'Iso' }] };
const eine = { sets: [2, 4, 5], type: 'load', ex: [{ r: 'Comp' }] };

describe('Satzzahl je Level', () => {
  it('nimmt die Zahl des gewählten Levels', () => {
    expect(targetSets(zwei, 0)).toBe(1);
    expect(targetSets(zwei, 1)).toBe(3);
    expect(targetSets(zwei, 2)).toBe(4);
  });
});

describe('Wechsel-Verteilung auf Comp/Iso', () => {
  it('teilt gerade Satzzahlen hälftig', () => {
    // Level III = 4 Sätze -> 2 Comp + 2 Iso
    expect(setsForExercise(zwei, 2, 0)).toBe(2);
    expect(setsForExercise(zwei, 2, 1)).toBe(2);
  });

  it('gibt den Rest der ersten Übung', () => {
    // Level II = 3 Sätze -> 2 Comp + 1 Iso, nicht andersherum
    expect(setsForExercise(zwei, 1, 0)).toBe(2);
    expect(setsForExercise(zwei, 1, 1)).toBe(1);
  });

  it('lässt das Iso-Feld bei nur einem Satz leer', () => {
    // Der Kern: Level I = 1 Satz -> nur der Comp-Satz. Bekäme Iso hier auch
    // einen, träte man mehr Volumen an als das Level vorsieht.
    expect(setsForExercise(zwei, 0, 0)).toBe(1);
    expect(setsForExercise(zwei, 0, 1)).toBe(0);
  });

  it('gibt einer einzelnen Übung alle Sätze', () => {
    expect(setsForExercise(eine, 2, 0)).toBe(5);
  });

  it('summiert sich immer auf die Soll-Zahl', () => {
    // Egal welches Level: Was verteilt wird, muss dem Ziel entsprechen.
    for (const lvl of [0, 1, 2]) {
      const summe = [0, 1].reduce((s, xi) => s + setsForExercise(zwei, lvl, xi), 0);
      expect(summe).toBe(targetSets(zwei, lvl));
    }
  });
});

describe('Typ- und Feld-Ausnahmen je Level', () => {
  it('macht aus dem Cluster auf niedrigen Leveln einen Pump', () => {
    const arm = { sets: [1, 1, 1], type: 'mr', typeByTier: ['pump', 'mr', 'mr'], ex: [{}] };
    expect(effTypeOf(arm, 0)).toBe('pump');
    expect(effTypeOf(arm, 1)).toBe('mr');
  });

  it('bleibt beim Grundtyp, wenn es keine Ausnahme gibt', () => {
    expect(effTypeOf(zwei, 0)).toBe('load');
  });

  it('zeigt auf Level I nur ein Übungsfeld, sonst zwei', () => {
    const gh = { sets: [1, 1, 1], type: 'pump', ex: [{}, {}], exByTier: [[{}], [{}, {}], [{}, {}]] };
    expect(exOf(gh, 0).length).toBe(1);
    expect(exOf(gh, 2).length).toBe(2);
  });

  it('fällt ohne exByTier auf die Standardfelder zurück', () => {
    expect(exOf(zwei, 1).length).toBe(2);
  });
});
