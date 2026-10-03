// Spec #435 §8.2/§8.3, Plan B3–B6: Gestaltungsfelder einmal je Collection unter $defs, Annotationen aus kundenwoerter.
import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { alsJsonSchemaAus } from '../src/json-schema/index.js';
import { abschnittSchema, seiteSchema, sichererText } from '../src/schema/index.js';
import { kundenwoerter, beschreibung } from '../src/schema/gestaltung.js';
import { GESTALTUNG_KENNUNG } from '../src/schema/version.js';

type O = Record<string, any>;
const ALLE = ['text', 'bildText', 'faq', 'karten', 'ctaBand'] as const;
const js = alsJsonSchemaAus({
  seiten: seiteSchema(abschnittSchema([...ALLE])),
  rechtliches: seiteSchema(abschnittSchema(['text']), { pflicht: true }),
  kontakt: z.object({ firma: sichererText(80) }).strict(),
}) as Record<string, O>;
const zweige = (c: O): O[] => { const i = c.properties.abschnitte.items; return i.anyOf ?? i.oneOf ?? [i]; };

describe('alsJsonSchemaAus mit Gestaltung', () => {
  it('Gestaltungsfelder sind $ref auf $defs der Collection; Defs tragen Annotationen aus kundenwoerter', () => {
    const s = js.seiten!;
    expect(zweige(s)).toHaveLength(5);
    for (const v of zweige(s)) {
      for (const feld of ['breite', 'betonung', 'farbe', 'titelgroesse', 'ausrichtung', 'abstand', 'sichtbar']) {
        expect(v.properties[feld], `${v.properties.variante.const}.${feld}`).toEqual({ $ref: `#/$defs/gestaltung-${feld}` });
      }
      expect(v.required).not.toContain('breite');
    }
    const d = s.$defs['gestaltung-titelgroesse'];
    expect(d).toMatchObject({ type: 'string', enum: ['klein', 'normal', 'gross'], description: beschreibung('titelgroesse'),
      'x-label': 'Grösse der Überschrift', 'x-gestaltungsstufe': 1, 'x-normalwert': 'normal', 'x-ersatz': kundenwoerter.titelgroesse.ersatz });
    expect(d['x-wert-label']).toEqual({ klein: 'klein', normal: 'normal', gross: 'gross' });
    expect(s.$defs['gestaltung-sichtbar']).toMatchObject({ type: 'boolean', 'x-normalwert': true, 'x-wert-label': { true: 'eingeblendet', false: 'ausgeblendet' },
      'x-ersatz': kundenwoerter.sichtbar.ersatz });
  });
  it('bildposition: $ref plus x-normalwert je Variante (bildText links, karten oben)', () => {
    const v = Object.fromEntries(zweige(js.seiten!).map((z) => [z.properties.variante.const, z]));
    expect(v.bildText!.properties.bildposition).toEqual({ $ref: '#/$defs/gestaltung-bildposition', 'x-normalwert': 'links' });
    expect(v.karten!.properties.bildposition).toEqual({ $ref: '#/$defs/gestaltung-bildposition', 'x-normalwert': 'oben' });
    expect(js.seiten!.$defs['gestaltung-bildposition']['x-normalwert']).toBeUndefined();
  });
  it('jede Beschreibung steht genau einmal je Collection (Token-Budget §8.3)', () => {
    const text = JSON.stringify(js.seiten);
    for (const feld of Object.keys(kundenwoerter)) {
      expect(text.split(JSON.stringify(beschreibung(feld as keyof typeof kundenwoerter))).length - 1, feld).toBe(1);
    }
  });
  it('x-gestaltung an jeder Collection mit Gestaltungs-Defs (B3), x-pflicht nur an Pflichtseiten, Kontakt unberührt', () => {
    expect(Object.keys(js).sort()).toEqual(['kontakt', 'rechtliches', 'seiten']);
    expect(js.seiten!['x-gestaltung']).toBe(GESTALTUNG_KENNUNG);
    expect(js.rechtliches!['x-gestaltung']).toBe(GESTALTUNG_KENNUNG);
    expect(js.rechtliches!['x-pflicht']).toBe(true);
    expect(js.seiten!['x-pflicht']).toBeUndefined();
    expect(js.kontakt!['x-gestaltung']).toBeUndefined();
    expect(js.kontakt!.$defs).toBeUndefined();
    expect(js.kontakt!.properties.firma['x-klasse']).toBe('inhalt');
    expect(zweige(js.rechtliches!)[0]!.properties.variante.const).toBe('text');
  });
  it('$ref ist relativ zur Collection-Wurzel auflösbar (wie laengen-vorpruefung.ts)', () => {
    for (const v of zweige(js.seiten!)) for (const p of Object.values(v.properties) as O[]) {
      if (typeof p.$ref === 'string') expect(js.seiten!.$defs[p.$ref.replace('#/$defs/', '')], p.$ref).toBeDefined();
    }
  });
});
