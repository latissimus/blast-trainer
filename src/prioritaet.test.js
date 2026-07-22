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
  { n: 'Latpumpe', haupt: 'Lat', neben: ['Bizeps'], typ: 'Iso' },
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

  it('reserviert den Spenderplatz schon vor der Übungswahl', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_da.names[1] = '';
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', spender: 'Abs' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta).toEqual({ 'UK-A|p_arm|0': 1, 'UK-A|p_da|1': -1 });
    expect(r.ergebnisse.Unterarme.status).toBe('aktiv');
    expect(r.ergebnisse.Unterarme.vorgemerkt).toBe(true);
  });

  it('behält einen frei gewählten Rücken-Pumpplatz bei einem späteren Übungswechsel', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_bk.names[1] = 'Latpumpe';
    p.volumen.prioritaet.Unterarme = {
      modus: 'tausch', spender: 'Oberer Rücken', spenderFeld: 'UK-A|p_bk|1', spenderName: 'Rücken',
    };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta['UK-A|p_bk|1']).toBe(-1);
    expect(r.ergebnisse.Unterarme.spenderName).toBe('Rücken');
  });

  it('stellt den Zusatzsatz bereit, obwohl die Zielübung noch fehlt', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_arm.names[0] = '';
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta['UK-A|p_arm|0']).toBe(1);
    expect(r.ergebnisse.Unterarme.status).toBe('aktiv');
    expect(r.ergebnisse.Unterarme.vorgemerkt).toBe(true);
  });

  it('stapelt zwei Prioritäten nicht in dasselbe leere Pumpfeld', () => {
    const p = payload(1);
    p.data['UK-A'][1].p_arm.names[0] = '';
    p.volumen.prioritaet.Bizeps = { modus: 'plus' };
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    const r = prioritaetsAnpassungen(p, 1, K);
    expect(r.delta['UK-A|p_arm|0']).toBe(1);
    expect(r.ergebnisse.Bizeps.status).toBe('aktiv');
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
    expect(r[0].gruende).toContain('höchste Wochenarbeit');
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

  it('bietet Umverteilung auch ganz ohne eingetragene Übungen an', () => {
    const p = payload(1);
    p.data['UK-A'][1] = {};
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', spender: 'Abs' };
    expect(prioritaetsAnpassungen(p, 1, K).delta).toEqual({
      'UK-A|p_arm|0': 1,
      'UK-A|p_da|1': -1,
    });
    const r = spenderKandidaten(p, 1, 'Unterarme', {}, K);
    expect(r.map((e) => e.konto)).toContain('Abs');
    expect(r.find((e) => e.konto === 'Abs').name).toBe('Pumpfeld noch leer');
  });

  it('fasst ein leeres gemeinsames Rückenfeld als Rücken zusammen', () => {
    const p = payload(1);
    p.data['UK-A'][1] = {};
    const r = spenderKandidaten(p, 1, 'Unterarme', {
      konten: { 'Oberer Rücken': 12, Lat: 8 },
      direkt: { 'Oberer Rücken': 8, Lat: 6 }, indirekt: {},
    }, K);
    const ruecken = r.filter((e) => e.key === 'UK-A|p_bk|1');
    expect(ruecken).toHaveLength(1);
    expect(ruecken[0].label).toBe('Rücken');
    expect(ruecken[0].konto).toBe('Oberer Rücken');
  });
});
