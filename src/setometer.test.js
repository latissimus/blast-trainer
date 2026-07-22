import { describe, it, expect } from 'vitest';
import { zaehleWoche, sortiert, zeigName, istDeload, tageDerWoche } from './setometer.js';
import { KONTEN } from './katalog.js';

// Das Set-O-Meter zaehlt den PLAN, nicht das Eingetragene: Sobald eine Übung
// gewählt ist, zählen die Sätze, die Level und Vorlage dafür vorsehen. Nur so
// steht das Bild, bevor die Woche gelaufen ist – dann, wenn man noch steuern kann.
//
// Ein Zählfehler sieht hier aus wie eine richtige Zahl. Deshalb festgezurrt.

const K = [
  { n: 'Bankdrücken', haupt: 'Brust', neben: ['Trizeps', 'Vordere Schulter'], typ: 'Comp' },
  { n: 'Fliegende', haupt: 'Brust', neben: ['Vordere Schulter'], typ: 'Iso' },
  { n: 'Curls', haupt: 'Bizeps', neben: [], typ: 'Iso' },
  { n: 'Rudern', haupt: 'Oberer Rücken', neben: ['Bizeps'], typ: 'Comp' },
  { n: 'Wadenheben', haupt: 'Waden', neben: [], typ: 'Iso' },
];

// Die meisten Rechenbeispiele setzen Level III ausdruecklich; der Standard
// ohne Auswahl wird separat als Level II geprueft.
// OK-A/chest: load, sets [1,2,4], zwei Felder (Comp + Iso).
// OK-A/p_calf: pump, sets [1,1,2], ein Feld.
const heavyBrust = (namen) => ({
  ex: { 'OK-A': { chest: namen } }, data: {}, tier: { 'OK-A|1': 2 },
});

describe('zaehleWoche – Plan statt Eingetragenes', () => {
  it('zählt, sobald eine Übung gewählt ist – ganz ohne Sätze im Log', () => {
    // Genau der Zweck: vorher sehen, was die Wahl liefert.
    const { konten } = zaehleWoche(heavyBrust(['Bankdrücken', 'Fliegende']), 1, K);
    expect(konten['Brust']).toBe(4);          // chest Level III = 4 Sätze
  });

  it('zählt ein leeres Feld nicht – das ist noch keine Entscheidung', () => {
    expect(zaehleWoche(heavyBrust(['', '']), 1, K).gesamt).toBe(0);
  });

  it('teilt Heavy-Sätze auf Comp und Iso auf', () => {
    // Nur das Comp-Feld gewählt -> nur dessen Anteil (4 Sätze / 2 Felder = 2).
    expect(zaehleWoche(heavyBrust(['Bankdrücken', '']), 1, K).konten['Brust']).toBe(2);
  });

  it('weist indirekte Sätze voll aus', () => {
    const { konten, indirekt } = zaehleWoche(heavyBrust(['Bankdrücken', '']), 1, K);
    expect(indirekt['Trizeps']).toBe(2);
    expect(indirekt['Vordere Schulter']).toBe(2);
    expect(konten['Trizeps']).toBe(1);
    expect(konten['Vordere Schulter']).toBe(1);
  });

  it('folgt dem eingestellten Level', () => {
    const p = (t) => ({ ex: { 'OK-A': { chest: ['Bankdrücken', 'Fliegende'] } }, data: {}, tier: { 'OK-A|1': t } });
    expect(zaehleWoche(p(0), 1, K).konten['Brust']).toBe(1);   // Level I
    expect(zaehleWoche(p(1), 1, K).konten['Brust']).toBe(2);   // Level II
    expect(zaehleWoche(p(2), 1, K).konten['Brust']).toBe(4);   // Level III
  });

  it('nimmt Level II, wenn nichts eingestellt ist', () => {
    const p = { ex: { 'OK-A': { chest: ['Bankdrücken', 'Fliegende'] } }, data: {} };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(2);
  });

  it('ignoriert eingetragene Gewichte – der Plan zählt, nicht die Ausführung', () => {
    const ohne = zaehleWoche(heavyBrust(['Bankdrücken', 'Fliegende']), 1, K).konten['Brust'];
    const mit = zaehleWoche({
      ex: { 'OK-A': { chest: ['Bankdrücken', 'Fliegende'] } },
      data: { 'OK-A': { 1: { chest: { sets: [[{ w: 80, r: 8 }], []] } } } },
      tier: { 'OK-A|1': 2 },
    }, 1, K).konten['Brust'];
    expect(mit).toBe(ohne);
  });
});

