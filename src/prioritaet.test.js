import { describe, it, expect } from 'vitest';
import {
  istDeload,
  tageDerWoche,
  tierVon,
  koerperhaelfte,
  prioMoeglichkeiten,
  prioritaetsAnpassungen,
  prioBloecke,
  spenderKandidaten,
} from './prioritaet.js';

const payload = (tier = 1) => ({
  tier: {
    'OK-H|1': tier,
    'UK-H|1': tier,
    'OK-P|1': tier,
    'UK-P|1': tier,
  },
  data: {},
  ex: {},
  volumen: { prioritaet: {} },
});

describe('Cycle-Struktur', () => {
  it('liefert vier rollierende Einheiten', () => {
    expect(tageDerWoche({}, 1)).toEqual(['OK-H', 'UK-H', 'OK-P', 'UK-P']);
    expect(tageDerWoche({}, 7)).toEqual(['OK-H', 'UK-H', 'OK-P', 'UK-P']);
  });

  it('liefert im Deload genau OK und UK', () => {
    expect(tageDerWoche({}, 8)).toEqual(['OK-D', 'UK-D']);
    expect(istDeload(7)).toBe(false);
    expect(istDeload(8)).toBe(true);
  });

  it('nimmt Level II als Standard und Level I im Deload', () => {
    expect(tierVon({}, 'OK-H', 1)).toBe(1);
    expect(tierVon({ tier: { 'OK-H|1': 2 } }, 'OK-H', 1)).toBe(2);
    expect(tierVon({ tier: { 'OK-D|8': 2 } }, 'OK-D', 8)).toBe(0);
  });
});

describe('Prio-Slots', () => {
  it('ordnet Muskeln der passenden Körperhälfte zu', () => {
    expect(koerperhaelfte('Unterarme')).toBe('OK');
    expect(koerperhaelfte('Quads')).toBe('UK');
    expect(koerperhaelfte('Abs')).toBe('UK');
  });

  it('erzeugt für Unterarme je zwei Sätze in beiden OK-Einheiten', () => {
    const slots = prioMoeglichkeiten({}, 1, 'Unterarme');
    expect(slots.map((s) => s.tag)).toEqual(['OK-H', 'OK-P']);
    expect(slots.every((s) => s.anzahl === 2)).toBe(true);
  });

  it('erzeugt wahlweise nur einen Satz in beiden passenden Einheiten', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = { modus: 'plus', saetze: 1 };
    const slots = prioMoeglichkeiten(p, 1, 'Unterarme');
    expect(slots.map((s) => s.anzahl)).toEqual([1, 1]);
  });

  it('erzeugt für Glutes je zwei Sätze in beiden UK-Einheiten', () => {
    expect(prioMoeglichkeiten({}, 1, 'Glutes').map((s) => s.tag))
      .toEqual(['UK-H', 'UK-P']);
  });

  it('deaktiviert Prioritäten im Deload', () => {
    expect(prioMoeglichkeiten({}, 8, 'Unterarme')).toEqual([]);
  });

  it('schlägt vier Sätze pro Cycle auf – unabhängig vom Level', () => {
    [0, 1, 2].forEach((tier) => {
      const p = payload(tier);
      p.volumen.prioritaet.Unterarme = { modus: 'plus' };
      const r = prioritaetsAnpassungen(p, 1);
      expect(r.slots).toHaveLength(2);
      expect(r.slots.reduce((sum, s) => sum + s.anzahl, 0)).toBe(4);
      expect(r.delta).toEqual({});
      expect(r.ergebnisse.Unterarme.status).toBe('aktiv');
    });
  });

  it('liefert die zusätzliche Muskelbox am Ende der passenden Einheit', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    const blocks = prioBloecke(p, 1, 'OK-H');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: 'prio:Unterarme',
      mus: 'Unterarme',
      type: 'load',
      sets: [2, 2, 2],
    });
    expect(prioBloecke(p, 1, 'UK-H')).toEqual([]);
  });

  it('trainiert neue Unterarm-Priorität an HEAVYS mit 8–15 Wiederholungen', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = { modus: 'plus' };
    expect(prioBloecke(p, 1, 'OK-H')[0].reps).toBe('8–15');
    expect(prioBloecke(p, 1, 'OK-P')[0].reps).toBe('15–25');
  });

  it('trainiert andere neue HEAVY-Prioritäten mit 6–10 Wiederholungen', () => {
    const p = payload();
    p.volumen.prioritaet.Bizeps = { modus: 'plus' };
    expect(prioBloecke(p, 1, 'OK-H')[0].reps).toBe('6–10');
  });

  it('verteilt atomar je zwei Sätze in HEAVYS und PUMPS um', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = {
      modus: 'tausch',
      spender: 'Brust',
      spenderName: 'Brust',
    };
    const r = prioritaetsAnpassungen(p, 1);
    expect(r.slots).toHaveLength(2);
    expect(r.delta['OK-H|chest_comp|0']).toBe(-2);
    expect(r.delta['OK-P|chest_comp|0']).toBe(-2);
    expect(r.ergebnisse.Unterarme.status).toBe('aktiv');
  });

  it('verteilt bei kleiner Priorität atomar je einen Satz um', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = {
      modus: 'tausch',
      saetze: 1,
      spender: 'Brust',
    };
    const r = prioritaetsAnpassungen(p, 1);
    expect(r.delta['OK-H|chest_comp|0']).toBe(-1);
    expect(r.delta['OK-P|chest_comp|0']).toBe(-1);
  });

  it('pausiert eine unvollständige oder körperfremde Umverteilung', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', spender: 'Quads' };
    const r = prioritaetsAnpassungen(p, 1);
    expect(r.slots).toEqual([]);
    expect(r.delta).toEqual({});
    expect(r.ergebnisse.Unterarme.status).toBe('spender-fehlt');
  });

  it('legt mehrere Prioritäten nicht auf denselben Spenderblock', () => {
    const p = payload();
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', spender: 'Brust' };
    p.volumen.prioritaet.Bizeps = { modus: 'tausch', spender: 'Brust' };
    const r = prioritaetsAnpassungen(p, 1);
    expect(Object.values(r.ergebnisse).filter((e) => e.status === 'aktiv')).toHaveLength(2);
    expect(Object.keys(r.delta)).toHaveLength(4);
  });
});

