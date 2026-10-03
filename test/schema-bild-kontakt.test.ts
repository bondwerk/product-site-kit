import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { contentBildPfad, plz, chTelefon, kontaktEmail } from '../src/schema/index.js';
import { alsJsonSchemaAus } from '../src/json-schema/index.js';

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
  it('kontaktEmail: nur eine Adresse, nichts sonst', () => {
    expect(kontaktEmail.safeParse('info@beispiel.ch').success).toBe(true);
    for (const schlecht of ['info', 'info@beispiel', 'a b@beispiel.ch', 'info@beispiel.ch und mehr']) expect(kontaktEmail.safeParse(schlecht).success, schlecht).toBe(false);
  });
  it('Plan §8: alle Kontaktfelder tragen im JSON-Schema x-klasse „inhalt"', () => {
    const js = alsJsonSchemaAus({ kontakt: z.object({ plz, telefon: chTelefon, email: kontaktEmail }).strict() }) as Record<string, any>;
    for (const feld of ['plz', 'telefon', 'email']) expect(js.kontakt.properties[feld]['x-klasse'], feld).toBe('inhalt');
  });
});
