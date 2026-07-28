import { describe, it, expect } from 'vitest';
import { memKey, harvestMem, recentNames } from './pool.js';

const zelle = (tag, cycle, block, names, sets) => ({
  [tag]: { [cycle]: { [block]: { names, sets } } },
});

describe('memKey', () => {
  it('normalisiert Schreibweise und trennt nach Satzart', () => {
    expect(memKey('  Kabel Fliegende ', 'pump')).toBe('pump|kabel fliegende');
    expect(memKey('Kabel Fliegende', 'pump')).not.toBe(memKey('Kabel Fliegende', 'load'));
    expect(memKey(' ', 'pump')).toBeNull();
  });
});

describe('harvestMem – PUMPS-Pool aus Cycle-Daten', () => {
  it('merkt sich die schwerste Last innerhalb eines Cycles', () => {
    const data = zelle('OK-P', 3, 'chest_iso', ['Kabel Rudern, weit, Obergriff'], [[
      { w: '40', r: '15' },
      { w: '50', r: '12' },
    ]]);
    expect(harvestMem(data)['pump|kabel rudern, weit, obergriff'].w).toBe('50');
  });

  it('lässt den späteren Cycle gewinnen', () => {
    const data = {
      'OK-P': {
        2: { chest_iso: { names: ['Rudern'], sets: [[{ w: '60', r: '12' }]] } },
        5: { chest_iso: { names: ['Rudern'], sets: [[{ w: '45', r: '15' }]] } },
      },
    };
    const mem = harvestMem(data);
    expect(mem['pump|rudern'].w).toBe('45');
    expect(mem['pump|rudern'].week).toBe(5);
  });

  it('behält Originalschreibweise und Block', () => {
    const data = zelle('OK-P', 1, 'chest_iso', ['Rudern'], [[{ w: '30', r: '15' }]]);
    expect(harvestMem(data)['pump|rudern']).toMatchObject({ n: 'Rudern', b: 'chest_iso' });
  });

  it('ignoriert HEAVYS und leere Gewichte', () => {
    expect(harvestMem(zelle('OK-H', 1, 'back_thick', ['Rudern'], [[{ w: '80', r: '8' }]]))).toEqual({});
    expect(harvestMem(zelle('OK-P', 1, 'back_thick', ['Rudern'], [[{ w: '', r: '15' }]]))).toEqual({});
  });

  it('kommt mit leeren Daten klar', () => {
    expect(harvestMem({})).toEqual({});
    expect(harvestMem(null)).toEqual({});
  });
});

describe('recentNames – Vorschläge für denselben PUMPS-Block', () => {
  const data = {
    'OK-P': {
      1: { chest_iso: { names: ['Rudern A'] } },
      4: { chest_iso: { names: ['Rudern B'] }, delt_iso: { names: ['Brustpresse'] } },
    },
  };

  it('schlägt nur Übungen desselben Blocks vor', () => {
    const namen = recentNames('pump', 'chest_iso', data, {}).map((r) => r.n);
    expect(namen).toContain('Rudern A');
    expect(namen).not.toContain('Brustpresse');
  });

  it('stellt den neuesten Cycle nach vorn', () => {
    expect(recentNames('pump', 'chest_iso', data, {})[0].n).toBe('Rudern B');
  });

  it('fasst gleiche Namen unabhängig von Schreibweise zusammen', () => {
    const d = {
      'OK-P': {
        1: { chest_iso: { names: ['Rudern'] } },
        2: { chest_iso: { names: ['rudern'] } },
      },
    };
    expect(recentNames('pump', 'chest_iso', d, {})).toHaveLength(1);
  });

  it('hängt passende Pool-Einträge früherer Phasen hinten an', () => {
    const mem = {
      'pump|kabelrudern': { n: 'Kabelrudern', b: 'chest_iso', w: '40' },
      'pump|wadenheben': { n: 'Wadenheben', b: 'calves_iso', w: '40' },
    };
    const namen = recentNames('pump', 'chest_iso', data, mem).map((r) => r.n);
    expect(namen[namen.length - 1]).toBe('Kabelrudern');
    expect(namen).not.toContain('Wadenheben');
  });
});
