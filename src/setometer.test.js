import { describe, it, expect } from 'vitest';
import { zaehleWoche, defizite, istDeload, zeigZahl, zeigName, ZIELE } from './setometer.js';
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

describe('defizite', () => {
  const voll = Object.fromEntries(KONTEN.map((k) => [k, 99]));

  it('meldet nichts, wenn alle Ziele erreicht sind', () => {
    expect(defizite(voll, 1)).toEqual([]);
  });

  it('nennt genau die Konten unter Ziel', () => {
    const k = { ...voll, Brust: 3, Waden: 0 };
    expect(defizite(k, 1).sort()).toEqual(['Brust', 'Waden']);
  });

  it('zählt das Erreichen des Ziels nicht als Defizit', () => {
    expect(defizite({ ...voll, Brust: ZIELE['Brust'] }, 1)).toEqual([]);
  });

  it('schlägt im Deload keinen Alarm', () => {
    // Wenig Volumen ist dort der Zweck, kein Versäumnis.
    const leer = Object.fromEntries(KONTEN.map((k) => [k, 0]));
    expect(defizite(leer, 7)).toEqual([]);
    expect(defizite(leer, 8)).toEqual([]);
    expect(defizite(leer, 6).length).toBe(KONTEN.length);
  });
});

describe('istDeload', () => {
  it('trennt Overreach von Deload', () => {
    expect(istDeload(6)).toBe(false);
    expect(istDeload(7)).toBe(true);
  });
});

describe('zeigZahl', () => {
  it('rundet auf halbe Sätze und nutzt das Komma', () => {
    expect(zeigZahl(6)).toBe('6');
    expect(zeigZahl(6.5)).toBe('6,5');
    expect(zeigZahl(6.25)).toBe('6,5');
    expect(zeigZahl(6.1)).toBe('6');
  });
});

describe('gesamt (leere Woche)', () => {
  it('ist null, solange nichts eingetragen ist', () => {
    // Daran haengt der Unterschied zwischen "noch nichts gemacht" und
    // "Ziel verfehlt". Ohne ihn leuchtete jede Woche von Montag an rot.
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

describe('zeigName', () => {
  it('kürzt die langen Schulternamen für die Anzeige', () => {
    expect(zeigName('Vordere Schulter')).toBe('Vord. Schulter');
    expect(zeigName('Brust')).toBe('Brust');
  });
  it('lässt jeden Kontonamen auf etwas Nichtleeres abbilden', () => {
    KONTEN.forEach((k) => expect(zeigName(k), k).toBeTruthy());
  });
});

describe('Zieltabelle', () => {
  it('deckt alle 15 Konten ab', () => {
    // Ein fehlendes Ziel wäre stumm: Das Konto könnte nie ein Defizit melden.
    KONTEN.forEach((k) => expect(ZIELE[k], k).toBeGreaterThan(0));
  });
});