describe('zaehleWoche – Wochen und Tage', () => {
  it('nimmt in ungeraden Wochen die A-Tage, in geraden die B-Tage', () => {
    const p = { ex: { 'OK-A': { chest: ['Bankdrücken', 'Fliegende'] } }, data: {}, tier: { 'OK-A|1': 2 } };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(4);
    expect(zaehleWoche(p, 2, K).konten['Brust']).toBe(0);   // Woche 2 ist B
  });

  it('folgt einer von Hand gesetzten Rotation', () => {
    const p = { ex: { 'OK-A': { chest: ['Bankdrücken', 'Fliegende'] } }, data: {}, rot: { 2: 'A' }, tier: { 'OK-A|2': 2 } };
    expect(zaehleWoche(p, 2, K).konten['Brust']).toBe(4);
  });

  it('zählt im Deload nur die Cluster-Tage und fest auf Level I', () => {
    const p = {
      ex: { 'OK-A': { chest: ['Bankdrücken', 'Fliegende'] } },
      data: { MRs: { 7: { m_ch: { names: ['Bankdrücken'], sets: [[]] } } } },
      tier: { 'MRs|7': 2 },   // wird im Deload ignoriert
    };
    const { konten } = zaehleWoche(p, 7, K);
    expect(konten['Brust']).toBe(1);   // m_ch Level I = 1, Heavy-Tage zählen nicht mit
  });

  it('summiert dieselbe Übung über mehrere Tage der Woche', () => {
    const p = {
      ex: { 'OK-A': { chest: ['Bankdrücken', ''] } },
      data: { MRs: { 1: { m_ch: { names: ['Bankdrücken'], sets: [[]] } } } },
      tier: { 'OK-A|1': 2, 'MRs|1': 2 },
    };
    // OK-A/chest Comp = 2, MRs/m_ch Level III = 2
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(4);
  });
});

describe('zaehleWoche – Pump', () => {
  const pump = (extra) => ({
    data: { 'OK-A': { 1: { p_calf: { names: ['Wadenheben'], sets: [[]], ...(extra ? { extra } : {}) } } } },
    tier: { 'OK-A|1': 2 },
  });

  it('gibt jedem freien Feld die volle Satzzahl des Blocks', () => {
    expect(zaehleWoche(pump(), 1, K).konten['Waden']).toBe(2);   // p_calf Level III = 2
  });

  it('ignoriert alte manuelle Pump-Zusatzsätze', () => {
    expect(zaehleWoche(pump([3]), 1, K).konten['Waden']).toBe(2);
  });

  it('ignoriert Zusatzsätze bei Cluster-Blöcken', () => {
    // Alte extra-Werte sind nur noch Altlasten und duerfen den Plan nicht aendern.
    const p = { data: { MRs: { 1: { m_ch: { names: ['Bankdrücken'], sets: [[]], extra: [5] } } } } };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(2);
  });

  it('rechnet aktive Priorisierung und Umverteilung in die Planung ein', () => {
    const p = {
      tier: { 'UK-A|1': 1 },
      data: { 'UK-A': { 1: {
        p_bk: { names: ['Bankdrücken', 'Rudern'], sets: [[], []] },
        p_arm: { names: ['Curls', ''], sets: [[], []] },
      } } },
      volumen: { prioritaet: { Bizeps: { modus: 'tausch', spender: 'Brust' } } },
    };
    const { konten, direkt } = zaehleWoche(p, 1, K);
    expect(direkt.Bizeps).toBe(2);  // p_arm Level II: 1 + Prioritaet
    expect(direkt.Brust).toBe(1);   // p_bk Level II: 2 - Umverteilung
    expect(konten.Bizeps).toBeGreaterThan(direkt.Bizeps); // Rudern wirkt weiter indirekt
  });

  it('erhöht auch auf Level I das gewählte Pumpfeld um einen Satz', () => {
    const p = {
      tier: { 'UK-A|1': 0 },
      data: { 'UK-A': { 1: {
        p_arm: { names: ['Curls', ''], sets: [[], []] },
      } } },
      volumen: { prioritaet: { Bizeps: { modus: 'plus' } } },
    };
    expect(zaehleWoche(p, 1, K).direkt.Bizeps).toBe(2);
  });
});

