import { describe, it, expect } from 'vitest';
import { e1rm, bestE1, vergleichE1, heavyReihen, progressionsReihen, verlauf } from './progression.js';

// Eine falsche Progressionskurve sieht aus wie eine richtige – und sie ist der
// Wert, an dem man das ganze Training misst. Deshalb festgezurrt.

// payload: data[Einheit][Cycle][Block].sets[xi] = Sätze
const payload = (tag, block, name, proWoche) => ({
  ex: { [tag]: { [block]: [name] } },
  data: {
    [tag]: Object.fromEntries(
      Object.entries(proWoche).map(([wk, saetze]) => [wk, { [block]: { sets: [saetze] } }]),
    ),
  },
});

describe('1RM-Schaetzung (Epley)', () => {
  it('gibt bei einer Wiederholung die Last selbst', () => {
    expect(e1rm(100, 1)).toBeCloseTo(103.3, 1);
  });
  it('bewertet mehr Wdh. bei gleicher Last höher', () => {
    expect(e1rm(80, 8)).toBeGreaterThan(e1rm(80, 6));
  });
  it('macht Last und Wdh. vergleichbar', () => {
    // Der eigentliche Zweck: 85×6 ist Fortschritt gegenüber 80×8.
    expect(e1rm(85, 6)).toBeGreaterThan(e1rm(80, 8));
  });
  it('ignoriert leere oder unsinnige Eingaben', () => {
    expect(e1rm('', 8)).toBe(0);
    expect(e1rm(80, '')).toBe(0);
    expect(e1rm('abc', 5)).toBe(0);
  });
  it('nimmt Komma als Dezimaltrennzeichen', () => {
    expect(e1rm('82,5', 5)).toBeCloseTo(96.25, 2);
  });
});

describe('bestE1', () => {
  it('nimmt den besten Satz, nicht den letzten', () => {
    expect(bestE1([{ w: 80, r: 8 }, { w: 80, r: 5 }])).toBeCloseTo(e1rm(80, 8), 5);
  });
  it('kommt mit Lücken klar', () => {
    expect(bestE1([null, { w: 60, r: 10 }, {}])).toBeCloseTo(e1rm(60, 10), 5);
  });
});

describe('vergleichE1', () => {
  it('zeigt bei kleinen Lasten bereits eine Wiederholung mehr als Steigerung', () => {
    expect(vergleichE1([{ w: 7, r: 8 }], [{ w: 7, r: 9 }])).toBe(1);
  });

  it('zeigt bei kleinen Lasten bereits eine Wiederholung weniger als Abfall', () => {
    expect(vergleichE1([{ w: 7, r: 8 }], [{ w: 7, r: 7 }])).toBe(-1);
  });

  it('meldet identische Bestsaetze als gehalten und leere Eingaben noch nicht', () => {
    expect(vergleichE1([{ w: 7, r: 8 }], [{ w: 7, r: 8 }])).toBe(0);
    expect(vergleichE1([{ w: 7, r: 8 }], [])).toBeNull();
  });
});

describe('heavyReihen', () => {
  it('baut eine Reihe je Übung über die Cycles', () => {
    const p = payload('OK-H', 'back_thick', 'Multipresse Rudern', {
      1: [{ w: 80, r: 8 }],
      3: [{ w: 85, r: 8 }],
    });
    const r = heavyReihen(p);
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('Multipresse Rudern');
    expect(r[0].punkte.map((x) => x.week)).toEqual([1, 3]);
    expect(r[0].punkte[1].e1).toBeGreaterThan(r[0].punkte[0].e1);
  });

  it('lässt Übungen mit nur einer Woche weg', () => {
    // Aus einem Punkt laesst sich keine Entwicklung lesen.
    const p = payload('OK-H', 'back_thick', 'Rudern', { 1: [{ w: 80, r: 8 }] });
    expect(heavyReihen(p)).toHaveLength(0);
  });

  it('ignoriert PUMPS-Blöcke', () => {
    // Der Pool ist dort das Werkzeug, nicht die Progression.
    const p = payload('OK-P', 'chest_iso', 'Kabel Fliegende', { 1: [{ w: 20, r: 20 }], 2: [{ w: 22, r: 20 }] });
    expect(heavyReihen(p)).toHaveLength(0);
    expect(progressionsReihen(p)).toHaveLength(0);
  });

  it('führt feste MIDDLES auf der Progressionsseite', () => {
    const p = payload('OK-P', 'back_thick', 'PL Rudern', {
      1: [{ w: 40, r: 12 }],
      2: [{ w: 45, r: 12 }],
    });
    const r = progressionsReihen(p);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'PL Rudern', type: 'middle', typ: 'MIDDLES' });
  });

  it('führt gleiche Übung trotz anderer Schreibweise zusammen', () => {
    const p = {
      ex: { 'OK-H': { back_thick: ['Rudern'] } },
      data: {
        'OK-H': {
          1: { back_thick: { sets: [[{ w: 80, r: 8 }]] } },
          2: { back_thick: { sets: [[{ w: 82, r: 8 }]] } },
        },
      },
    };
    expect(heavyReihen(p)).toHaveLength(1);
  });

  it('nimmt pro Cycle den besten Satz', () => {
    const p = payload('OK-H', 'back_thick', 'Rudern', {
      1: [{ w: 80, r: 5 }, { w: 80, r: 9 }],
      2: [{ w: 85, r: 5 }],
    });
    expect(heavyReihen(p)[0].punkte[0].e1).toBeCloseTo(Math.round(e1rm(80, 9) * 10) / 10, 1);
  });

  it('überspringt Sätze ohne Eintrag und Felder ohne Namen', () => {
    const p = payload('OK-H', 'back_thick', '', { 1: [{ w: 80, r: 8 }], 2: [{ w: 85, r: 8 }] });
    expect(heavyReihen(p)).toHaveLength(0);
  });

  it('kommt mit leerem Payload klar', () => {
    expect(heavyReihen({})).toEqual([]);
    expect(heavyReihen(null)).toEqual([]);
  });

  it('sortiert die längste Reihe nach vorn', () => {
    const p = {
      ex: { 'OK-H': { back_thick: ['Kurz'], chest_comp: ['Lang'] } },
      data: {
        'OK-H': {
          1: { back_thick: { sets: [[{ w: 50, r: 5 }]] }, chest_comp: { sets: [[{ w: 60, r: 5 }]] } },
          2: { chest_comp: { sets: [[{ w: 62, r: 5 }]] } },
          3: { back_thick: { sets: [[{ w: 52, r: 5 }]] }, chest_comp: { sets: [[{ w: 64, r: 5 }]] } },
        },
      },
    };
    expect(heavyReihen(p)[0].name).toBe('Lang');
  });
});

describe('verlauf', () => {
  it('rechnet Differenz und Prozent vom Startwert', () => {
    const v = verlauf([{ week: 1, e1: 100 }, { week: 5, e1: 110 }]);
    expect(v.kg).toBe(10);
    expect(v.prozent).toBe(10);
  });
  it('zeigt Rückgang negativ', () => {
    expect(verlauf([{ week: 1, e1: 100 }, { week: 5, e1: 95 }]).kg).toBe(-5);
  });
  it('gibt null bei zu wenig Punkten', () => {
    expect(verlauf([{ week: 1, e1: 100 }])).toBeNull();
  });
});
