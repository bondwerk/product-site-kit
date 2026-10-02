// Content-Lint und JSON-Guard (Spec #435 §5.1 „Lints"); getestet nur am Subpath @bondwerk/site-kit/lints.
import { describe, expect, it } from 'vitest';
import { lintText, lintJsonKeys, safeJsonParse, enthaeltGefaehrlicheKeys } from '../src/lints/index.js';

describe('lintText', () => {
  it('meldet externe URLs zeilenweise, ignoriert LF-Frontmatter, lässt Anker und Telefon durch', () => {
    expect(lintText('Siehe [Kontakt](#kontakt). Tel: 044 123 45 67.')).toEqual([]);
    for (const b of ['https://fremd.example.ch/x', 'www.fremd.example.ch', 'shop.example.ch', '[hier](https://fremd.example.ch)', '<a href="http://fremd.example.ch">x</a>', '//evil.example.ch']) {
      expect(lintText(b).length, b).toBeGreaterThan(0);
    }
    expect(lintText('---\ntitel: X\n---\nNur Text.')).toEqual([]);
    expect(lintText('---\r\ntitel: X\r\nquelle: www.fremd.example.ch\r\n---\r\nText.').length).toBeGreaterThan(0);
    expect(lintText('Erste: https://evil.example.ch\nZweite: www.fremd.example.ch')).toHaveLength(2);
    expect(lintText('Siehe https://evil.example.ch und www.fremd.example.ch')).toHaveLength(1);
  });
});

describe('lintText — E-Mail-Regel', () => {
  it('meldet E-Mail-Adressen im Fliesstext', () => {
    // .example steht nicht in der TLD-Liste: nur die E-Mail-Regel kann diese Zeile melden.
    expect(lintText('Schreib an kontakt@evil.example')).toHaveLength(1);
    expect(lintText('Schreib an kontakt@evil.example')[0]).toMatch(/^E-Mail-Adresse im Fliesstext/);
  });
});

describe('JSON-Guard', () => {
  it('meldet __proto__/constructor/prototype und entfernt sie beim Parsen', () => {
    expect(lintJsonKeys('{"__proto__": {"polluted": true}, "titel": "X"}')).toHaveLength(1);
    expect(lintJsonKeys('{"titel": "Über uns"}')).toEqual([]);
    expect(enthaeltGefaehrlicheKeys('{"a": {"constructor": 1}}')).toBe(true);
    const obj = safeJsonParse('{"a": 1, "__proto__": {"x": 1}, "b": {"prototype": 2, "c": 3}}') as Record<string, unknown>;
    expect(obj).toEqual({ a: 1, b: { c: 3 } });
  });
});
