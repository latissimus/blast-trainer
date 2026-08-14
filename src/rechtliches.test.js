import { describe, expect, it } from 'vitest';
import { rechtlicherInhalt, RECHTSSEITEN } from './rechtliches.js';

describe('Rechtliche Seiten', () => {
  it('stellt Nutzungsbedingungen, Datenschutz und Impressum als feste Routen bereit', () => {
    expect(RECHTSSEITEN).toEqual(['nutzung', 'datenschutz', 'impressum']);
  });

  it('erklaert die kostenlose Nutzung ohne zwingende Verbraucherrechte auszuschliessen', () => {
    const html = rechtlicherInhalt('nutzung');
    expect(html).toContain('kostenlos');
    expect(html).toContain('keine In-App-Käufe');
    expect(html).toContain('Offlinebetrieb');
    expect(html).toContain('Sicherheitsupdates');
    expect(html).toMatch(/Zwingende\s+gesetzliche Ansprüche bleiben unberührt/);
    expect(html).toContain('Account löschen');
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
