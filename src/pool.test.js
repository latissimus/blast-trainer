import { describe, it, expect } from 'vitest';
import { memKey, harvestMem, recentNames } from './pool.js';

// Der Pool faellt lautlos aus: Es erscheint dann einfach kein Vorschlag oder ein
// falsches "zuletzt". Genau das ist hier schon einmal passiert – deshalb Tests.

// Zelle bauen: data[Tag][Woche][BlockId] = { names, sets }
const zelle = (tag, woche, block, names, sets) => ({ [tag]: { [woche]: { [block]: { names, sets } } } });

describe('memKey', () => {
  it('macht Gross-/Kleinschreibung und Rand-Leerzeichen egal', () => {
    expect(memKey('  Latzug Maschine ', 'mr')).toBe(memKey('latzug maschine', 'mr'));
  });
  it('trennt nach Satz-Art', () => {
    expect(memKey('Latzug', 'mr')).not.toBe(memKey('Latzug', 'pump'));
  });
  it('gibt null für leere Namen', () => {
    expect(memKey('   ', 'mr')).toBeNull();
  });
});

describe('harvestMem – Pool aus den Wochendaten ernten', () => {
  it('merkt sich die schwerste Last einer Übung', () => {
    const data = zelle('MRs', 3, 'm_bkth', ['PL Rudern'], [[{ w: '40', r: '4' }, { w: '50', r: '3' }]]);
    expect(harvestMem(data)['mr|pl rudern'].w).toBe('50');
  });

  it('lässt die spätere Woche gewinnen, auch bei weniger Last', () => {
    // Der Pool soll den letzten Stand zeigen, nicht den Rekord aller Zeiten.
    const data = {
      MRs: {
        2: { m_bkth: { names: ['PL Rudern'], sets: [[{ w: '60', r: '4' }]] } },
        5: { m_bkth: { names: ['PL Rudern'], sets: [[{ w: '45', r: '4' }]] } },
      },
    };
    const mem = harvestMem(data);
    expect(mem['mr|pl rudern'].w).toBe('45');
    expect(mem['mr|pl rudern'].week).toBe(5);
  });

  it('behält die Originalschreibweise und den Block', () => {
    // Der Schlüssel ist klein, angezeigt werden soll aber "Latzug Maschine".
    const data = zelle('MRs', 1, 'm_bkth', ['Latzug Maschine'], [[{ w: '30', r: '4' }]]);
    const e = harvestMem(data)['mr|latzug maschine'];
    expect(e.n).toBe('Latzug Maschine');
    expect(e.b).toBe('m_bkth');
  });

  it('ignoriert Heavy-Blöcke – der Pool ist nur für Pump und Cluster', () => {
    const data = zelle('OK-A', 1, 'back', ['Multipresse Rudern'], [[{ w: '80', r: '8' }]]);
    expect(Object.keys(harvestMem(data))).toHaveLength(0);
  });

  it('ignoriert Sätze ohne Gewicht', () => {
    const data = zelle('OK-A', 1, 'p_quad', ['Beinstrecker'], [[{ w: '', r: '20' }]]);
    expect(Object.keys(harvestMem(data))).toHaveLength(0);
  });

  it('kommt mit leeren Daten klar', () => {
    expect(harvestMem({})).toEqual({});
    expect(harvestMem(null)).toEqual({});
  });
});

describe('recentNames – Vorschläge für genau einen Block', () => {
  const data = {
    MRs: {
      1: { m_bkth: { names: ['PL Rudern'] } },
      4: { m_bkth: { names: ['Chest Supported Row'] } },
    },
    'OK-A': { 1: { p_quad: { names: ['Beinstrecker'] } } },
  };

  it('schlägt nur Übungen desselben Blocks vor', () => {
    // Bei "Rücken Dicke" haben Beinübungen nichts zu suchen.
    const namen = recentNames('mr', 'm_bkth', data, {}).map((r) => r.n);
    expect(namen).toContain('PL Rudern');
    expect(namen).not.toContain('Beinstrecker');
  });

  it('stellt die neueste Woche nach vorn', () => {
    expect(recentNames('mr', 'm_bkth', data, {})[0].n).toBe('Chest Supported Row');
  });

  it('fasst gleiche Namen trotz anderer Schreibweise zusammen', () => {
    const d = {
      MRs: { 1: { m_bkth: { names: ['PL Rudern'] } }, 2: { m_bkth: { names: ['pl rudern'] } } },
    };
    expect(recentNames('mr', 'm_bkth', d, {})).toHaveLength(1);
  });

  it('hängt Pool-Einträge früherer Phasen hinten an', () => {
    const mem = { 'mr|kabelrudern': { n: 'Kabelrudern', b: 'm_bkth', w: '40' } };
    const namen = recentNames('mr', 'm_bkth', data, mem).map((r) => r.n);
    expect(namen[namen.length - 1]).toBe('Kabelrudern');
  });

  it('lässt Pool-Einträge fremder Blöcke draußen', () => {
    const mem = { 'mr|wadenheben': { n: 'Wadenheben', b: 'm_calf', w: '40' } };
    expect(recentNames('mr', 'm_bkth', data, mem).map((r) => r.n)).not.toContain('Wadenheben');
  });

  it('lässt Alt-Einträge ohne Block-Angabe draußen', () => {
    const mem = { 'mr|irgendwas': { n: 'Irgendwas', w: '40' } };
    expect(recentNames('mr', 'm_bkth', data, mem).map((r) => r.n)).not.toContain('Irgendwas');
  });
});
