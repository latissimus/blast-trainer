import { describe, it, expect } from 'vitest';
import { zaehleWoche, sortiert, zeigName } from './setometer.js';
import { KONTEN } from './katalog.js';

// Das Set-O-Meter ist eine Zahl, an der man Entscheidungen festmacht ("Schultern
// fehlen noch"). Eine falsche Zahl sieht aus wie eine richtige – deshalb hier
// festgezurrt, besonders die Kanten: leere Gerüste, unbekannte Namen, Nebenspieler.

const K = [
  { n: 'Bankdrücken', haupt: 'Brust', neben: ['Trizeps', 'Vordere Schulter'], typ: 'Comp' },
  { n: 'Curls', haupt: 'Bizeps', neben: [], typ: 'Iso' },
  { n: 'Rudern', haupt: 'Oberer Rücken', neben: ['Bizeps'], typ: 'Comp' },
];

const satz = (w, r) => ({ w, r, rir: '' });
const leer = () => ({ w: '', r: '', rir: '' });

// data[Tag][Woche][Block] – 'chest' ist ein load-Block in OK-A, 'm_ch' ein mr-Block.
const bau = (block, saetze, name, tag = 'OK-A', woche = 1) => ({
  ex: { [tag]: { [block]: [name] } },
  data: { [tag]: { [woche]: { [block]: { sets: [saetze] } } } },
});

describe('zaehleWoche', () => {
  it('zählt den Hauptspieler voll', () => {
    const { konten } = zaehleWoche(bau('chest', [satz(80, 8), satz(80, 7)], 'Bankdrücken'), 1, K);
    expect(konten['Brust']).toBe(2);
  });

  it('zählt Nebenspieler halb', () => {
    const { konten } = zaehleWoche(bau('chest', [satz(80, 8), satz(80, 7)], 'Bankdrücken'), 1, K);
    expect(konten['Trizeps']).toBe(1);
    expect(konten['Vordere Schulter']).toBe(1);
  });

  it('zählt leere Satzzeilen nicht mit', () => {
    // Die App legt beim blossen Ansehen eines Tages leere Zeilen an. Zählten die
    // mit, füllte sich das Konto vom Hinsehen.
    const { konten } = zaehleWoche(bau('chest', [satz(80, 8), leer(), leer()], 'Bankdrücken'), 1, K);
    expect(konten['Brust']).toBe(1);
  });

  it('nimmt auch einen Satz mit, in dem nur das Gewicht steht', () => {
    const { konten } = zaehleWoche(bau('chest', [satz(80, '')], 'Bankdrücken'), 1, K);
    expect(konten['Brust']).toBe(1);
  });

  it('summiert über mehrere Tage derselben Woche', () => {
    const p = {
      ex: { 'OK-A': { chest: ['Bankdrücken'] }, 'OK-B': { chest: ['Bankdrücken'] } },
      data: {
        'OK-A': { 1: { chest: { sets: [[satz(80, 8)]] } } },
        'OK-B': { 1: { chest: { sets: [[satz(80, 8), satz(80, 8)]] } } },
      },
    };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(3);
  });

  it('trennt die Wochen sauber', () => {
    const p = {
      ex: { 'OK-A': { chest: ['Bankdrücken'] } },
      data: { 'OK-A': { 1: { chest: { sets: [[satz(80, 8)]] } }, 2: { chest: { sets: [[satz(80, 8)]] } } } },
    };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(1);
    expect(zaehleWoche(p, 2, K).konten['Brust']).toBe(1);
  });

  it('addiert Haupt- und Nebenrolle desselben Muskels', () => {
    // Curls (Bizeps voll) + Rudern (Bizeps halb) = 1,5
    const p = {
      ex: { 'UK-A': { p_arm: ['Curls'], p_bk: ['Rudern'] } },
      data: { 'UK-A': { 1: { p_arm: { sets: [[satz(20, 12)]] }, p_bk: { sets: [[satz(60, 10)]] } } } },
    };
    expect(zaehleWoche(p, 1, K).konten['Bizeps']).toBe(1.5);
  });

  it('meldet Sätze ohne Zuordnung, statt sie zu verschlucken', () => {
    const r = zaehleWoche(bau('chest', [satz(80, 8), satz(80, 8)], 'Fat-Gripz Halt'), 1, K);
    expect(r.ohneZuordnung).toBe(2);
    expect(r.unbekannte).toEqual(['Fat-Gripz Halt']);
    expect(r.konten['Brust']).toBe(0);
  });

  it('zählt Sätze ohne Übungsnamen nicht als unbekannte Übung', () => {
    const r = zaehleWoche(bau('chest', [satz(80, 8)], ''), 1, K);
    expect(r.ohneZuordnung).toBe(1);
    expect(r.unbekannte).toEqual([]);
  });

  it('nimmt den Namen aus dem Block, wenn er dort steht (Pump/Cluster)', () => {
    const p = { data: { MRs: { 1: { m_ch: { names: ['Bankdrücken'], sets: [[satz(60, 4)]] } } } } };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(1);
  });

  it('ignoriert unbekannte Tage und Blöcke', () => {
    const p = {
      ex: { 'Gibt-Es-Nicht': { chest: ['Bankdrücken'] }, 'OK-A': { quatsch: ['Bankdrücken'] } },
      data: {
        'Gibt-Es-Nicht': { 1: { chest: { sets: [[satz(80, 8)]] } } },
        'OK-A': { 1: { quatsch: { sets: [[satz(80, 8)]] } } },
      },
    };
    expect(zaehleWoche(p, 1, K).konten['Brust']).toBe(0);
  });

  it('kommt mit leerem Payload klar', () => {
    expect(zaehleWoche(null, 1, K).konten['Brust']).toBe(0);
    expect(zaehleWoche({}, 1, K).ohneZuordnung).toBe(0);
  });

  it('gibt immer alle 15 Konten zurück', () => {
    expect(Object.keys(zaehleWoche({}, 1, K).konten).sort()).toEqual([...KONTEN].sort());
  });
});




