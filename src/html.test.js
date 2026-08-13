import { describe, expect, it } from 'vitest';
import { escapeHtml } from './html.js';

describe('sichere HTML-Ausgabe', () => {
  it('neutralisiert Tags und Attribute aus Nutzerdaten', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`))
      .toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;');
  });
});
