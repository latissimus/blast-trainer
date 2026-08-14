import { describe, expect, it } from 'vitest';
import { rechtlicherInhalt, RECHTSSEITEN } from './rechtliches.js';

describe('Rechtliche Seiten', () => {
  it('stellt Datenschutz und Impressum als feste Routen bereit', () => {
    expect(RECHTSSEITEN).toEqual(['datenschutz', 'impressum']);
  });

  it('erklaert die wesentlichen Verarbeitungen von LOGMAN', () => {
    const html = rechtlicherInhalt('datenschutz');
    expect(html).toContain('Offlinebetrieb');
    expect(html).toContain('Supabase');
    expect(html).toContain('GitHub');
    expect(html).toContain('Push');
    expect(html).toContain('Account löschen');
    expect(html).toContain('keine Analyse-Tracker');
  });

  it('enthaelt Anbieter- und Sicherheitshinweise', () => {
    const html = rechtlicherInhalt('impressum');
    expect(html).toContain('§ 5 DDG');
    expect(html).toContain('keine medizinische Beratung');
    expect(html).toContain('Urheberrecht');
  });

  it('lehnt unbekannte Seiten ab', () => {
    expect(() => rechtlicherInhalt('agb')).toThrow('Unbekannte Rechtsseite');
  });
});
