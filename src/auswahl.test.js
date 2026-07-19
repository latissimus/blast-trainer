import { describe, it, expect } from 'vitest';
import { passende, auswahlGruppen, imKatalog, eintragVon } from './auswahl.js';
import { KATALOG, KONTEN } from './katalog.js';
import { TPL } from './template.js';

// Eine leere Auswahlliste ist der schlimmste Fehler dieser Funktion: Im Studio
// steht man dann vor einem Feld, das nichts anbietet, und kann nichts eintragen.
// Deshalb wird unten jeder Slot der Vorlage darauf geprüft.

const K = [
  { n: 'A Comp Brust', haupt: 'Brust', neben: ['Trizeps'], typ: 'Comp' },
  { n: 'B Iso Brust', haupt: 'Brust', neben: [], typ: 'Iso' },
  { n: 'C Comp Lat', haupt: 'Lat', neben: ['Bizeps'], typ: 'Comp' },
  { n: 'D Iso Waden', haupt: 'Waden', neben: [], typ: 'Iso' },
];

describe('passende', () => {
  it('filtert nach Konto', () => {
    expect(passende(['Brust'], null, K).map((e) => e.n)).toEqual(['A Comp Brust', 'B Iso Brust']);
  });
  it('filtert zusätzlich nach Comp/Iso', () => {
    expect(passende(['Brust'], 'Iso', K).map((e) => e.n)).toEqual(['B Iso Brust']);
  });
  it('ohne Rolle bleibt Comp und Iso drin', () => {
    expect(passende(['Brust', 'Lat'], null, K)).toHaveLength(3);
  });
  it('kommt mit fehlenden Konten klar', () => {
    expect(passende(undefined, null, K)).toEqual([]);
    expect(passende([], 'Comp', K)).toEqual([]);
  });
});

describe('auswahlGruppen', () => {
  it('gruppiert nach Konto in der Reihenfolge der Vorlage', () => {
    const g = auswahlGruppen(['Lat', 'Brust'], null, [], K);
    expect(g.map((x) => x.label)).toEqual(['Lat', 'Brust']);
  });

  it('stellt zuletzt Benutztes voran', () => {
    const g = auswahlGruppen(['Brust'], null, ['B Iso Brust'], K);
    expect(g[0].label).toBe('Zuletzt benutzt');
    expect(g[0].eintraege.map((e) => e.n)).toEqual(['B Iso Brust']);
  });

  it('listet dieselbe Übung nicht zweimal', () => {
    const g = auswahlGruppen(['Brust'], null, ['B Iso Brust'], K);
    const alle = g.flatMap((x) => x.eintraege.map((e) => e.n));
    expect(alle).toEqual([...new Set(alle)]);
  });

  it('behält die Reihenfolge von zuletzt bei', () => {
    const g = auswahlGruppen(['Brust'], null, ['B Iso Brust', 'A Comp Brust'], K);
    expect(g[0].eintraege.map((e) => e.n)).toEqual(['B Iso Brust', 'A Comp Brust']);
  });

  it('ignoriert zuletzt-Namen, die die Rolle nicht erfüllen', () => {
    // Sonst böte ein Comp-Feld eine Iso-Übung an, nur weil sie zuletzt lief.
    const g = auswahlGruppen(['Brust'], 'Comp', ['B Iso Brust'], K);
    expect(g.map((x) => x.label)).toEqual(['Brust']);
  });

  it('lässt leere Gruppen weg', () => {
    const g = auswahlGruppen(['Brust', 'Waden'], 'Comp', [], K);
    expect(g.map((x) => x.label)).toEqual(['Brust']);
  });
});

describe('imKatalog / eintragVon', () => {
  it('erkennt den Eintrag unabhängig von Schreibweise', () => {
    expect(imKatalog('a comp brust', K)).toBe(true);
    expect(eintragVon('  A COMP BRUST ', K).haupt).toBe('Brust');
  });
  it('meldet Unbekanntes und Leeres als nicht im Katalog', () => {
    expect(imKatalog('Fat-Gripz Halt', K)).toBe(false);
    expect(imKatalog('', K)).toBe(false);
    expect(imKatalog(null, K)).toBe(false);
  });
});

describe('echter Katalog gegen echte Vorlage', () => {
  it('kennt nur die 15 Muskelkonten', () => {
    KATALOG.forEach((e) => {
      expect(KONTEN, `Hauptspieler von ${e.n}`).toContain(e.haupt);
      e.neben.forEach((n) => expect(KONTEN, `Nebenspieler von ${e.n}`).toContain(n));
    });
  });

  it('führt keinen Muskel doppelt als Haupt- und Nebenspieler', () => {
    // Sonst zählte derselbe Satz im Wochenkonto 1,0 + 0,5.
    KATALOG.forEach((e) => expect(e.neben, e.n).not.toContain(e.haupt));
  });

  it('gibt für jeden Slot jeder Vorlage mindestens eine Übung her', () => {
    const leer = [];
    Object.entries(TPL).forEach(([tag, def]) => {
      def.blocks.forEach((blk) => {
        // Alle drei Level prüfen: exByTier kann je Level andere Felder haben.
        [0, 1, 2].forEach((tier) => {
          const felder = (blk.exByTier && blk.exByTier[tier]) || blk.ex;
          felder.forEach((exDef, xi) => {
            const g = auswahlGruppen(blk.konten, exDef.r || null);
            if (!g.length) leer.push(`${tag}/${blk.id}[${xi}] Level ${tier + 1} (${exDef.r || 'frei'})`);
          });
        });
      });
    });
    expect(leer).toEqual([]);
  });

  it('gibt jedem Block Konten mit', () => {
    Object.entries(TPL).forEach(([tag, def]) => {
      def.blocks.forEach((blk) => {
        expect(Array.isArray(blk.konten), `${tag}/${blk.id}`).toBe(true);
        expect(blk.konten.length, `${tag}/${blk.id}`).toBeGreaterThan(0);
      });
    });
  });

  it('lässt keine Übung im Katalog unerreichbar', () => {
    // Eine Übung, die in keinem Slot auftaucht, kann man nie auswählen – sie
    // steht dann nur zur Zierde in der Excel.
    const erreichbar = new Set();
    Object.values(TPL).forEach((def) => def.blocks.forEach((blk) => {
      [null, 'Comp', 'Iso'].forEach((rolle) => {
        const rollenImBlock = blk.ex.map((e) => e.r || null);
        if (!rollenImBlock.includes(rolle)) return;
        passende(blk.konten, rolle).forEach((e) => erreichbar.add(e.n));
      });
    }));
    const verwaist = KATALOG.filter((e) => !erreichbar.has(e.n)).map((e) => `${e.n} (${e.haupt}, ${e.typ})`);
    expect(verwaist).toEqual([]);
  });
});