describe('zaehleWoche – Robustheit', () => {
  it('meldet Übungen, die nicht im Katalog stehen', () => {
    const r = zaehleWoche(heavyBrust(['Fat-Gripz Halt', '']), 1, K);
    expect(r.ohneZuordnung).toBe(2);
    expect(r.unbekannte).toEqual(['Fat-Gripz Halt']);
    expect(r.konten['Brust']).toBe(0);
  });

  it('ignoriert unbekannte Tage und Blöcke', () => {
    const p = { ex: { 'Gibt-Es-Nicht': { chest: ['Bankdrücken'] }, 'OK-A': { quatsch: ['Bankdrücken'] } }, data: {} };
    expect(zaehleWoche(p, 1, K).gesamt).toBe(0);
  });

  it('kommt mit leerem Payload klar', () => {
    expect(zaehleWoche(null, 1, K).gesamt).toBe(0);
    expect(zaehleWoche({}, 1, K).konten['Brust']).toBe(0);
  });

  it('gibt immer alle 15 Konten zurück', () => {
    expect(Object.keys(zaehleWoche({}, 1, K).konten).sort()).toEqual([...KONTEN].sort());
  });

  it('erkennt die Übung unabhängig von Schreibweise und Leerzeichen', () => {
    expect(zaehleWoche(heavyBrust(['  bankdrücken ', '']), 1, K).konten['Brust']).toBe(2);
  });
});

describe('tageDerWoche / istDeload', () => {
  it('wechselt A und B im Overreach', () => {
    expect(tageDerWoche({}, 1)).toEqual(['OK-A', 'UK-A', 'MRs']);
    expect(tageDerWoche({}, 2)).toEqual(['OK-B', 'UK-B', 'MRs']);
  });
  it('gibt im Deload die drei Cluster-Slots', () => {
    expect(tageDerWoche({}, 7)).toEqual(['MRs', 'MRs-2', 'MRs-3']);
  });
  it('trennt Overreach von Deload', () => {
    expect(istDeload(6)).toBe(false);
    expect(istDeload(7)).toBe(true);
  });
});

describe('sortiert', () => {
  const konten = Object.fromEntries(KONTEN.map((k) => [k, 0]));

  it('stellt den größten Wert nach vorn', () => {
    const r = sortiert({ ...konten, Brust: 3, Waden: 9, Bizeps: 5 });
    expect(r.slice(0, 3).map((x) => x.konto)).toEqual(['Waden', 'Bizeps', 'Brust']);
  });

  it('gibt alle 15 Konten zurück, auch die leeren', () => {
    // Ein Muskel, der gar nichts abbekommt, ist die wichtigste Aussage des Bildes.
    expect(sortiert(konten)).toHaveLength(KONTEN.length);
  });

  it('ordnet bei Gleichstand stabil', () => {
    expect(sortiert(konten).map((x) => x.konto)).toEqual(KONTEN);
  });

  it('verträgt fehlende Schlüssel', () => {
    expect(sortiert({}).every((x) => x.wert === 0)).toBe(true);
  });
});

describe('zeigName', () => {
  it('kürzt die langen Schulternamen für die Anzeige', () => {
    expect(zeigName('Vordere Schulter')).toBe('Vord. Schulter');
    expect(zeigName('Brust')).toBe('Brust');
  });
  it('lässt jeden Kontonamen auf etwas Nichtleeres abbilden', () => {
    KONTEN.forEach((k) => expect(zeigName(k), k).toBeTruthy());
  });
});
