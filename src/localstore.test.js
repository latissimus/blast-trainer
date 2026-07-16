import { describe, it, expect } from 'vitest';
import { mergePayload } from './localstore.js';

// Der Abgleich ist die einzige Stelle im Projekt, deren Fehler still bleiben:
// Es gibt keine Fehlermeldung, kein ⚠ – es fehlen einfach Saetze. Deshalb liegen
// die Regeln hier als Test fest und nicht nur als Kommentar.

const voll = (w) => ({ sets: [[{ w, r: '8', rir: '' }]], names: ['Echte Uebung'] });
// Wichtig: So sieht ein Block aus, den die App beim blossen ANSEHEN eines Tages
// anlegt – ohne dass der Trainee etwas eingetragen hat.
const geruest = () => ({ sets: [[{ w: '', r: '', rir: '' }]], names: [] });

const kg = (p, day, wk, bid) => p.data[day][wk][bid].sets[0][0].w;

describe('mergePayload – Trainingsdaten', () => {
  it('laesst leeres Geruest keine Server-Daten ueberschreiben', () => {
    const m = mergePayload(
      { data: { 'OK-A': { 1: { back: voll('100') } } } },
      { data: { 'OK-A': { 1: { back: geruest() } } } },
    );
    expect(kg(m, 'OK-A', 1, 'back')).toBe('100');
  });

  it('laesst lokale Daten ueber Server-Geruest gewinnen', () => {
    const m = mergePayload(
      { data: { 'OK-A': { 1: { back: geruest() } } } },
      { data: { 'OK-A': { 1: { back: voll('80') } } } },
    );
    expect(kg(m, 'OK-A', 1, 'back')).toBe('80');
  });

  it('gibt bei echtem Konflikt dem Geraet den Vorrang', () => {
    const m = mergePayload(
      { data: { 'OK-A': { 1: { back: voll('100') } } } },
      { data: { 'OK-A': { 1: { back: voll('90') } } } },
    );
    expect(kg(m, 'OK-A', 1, 'back')).toBe('90');
  });

  it('behaelt Bloecke, die nur der Server kennt', () => {
    const m = mergePayload(
      { data: { 'OK-A': { 1: { back: voll('100'), chest: voll('60') } } } },
      { data: { 'OK-A': { 1: { back: voll('90') } } } },
    );
    expect(kg(m, 'OK-A', 1, 'chest')).toBe('60');
    expect(kg(m, 'OK-A', 1, 'back')).toBe('90');
  });

  it('behaelt ganze Tage und Wochen, die nur der Server kennt', () => {
    const m = mergePayload({ data: { 'UK-A': { 3: { legs: voll('200') } } } }, { data: {} });
    expect(kg(m, 'UK-A', 3, 'legs')).toBe('200');
  });

  it('behaelt die Cruise-Slots getrennt', () => {
    const m = mergePayload(
      { data: { 'MRs': { 7: { m_ch: voll('50') } } } },
      { data: { 'MRs-2': { 7: { m_ch: voll('55') } } } },
    );
    expect(kg(m, 'MRs', 7, 'm_ch')).toBe('50');
    expect(kg(m, 'MRs-2', 7, 'm_ch')).toBe('55');
  });
});

describe('mergePayload – Uebungsnamen und Notizen', () => {
  it('laesst eine leere Namensliste die gefuellte nicht ueberschreiben', () => {
    const m = mergePayload(
      { ex: { 'OK-A': { back: ['Rudern', 'Latzug'] } } },
      { ex: { 'OK-A': { back: ['', ''] } } },
    );
    expect(m.ex['OK-A'].back).toEqual(['Rudern', 'Latzug']);
  });

  it('laesst leere Notizen die gefuellten nicht ueberschreiben', () => {
    const m = mergePayload(
      { notes: { 'UK-A': { legs: ['Sitz 4'] } } },
      { notes: { 'UK-A': { legs: [''] } } },
    );
    expect(m.notes['UK-A'].legs).toEqual(['Sitz 4']);
  });
});

describe('mergePayload – Pool und Einstellungen', () => {
  it('vereinigt den Uebungs-Pool, ohne etwas zu verwerfen', () => {
    const m = mergePayload(
      { mem: { 'mr|beinpresse': { w: '150' } } },
      { mem: { 'pump|beinstrecker': { w: '40' } } },
    );
    expect(Object.keys(m.mem).sort()).toEqual(['mr|beinpresse', 'pump|beinstrecker']);
  });

  it('gibt beim Pool dem Geraet den Vorrang', () => {
    const m = mergePayload({ mem: { 'mr|x': { w: '1' } } }, { mem: { 'mr|x': { w: '2' } } });
    expect(m.mem['mr|x'].w).toBe('2');
  });

  it('behaelt die Tier-Wahl beider Seiten', () => {
    const m = mergePayload({ tier: { 'OK-A|1': 2 } }, { tier: { 'UK-A|1': 0 } });
    expect(m.tier).toEqual({ 'OK-A|1': 2, 'UK-A|1': 0 });
  });

  it('nimmt Woche und Tag vom Geraet', () => {
    const m = mergePayload({ week: 3, day: 'OK-A' }, { week: 5, day: 'MRs' });
    expect(m.week).toBe(5);
    expect(m.day).toBe('MRs');
  });

  it('kommt mit leeren Seiten klar', () => {
    expect(() => mergePayload(null, null)).not.toThrow();
    expect(mergePayload({}, {}).v).toBe(3);
  });
});
