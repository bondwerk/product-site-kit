import { describe, expect, it } from 'vitest';
import { contentBildPfad, plz, chTelefon } from '../src/schema/index.js';

describe('Pfad- und Kontakt-Primitiven', () => {
  it('contentBildPfad: Rasterbild unter bilder/, kein SVG, kein Ausbruch', () => {
    for (const gut of ['bilder/team/anna.webp', 'bilder/x.JPG', 'bilder/a/b/c.avif']) expect(contentBildPfad.safeParse(gut).success, gut).toBe(true);
    for (const schlecht of ['bilder/x.svg', 'bilder/../x.png', '/bilder/x.png', 'bilder\\..\\x.png', 'bilder/x.png/../../y.png', '../secret.png']) {
      expect(contentBildPfad.safeParse(schlecht).success, schlecht).toBe(false);
    }
  });
  it('plz: vierstellig', () => {
    expect(plz.safeParse('8610').success).toBe(true);
    for (const schlecht of ['861', '86100', '86-1']) expect(plz.safeParse(schlecht).success, schlecht).toBe(false);
  });
  it('chTelefon: CH-Präfix und 10 bis 13 Ziffern', () => {
    for (const gut of ['+41 44 123 45 67', '044 123 45 67']) expect(chTelefon.safeParse(gut).success, gut).toBe(true);
    for (const schlecht of ['0\t\t\t\t\t\t\t', '044.......', '0700000000000000000000']) expect(chTelefon.safeParse(schlecht).success, schlecht).toBe(false);
  });
});
