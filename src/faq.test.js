import { describe, expect, it } from 'vitest';
import { mountFaq } from './faq.js';

describe('FAQ-Modul', () => {
  it('laesst sich importieren', () => {
    expect(typeof mountFaq).toBe('function');
  });
});
