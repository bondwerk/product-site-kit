// Spec #435 §5.1 (linkZiel), Plan B10: Link-Ziele ohne fremde Schemes und ohne Punycode, nur per Regex (vm-tauglich).
import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { linkZiel } from '../src/schema/link.js';
import { sichererText, contentBildPfad } from '../src/schema/index.js';

describe('linkZiel', () => {
  it('erlaubt interne Pfade, Anker, tel: und https; lehnt alles andere ab', () => {
    for (const gut of ['/', '/kontakt', '/angebot/kurse#preise', '#kontakt', 'tel:+41441234567', 'https://example.ch/kurse', 'https://www.example.ch']) {
      expect(linkZiel.safeParse(gut).success, gut).toBe(true);
    }
    for (const schlecht of ['//evil.example', '//intranet/x', 'javascript:alert(1)', 'http://example.ch', 'https://user@example.ch', 'https://example.ch/a b',
      'mailto:info@example.ch', 'data:text/html,x', '/../etc', 'kontakt', 'https://localhost', `https://example.ch/${'x'.repeat(300)}`]) {
      expect(linkZiel.safeParse(schlecht).success, schlecht).toBe(false);
    }
  });
  it('lehnt Hosts mit Punycode-Label ab (xn--)', () => {
    for (const schlecht of ['https://xn--grnwerk-o2a.ch', 'https://shop.xn--grnwerk-o2a.ch/kurse', 'https://XN--grnwerk-o2a.ch']) {
      expect(linkZiel.safeParse(schlecht).success, schlecht).toBe(false);
    }
    expect(linkZiel.safeParse('https://example.ch/xn--pfad').success).toBe(true);
  });
});

describe('linkZiel — Zeichen, Port, Labels (Review-Befund 1)', () => {
  it('lehnt Steuer-, Bidi-, Nullbreiten-, Backslash-, Port- und Label-Fälle ab', () => {
    const faelle = ['https://example.ch/\u0000x', 'https://example.ch/\u0001', 'https://example.ch/\u202Eabc', 'https://example.ch/a\u200Bb',
      'https://example.ch/a\\b', 'https://example.ch:99999/x', 'https://example.ch:65536', 'https://-.ch', 'https://-a.example.ch', 'https://a-.example.ch',
      `https://${'a'.repeat(64)}.example.ch`, 'https://example.ch/a`b', 'https://example.ch/\u00e4'];
    for (const f of faelle) expect(linkZiel.safeParse(f).success, JSON.stringify(f)).toBe(false);
  });
  it('lässt gültige Randfälle zu', () => {
    for (const gut of ['https://example.ch:65535/x', 'https://example.ch:443', 'https://a-b.example.ch/p?q=1&r=2#frag', `https://${'a'.repeat(63)}.example.ch`]) {
      expect(linkZiel.safeParse(gut).success, gut).toBe(true);
    }
  });
  it('JSON-Schema des Feldes trägt eine description mit den erlaubten Formen', () => {
    const js = z.toJSONSchema(z.object({ l: linkZiel }).strict(), { unrepresentable: 'any' }) as { properties: Record<string, Record<string, unknown>> };
    expect(typeof js.properties.l!.description).toBe('string');
    expect(js.properties.l!.description).toMatch(/tel:/);
  });
});

describe('x-klasse an den Primitiven (B5, Spec §6.3)', () => {
  it('Inhaltsfelder tragen x-klasse inhalt, Linkziele x-klasse link — auch unter .optional()', () => {
    const js = z.toJSONSchema(z.object({ t: sichererText(80), o: sichererText(80).optional(), b: contentBildPfad, l: linkZiel.optional() }).strict(), { unrepresentable: 'any' }) as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(js.properties.t!['x-klasse']).toBe('inhalt');
    expect(js.properties.o!['x-klasse']).toBe('inhalt');
    expect(js.properties.b!['x-klasse']).toBe('inhalt');
    expect(js.properties.l!['x-klasse']).toBe('link');
  });
});
