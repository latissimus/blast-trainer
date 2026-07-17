import { describe, it, expect } from 'vitest';
import { FALTEN, summe, zahl, schnitt7 } from './messung.js';

// Diese Rechnungen scheitern nie laut: Eine falsche Summe sieht aus wie eine
// Zahl, ein falscher Trend wie eine Kurve. Deshalb liegen die Regeln hier fest.

const tag = (n) => new Date(Date.UTC(2026, 0, n)).toISOString().slice(0, 10);
const alleFalten = (wert) => Object.fromEntries(FALTEN.map(([k]) => [k, wert]));

describe('Hautfalten-Summe', () => {
  it('kennt genau die zwölf YPSI-Stellen', () => {
    expect(FALTEN.length).toBe(12);
    expect(FALTEN.map(([k]) => k)).toEqual([
      'kinn', 'wange', 'brust', 'ruecken', 'rippe', 'huefte',
      'bauch', 'trizeps', 'bizeps', 'wade', 'quadrizeps', 'beinbizeps',
    ]);
  });

  it('summiert alle zwölf', () => {
    const werte = Object.fromEntries(FALTEN.map(([k], i) => [k, i + 1]));   // 1..12
    expect(summe(werte)).toBe(78);
  });

  it('verweigert die Summe, wenn eine Falte fehlt', () => {
    // Der Kern der Sache: Eine Summe aus elf Falten sieht aus wie eine gültige
    // Zahl, ist aber mit früheren Messungen nicht vergleichbar. Lieber nichts.
    const elf = alleFalten(5);
    delete elf.bauch;
    expect(summe(elf)).toBeNull();
  });

  it('verweigert die Summe bei leerem Feld', () => {
    expect(summe({ ...alleFalten(5), kinn: '' })).toBeNull();
    expect(summe({ ...alleFalten(5), kinn: 'abc' })).toBeNull();
  });

  it('nimmt Komma als Dezimaltrennzeichen', () => {
    expect(summe(alleFalten('2,5'))).toBe(30);
  });

  it('rundet auf eine Nachkommastelle', () => {
    expect(summe(alleFalten(0.1))).toBe(1.2);   // 12 × 0,1 – ohne Rundung 1.2000000000000002
  });
});

describe('zahl()', () => {
  it('liest Komma und Punkt', () => {
    expect(zahl('3,5')).toBe(3.5);
    expect(zahl('3.5')).toBe(3.5);
  });
  it('gibt null für Unsinn', () => {
    expect(zahl('')).toBeNull();
    expect(zahl(null)).toBeNull();
    expect(zahl('abc')).toBeNull();
  });
});

describe('7-Tage-Schnitt beim Gewicht', () => {
  it('gibt am ersten Tag den Tageswert', () => {
    expect(schnitt7([{ datum: tag(1), kg: 81 }])[0].kg).toBe(81);
  });

  it('mittelt über sieben Tage', () => {
    const reihe = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ datum: tag(n), kg: 80 + n }));   // 81..87
    const s = schnitt7(reihe);
    expect(Math.round(s[6].kg * 100) / 100).toBe(84);   // Mittel aus 81..87
  });

  it('glättet einen Ausreißer statt ihm zu folgen', () => {
    // Der eigentliche Zweck: Ein Salz-Tag darf nicht wie ein Rückschlag aussehen.
    const reihe = [1, 2, 3, 4, 5, 6].map((n) => ({ datum: tag(n), kg: 80 }));
    reihe.push({ datum: tag(7), kg: 82 });   // +2 kg Wasser an einem Tag
    const s = schnitt7(reihe);
    expect(s[6].kg).toBeCloseTo(80.29, 1);   // Trend bewegt sich kaum
  });

  it('zieht nach einer Lücke keine alten Werte heran', () => {
    // Wer drei Wochen nicht wiegt, soll keinen Schnitt aus der Vorzeit bekommen.
    const s = schnitt7([{ datum: tag(1), kg: 80 }, { datum: tag(20), kg: 90 }]);
    expect(s[1].kg).toBe(90);
  });

  it('kommt mit einer leeren Reihe klar', () => {
    expect(schnitt7([])).toEqual([]);
  });
});