describe('gesamt (leere Woche)', () => {
  it('ist null, solange nichts eingetragen ist', () => {
    // Daran haengt, ob ueberhaupt ein Bild gezeigt wird oder der Hinweis
    // "noch nichts eingetragen".
    expect(zaehleWoche({}, 1, K).gesamt).toBe(0);
    expect(zaehleWoche(bau('chest', [leer(), leer()], 'Bankdrücken'), 1, K).gesamt).toBe(0);
  });
  it('zählt auch Sätze ohne Zuordnung als "es ist etwas passiert"', () => {
    expect(zaehleWoche(bau('chest', [satz(80, 8)], 'Unbekannt'), 1, K).gesamt).toBe(1);
  });
  it('summiert volle und halbe Wertungen', () => {
    // Bankdrücken: Brust 1 + Trizeps 0,5 + Vordere Schulter 0,5 = 2
    expect(zaehleWoche(bau('chest', [satz(80, 8)], 'Bankdrücken'), 1, K).gesamt).toBe(2);
  });
});

describe('sortiert', () => {
  const konten = Object.fromEntries(KONTEN.map((k) => [k, 0]));

  it('stellt den größten Wert nach vorn', () => {
    const r = sortiert({ ...konten, Brust: 3, Waden: 9, Bizeps: 5 });
    expect(r.slice(0, 3).map((x) => x.konto)).toEqual(['Waden', 'Bizeps', 'Brust']);
  });

  it('gibt alle 15 Konten zurück, auch die leeren', () => {
    // Ein Muskel, der gar nichts abbekommen hat, ist die wichtigste Aussage
    // des Bildes – er darf nicht einfach fehlen.
    expect(sortiert(konten)).toHaveLength(KONTEN.length);
  });

  it('ordnet bei Gleichstand stabil', () => {
    // Sonst springt die Reihenfolge bei jedem Neuzeichnen.
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

