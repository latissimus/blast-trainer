import { describe, it, expect } from 'vitest';
import { verlinke } from './notizbuch.js';

// verlinke() baut HTML aus frei getipptem Text. Genau da entsteht die Luecke,
// wenn man die Reihenfolge verwechselt: erst escapen, dann verlinken.
describe('verlinke', () => {
  it('macht URLs klickbar', () => {
    expect(verlinke('siehe https://example.com dazu'))
      .toContain('<a href="https://example.com"');
  });

  it('entschaerft HTML im Text', () => {
    const h = verlinke('<script>alert(1)</script>');
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });

  it('laesst sich nicht ueber ein Anfuehrungszeichen aus dem href schmuggeln', () => {
    const h = verlinke('https://example.com/"onmouseover="alert(1)');
    expect(h).not.toContain('onmouseover="alert(1)"');
    expect(h).toContain('&quot;');
  });

  it('zieht Satzzeichen am Satzende nicht in den Link', () => {
    const h = verlinke('geh auf https://example.com.');
    expect(h).toContain('href="https://example.com"');
    expect(h).toContain('</a>.');
  });

  it('macht aus Zeilenumbruechen Umbrueche', () => {
    expect(verlinke('a\nb')).toBe('a<br>b');
  });

  it('vertraegt leeren und fehlenden Text', () => {
    expect(verlinke('')).toBe('');
    expect(verlinke(null)).toBe('');
  });
});
