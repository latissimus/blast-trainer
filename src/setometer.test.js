import { describe, it, expect } from 'vitest';
import { KONTEN, KATALOG } from './katalog.js';
import { zaehleCycle, sortiert, istDeload, tageDerWoche } from './setometer.js';

const bank = 'LH Guillotine Bankdrücken';
const fly = 'Kabel Fliegende';

function basis(tier = 1) {
  return {
    week: 1,
    tier: {
      'OK-H|1': tier,
      'UK-H|1': tier,
      'OK-P|1': tier,
      'UK-P|1': tier,
    },
    ex: {},
    data: {},
    volumen: { prioritaet: {} },
  };
}

function mitBrust(tier = 1) {
  const p = basis(tier);
  p.ex['OK-H'] = {
    chest_comp: [bank],
    chest_iso: [fly],
  };
  p.ex['OK-P'] = {
    chest_comp: [bank],
  };
  p.data['OK-P'] = {
    1: {
      chest_comp: { sets: [[]] },
      chest_iso: { names: [fly], sets: [[]] },
    },
  };
  return p;
}

describe('zaehleCycle – Standardplan', () => {
  it('zählt den Plan, bevor Satzfelder ausgefüllt sind', () => {
    const r = zaehleCycle(mitBrust(), 1);
    expect(r.direkt.Brust).toBe(8);
  });

  it('zählt leere Übungsfelder nicht', () => {
    expect(zaehleCycle(basis(), 1).gesamt).toBe(0);
  });

  it('bildet Level I ab und startet Level III auf Standardniveau', () => {
    expect(zaehleCycle(mitBrust(0), 1).direkt.Brust).toBe(6);
    expect(zaehleCycle(mitBrust(1), 1).direkt.Brust).toBe(8);
    expect(zaehleCycle(mitBrust(2), 1).direkt.Brust).toBe(8);
  });

  it('zählt auf Level III nur gezielt gewählte Zusatzsätze', () => {
    const p = mitBrust(2);
    p.data['OK-P'][1].chest_comp.extra = { 0: 2 };
    expect(zaehleCycle(p, 1).direkt.Brust).toBe(10);
  });

  it('ignoriert gespeicherte Zusatzsätze außerhalb von Level III', () => {
    const p = mitBrust(1);
    p.data['OK-P'][1].chest_comp.extra = { 0: 3 };
    expect(zaehleCycle(p, 1).direkt.Brust).toBe(8);
  });

  it('nimmt Level II, wenn keine Auswahl gespeichert ist', () => {
    const p = mitBrust();
    p.tier = {};
    expect(zaehleCycle(p, 1).direkt.Brust).toBe(8);
  });

  it('ignoriert zusätzliche ausgefüllte Satzzeilen', () => {
    const p = mitBrust();
    p.data['OK-P'][1].chest_comp.sets = [[
      { w: 80, r: 12 }, { w: 80, r: 11 }, { w: 80, r: 10 },
      { w: 80, r: 9 }, { w: 80, r: 8 }, { w: 80, r: 7 },
    ]];
    expect(zaehleCycle(p, 1).direkt.Brust).toBe(8);
  });

  it('weist indirekte Sätze als ganze Sätze aus und gewichtet sie mit 0,5', () => {
    const r = zaehleCycle(mitBrust(), 1);
    // Nur die beiden Comp-Blöcke: 2 HEAVYS + 2 MIDDLES.
    expect(r.indirekt.Trizeps).toBe(4);
    expect(r.konten.Trizeps).toBe(2);
    expect(r.indirektQuellen.Trizeps[0].saetze).toBe(4);
  });

  it('summiert alle vier Einheiten desselben Cycles', () => {
    const p = basis();
    p.ex['OK-H'] = { chest_comp: [bank] };
    p.ex['OK-P'] = { chest_comp: [bank] };
    p.data['OK-P'] = { 1: { chest_comp: { sets: [[]] } } };
    expect(zaehleCycle(p, 1).direkt.Brust).toBe(4);
  });
});