describe('Spender-Vorschläge', () => {
  it('bleibt in derselben Körperhälfte und verlangt zwei Sätze je Einheit', () => {
    const p = payload();
    const r = spenderKandidaten(p, 1, 'Unterarme', {
      konten: { Brust: 12, Trizeps: 8, Quads: 20 },
      direkt: { Brust: 10, Trizeps: 4, Quads: 10 },
      indirekt: { Brust: 4, Trizeps: 8, Quads: 0 },
    });
    expect(r[0].konto).toBe('Brust');
    expect(r.map((e) => e.konto)).not.toContain('Quads');
    expect(r.every((e) => e.verfuegbar >= 2)).toBe(true);
    expect(r[0].gruende).toContain('höchste Cycle-Arbeit');
  });

  it('schließt andere Prioritäten als Spender aus', () => {
    const p = payload();
    p.volumen.prioritaet.Brust = { modus: 'plus' };
    expect(spenderKandidaten(p, 1, 'Unterarme', {}).map((e) => e.konto))
      .not.toContain('Brust');
  });

  it('funktioniert ohne eingetragene Übungen', () => {
    const p = payload();
    expect(spenderKandidaten(p, 1, 'Unterarme', {}).length).toBeGreaterThan(0);
  });

  it('erlaubt bei einem Satz auch Felder mit nur einem Standardsatz', () => {
    const p = payload(0);
    p.volumen.prioritaet.Unterarme = { modus: 'tausch', saetze: 1 };
    const kandidaten = spenderKandidaten(p, 1, 'Unterarme', {});
    expect(kandidaten.length).toBeGreaterThan(0);
    expect(kandidaten.every((e) => e.verfuegbar >= 1)).toBe(true);
  });
});
