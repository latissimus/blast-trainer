import { describe, expect, it } from 'vitest';
import { prioritaetsZusammenfassung } from './meter.js';

describe('Set-O-Meter Prioritätszusammenfassung', () => {
  const slots = [{ tag: 'OK-H' }, { tag: 'OK-P' }];

  it('fasst reines Vorziehen ohne Zusatzvolumen zusammen', () => {
    expect(prioritaetsZusammenfassung(
      'Schulter',
      { status: 'aktiv', modus: 'reihenfolge', slots: [] },
      { modus: 'reihenfolge', saetze: 0 },
    )).toBe('Schulter zuerst · keine Zusatzsätze.');
  });

  it('nennt Zusatzsätze je Einheit und pro Cycle', () => {
    expect(prioritaetsZusammenfassung(
      'Unterarme',
      { status: 'aktiv', modus: 'plus', slots },
      { modus: 'plus', saetze: 2 },
    )).toBe('Unterarme zuerst · +2 Sätze in beiden OK-Einheiten · 4 zusätzliche Sätze pro Cycle.');
  });

  it('nennt bei Umverteilung auch Spender und Gesamtabzug', () => {
    expect(prioritaetsZusammenfassung(
      'Unterarme',
      { status: 'aktiv', modus: 'tausch', slots, spenderName: 'Brust' },
      { modus: 'tausch', saetze: 2, spender: 'Brust' },
    )).toBe('Unterarme zuerst · +2 Sätze in beiden OK-Einheiten · 4 Sätze von Brust umverteilt.');
  });
});