describe('zaehleCycle – Priorität', () => {
  it('zählt vier Zusatzsätze auch ohne gewählte Prio-Übung', () => {
    const p = basis();
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    expect(zaehleCycle(p, 1).direkt.Unterarme).toBe(4);
  });

  it('zählt auf Wunsch nur einen Prioritätssatz je passender Einheit', () => {
    const p = basis();
    p.volumen.prioritaet.Unterarme = { modus: 'plus', saetze: 1 };
    expect(zaehleCycle(p, 1).direkt.Unterarme).toBe(2);
  });

  it('schlägt Priorität auf und zieht bei Umverteilung je Einheit zwei ab', () => {
    const p = mitBrust();
    p.volumen.prioritaet.Unterarme = {
      modus: 'tausch',
      spender: 'Brust',
      spenderName: 'Brust',
    };
    const r = zaehleCycle(p, 1);
    expect(r.direkt.Unterarme).toBe(4);
    expect(r.direkt.Brust).toBe(4);
  });

  it('verteilt bei der kleinen Priorität je Einheit nur einen Satz um', () => {
    const p = mitBrust();
    p.volumen.prioritaet.Unterarme = {
      modus: 'tausch',
      saetze: 1,
      spender: 'Brust',
    };
    const r = zaehleCycle(p, 1);
    expect(r.direkt.Unterarme).toBe(2);
    expect(r.direkt.Brust).toBe(6);
  });

  it('zählt indirekte Arbeit einer gewählten Prio-Übung', () => {
    const p = basis();
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    p.ex['OK-H'] = { 'prio:Unterarme': ['Kabel Reverse Curls'] };
    p.data['OK-P'] = {
      1: { 'prio:Unterarme': { names: ['Kabel Reverse Curls'], sets: [[]] } },
    };
    const r = zaehleCycle(p, 1);
    expect(r.direkt.Unterarme).toBe(4);
    expect(r.indirekt.Bizeps).toBe(4);
    expect(r.konten.Bizeps).toBe(2);
  });
});

describe('Cycle und Deload', () => {
  it('verwendet in Cycle 1–7 dieselben vier Einheiten', () => {
    expect(tageDerWoche({}, 1)).toEqual(['OK-H', 'UK-H', 'OK-P', 'UK-P']);
    expect(tageDerWoche({}, 7)).toEqual(['OK-H', 'UK-H', 'OK-P', 'UK-P']);
  });

  it('verwendet im Deload nur OK und UK', () => {
    expect(tageDerWoche({}, 8)).toEqual(['OK-D', 'UK-D']);
    expect(istDeload(7)).toBe(false);
    expect(istDeload(8)).toBe(true);
  });

  it('übernimmt im Deload die HEAVYS-Auswahl und halbiert die Standardsätze', () => {
    const p = basis();
    p.ex['OK-H'] = { chest_comp: [bank], chest_iso: [fly] };
    expect(zaehleCycle(p, 8).direkt.Brust).toBe(2);
  });

  it('setzt im Deload keine Priorität ein', () => {
    const p = basis();
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    expect(zaehleCycle(p, 8).direkt.Unterarme).toBe(0);
  });
});

describe('Robustheit und Sortierung', () => {
  it('ordnet persönliche Übungen im Set-O-Meter korrekt zu', () => {
    const p = basis();
    p.eigeneUebungen = [{
      id: 'e1', n: 'Meine Brustpresse', haupt: 'Brust', neben: ['Trizeps'],
      typ: 'Comp', art: 'eigen', aktiv: true, updatedAt: 1,
    }];
    p.ex['OK-H'] = { chest_comp: ['Meine Brustpresse'] };
    const r = zaehleCycle(p, 1);
    expect(r.direkt.Brust).toBe(2);
    expect(r.indirekt.Trizeps).toBe(2);
    expect(r.unbekannte).toEqual([]);
  });

  it('meldet unbekannte Übungen', () => {
    const p = basis();
    p.ex['OK-H'] = { chest_comp: ['Nicht im Katalog'] };
    const r = zaehleCycle(p, 1, KATALOG);
    expect(r.ohneZuordnung).toBe(2);
    expect(r.unbekannte).toEqual(['Nicht im Katalog']);
  });

  it('kommt mit leerem Payload klar und liefert alle Konten', () => {
    expect(zaehleCycle(null, 1).gesamt).toBe(0);
    expect(Object.keys(zaehleCycle({}, 1).konten).sort()).toEqual([...KONTEN].sort());
  });

  it('sortiert nach gewichteter Cycle-Arbeit', () => {
    const konten = Object.fromEntries(KONTEN.map((k) => [k, 0]));
    konten.Brust = 10;
    konten.Bizeps = 5;
    expect(sortiert(konten).slice(0, 2).map((r) => r.konto)).toEqual(['Brust', 'Bizeps']);
  });
});
