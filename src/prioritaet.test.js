import { describe, it, expect } from 'vitest';
import {
  pumpMoeglichkeiten,
  prioritaetsAnpassungen,
  spenderKandidaten,
} from './prioritaet.js';
import { KONTEN } from './katalog.js';

const K = [
  { n: 'Brustpumpe', haupt: 'Brust', neben: ['Vordere Schulter'], typ: 'Iso' },
  { n: 'Rückenpumpe', haupt: 'Oberer Rücken', neben: ['Bizeps'], typ: 'Iso' },
  { n: 'Seitheben', haupt: 'Seitliche Schulter', neben: [], typ: 'Iso' },
  { n: 'Crunch', haupt: 'Abs', neben: [], typ: 'Iso' },
  { n: 'Reverse Curls', haupt: 'Unterarme', neben: ['Bizeps'], typ: 'Iso' },
  { n: 'Trizepsdrücken', haupt: 'Trizeps', neben: [], typ: 'Iso' },
];

function payload(tier = 1) {
  return {
    week: 1,
    tier: { 'UK-A|1': tier },
    data: {
      'UK-A': { 1: {
        p_bk: { names: ['Brustpumpe', 'Rückenpumpe'], sets: [[], []] },
        p_da: { names: ['Seitheben', 'Crunch'], sets: [[], []] },
        p_arm: { names: ['Reverse Curls', 'Trizepsdrücken'], sets: [[], []] },
      } },
    },
    volumen: { prioritaet: {} },
  };
}

describe('Priorisierung – Wirkung', () => {
  it('schlägt genau einen Pump-Satz auf', () => {
    const p = payload(1);
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta['UK-A|p_arm|0']).toBe(1);
    expect(r.ergebnisse.Unterarme.status).toBe('aktiv');
  });

  it('wirkt auch auf Level I', () => {
    const p = payload(0);
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta['UK-A|p_arm|0']).toBe(1);
    expect(r.ergebnisse.Unterarme.status).toBe('aktiv');
  });

  it('verteilt atomar innerhalb derselben Einheit um', () => {
    const p = payload(1);
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', spender: 'Abs' };
    expect(prioritaetsAnpassungen(p, 1, K).delta).toEqual({
      'UK-A|p_arm|0': 1,
      'UK-A|p_da|1': -1,
    });
  });

  it('schlägt bei fehlendem Spender nicht versehentlich auf', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_da.names[1] = '';
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', spender: 'Abs' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta).toEqual({});
    expect(r.ergebnisse.Unterarme.status).toBe('spender-fehlt');
  });

  it('merkt eine Priorität vor, obwohl die Zielübung noch fehlt', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_arm.names[0] = '';
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta).toEqual({});
    expect(r.ergebnisse.Unterarme.status).toBe('ziel-fehlt');
  });
});

describe('Priorisierung – Planung', () => {
  it('bietet für jedes Muskelkonto einen regulären Pumpplatz an', () => {
    const p = payload(2);
    KONTEN.forEach((konto) => {
      expect(pumpMoeglichkeiten(p, 1, konto).length, konto).toBeGreaterThan(0);
    });
  });

  it('ordnet hohes Gesamtvolumen zuerst und schließt andere Prioritäten aus', () => {
    const p = payload(1);
    p.volumen.prioritaet.Brust = { modus: 'plus' };
    const r = spenderKandidaten(p, 1, 'Unterarme', {
      konten: { Brust: 20, 'Oberer Rücken': 12, 'Seitliche Schulter': 14, Abs: 4, Trizeps: 10 },
      direkt: { Abs: 4 }, indirekt: { Abs: 0 },
    }, K);
    expect(r[0].konto).toBe('Seitliche Schulter');
    expect(r.some((e) => e.konto === 'Brust')).toBe(false);
    expect(r[0].gruende).toContain('Pump · gleiche Einheit');
    expect(r[0].gruende).toContain('viel Wochenvolumen');
  });

  it('kann Spender schon vor der Wahl der Zielübung vorschlagen', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_arm.names[0] = '';
    const r = spenderKandidaten(p, 1, 'Unterarme', {
      konten: { Abs: 8, Trizeps: 6 }, direkt: { Abs: 8, Trizeps: 6 }, indirekt: {},
    }, K);
    expect(r.map((e) => e.konto)).toContain('Abs');
    expect(r.every((e) => e.tag === 'UK-A')).toBe(true);
  });
});
