import { describe, expect, it } from 'vitest';
import {
  erstelleEigeneUebung,
  erstelleVariante,
  benenneEigeneUebungUm,
  aktualisiereEigeneZuordnung,
  katalogMitEigenen,
  loescheEigeneUebung,
  mergeEigeneUebungen,
  setzeEigeneUebungAktiv,
} from './eigene-uebungen.js';
import { KATALOG } from './katalog.js';

describe('persönliche Übungen', () => {
  it('übernimmt bei einer Variante die komplette Zuordnung der Ausgangsübung', () => {
    const basis = KATALOG.find((e) => e.n === 'LH Flachbankdrücken');
    const result = erstelleVariante([], basis, 'Gym80 Brustpresse', 10);
    expect(result.fehler).toBeUndefined();
    expect(result.eintrag).toMatchObject({
      n: 'Gym80 Brustpresse', haupt: basis.haupt, neben: basis.neben,
      typ: basis.typ, art: 'variante', basis: basis.n,
    });
  });

  it('verlangt bei einer freien Übung Name, Muskel und Comp/Iso', () => {
    expect(erstelleEigeneUebung([], { n: '', haupt: 'Brust', typ: 'Comp' }).fehler).toBeTruthy();
    expect(erstelleEigeneUebung([], { n: 'X', haupt: '', typ: 'Comp' }).fehler).toBeTruthy();
    expect(erstelleEigeneUebung([], { n: 'X', haupt: 'Brust', typ: '' }).fehler).toBeTruthy();
  });

  it('entfernt doppelte und unzulässige indirekte Muskeln', () => {
    const result = erstelleEigeneUebung([], {
      n: 'Meine Presse', haupt: 'Brust', typ: 'Comp',
      neben: ['Trizeps', 'Trizeps', 'Brust', 'Unbekannt'],
    });
    expect(result.eintrag.neben).toEqual(['Trizeps']);
  });

  it('lässt keine Namen aus Hauptkatalog oder persönlichen Übungen doppelt zu', () => {
    expect(erstelleEigeneUebung([], {
      n: 'LH Flachbankdrücken', haupt: 'Brust', typ: 'Comp',
    }).fehler).toMatch(/bereits/);
    const erste = erstelleEigeneUebung([], { n: 'Meine Presse', haupt: 'Brust', typ: 'Comp' });
    expect(erstelleEigeneUebung(erste.liste, {
      n: ' meine presse ', haupt: 'Brust', typ: 'Comp',
    }).fehler).toMatch(/bereits/);
  });

  it('blendet entfernte Übungen aus der Auswahl aus, behält sie aber für alte Logs', () => {
    const result = erstelleEigeneUebung([], { n: 'Meine Presse', haupt: 'Brust', typ: 'Comp' }, 10);
    const entfernt = setzeEigeneUebungAktiv(result.liste, result.eintrag.id, false, 20);
    expect(katalogMitEigenen(entfernt).some((e) => e.n === 'Meine Presse')).toBe(false);
    expect(katalogMitEigenen(entfernt, { nurAktive: false }).some((e) => e.n === 'Meine Presse')).toBe(true);
  });

  it('löscht Übungen dauerhaft aus der Verwaltung, behält aber ihre Zuordnung für alte Logs', () => {
    const result = erstelleEigeneUebung([], { n: 'Meine Presse', haupt: 'Brust', typ: 'Comp' }, 10);
    const geloescht = loescheEigeneUebung(result.liste, result.eintrag.id, 20);
    expect(katalogMitEigenen(geloescht, { nurAktive: false }).some((e) => e.n === 'Meine Presse')).toBe(false);
    expect(katalogMitEigenen(geloescht, { nurAktive: false, mitGeloeschten: true })
      .find((e) => e.n === 'Meine Presse')).toMatchObject({ haupt: 'Brust', geloescht: true });

    const merged = mergeEigeneUebungen(result.liste, geloescht);
    expect(merged.find((e) => e.id === result.eintrag.id).geloescht).toBe(true);
  });

  it('vereinigt persönliche Übungen pro ID und übernimmt die neuere Bearbeitung', () => {
    const basis = { id: 'a', n: 'A', haupt: 'Brust', neben: [], typ: 'Comp', art: 'eigen', aktiv: true };
    const merged = mergeEigeneUebungen(
      [{ ...basis, updatedAt: 10 }, { ...basis, id: 'b', n: 'B', updatedAt: 5 }],
      [{ ...basis, aktiv: false, updatedAt: 20 }],
    );
    expect(merged.find((e) => e.id === 'a').aktiv).toBe(false);
    expect(merged.find((e) => e.id === 'b').n).toBe('B');
  });

  it('benennt eine Übung samt fester Auswahl, Cycle-Auswahl und Pool um', () => {
    const payload = {
      eigeneUebungen: [{
        id: 'a', n: 'Alte Presse', haupt: 'Brust', neben: [], typ: 'Comp',
        art: 'eigen', aktiv: true, updatedAt: 1,
      }],
      ex: { 'OK-H': { brust: ['Alte Presse'] } },
      data: { 'OK-P': { 1: { brust: { names: ['Alte Presse'] } } } },
      mem: { 'pump|alte presse': { n: 'Alte Presse', w: '40' } },
    };
    const result = benenneEigeneUebungUm(payload, 'a', 'Neue Presse', 2);
    expect(result.fehler).toBeUndefined();
    expect(payload.ex['OK-H'].brust[0]).toBe('Neue Presse');
    expect(payload.data['OK-P'][1].brust.names[0]).toBe('Neue Presse');
    expect(payload.mem['pump|neue presse'].n).toBe('Neue Presse');
  });

  it('kann die Zuordnung einer freien Übung korrigieren, nicht aber die einer Variante', () => {
    const frei = [{
      id: 'a', n: 'Eigene Übung', haupt: 'Brust', neben: [], typ: 'Comp',
      art: 'eigen', aktiv: true, updatedAt: 1,
    }];
    const result = aktualisiereEigeneZuordnung(frei, 'a', {
      haupt: 'Lat', typ: 'Iso', neben: ['Bizeps', 'Lat'],
    }, 2);
    expect(result.eintrag).toMatchObject({ haupt: 'Lat', typ: 'Iso', neben: ['Bizeps'] });
    expect(aktualisiereEigeneZuordnung([{ ...frei[0], art: 'variante' }], 'a', {
      haupt: 'Lat', typ: 'Iso', neben: [],
    }).fehler).toMatch(/Ausgangsübung/);
  });
});
