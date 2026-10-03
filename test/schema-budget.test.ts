// Spec #435 §8.3 (Befund 3): Schemagrösse in Bytes, so wie tools.ts sie einbettet (JSON.stringify, UTF-8).
import { describe, expect, it } from 'vitest';
import { schemaGroesse } from '../src/test/index.js';
import { alsJsonSchemaAus } from '../src/json-schema/index.js';
import { abschnittSchema, seiteSchema } from '../src/schema/index.js';

const fixture = () => alsJsonSchemaAus({
  seiten: seiteSchema(abschnittSchema(['text', 'bildText', 'faq', 'karten', 'ctaBand'])),
  rechtliches: seiteSchema(abschnittSchema(['text']), { pflicht: true }),
});

describe('Schema-Budget (Spec §8.3)', () => {
  it('misst gesamt, je Collection und die Gestaltungs-Defs', () => {
    const g = schemaGroesse({ a: { x: 'ä' }, b: { $defs: { 'gestaltung-breite': { y: 1 } } } });
    expect(g).toEqual({ gesamt: Buffer.byteLength(JSON.stringify({ a: { x: 'ä' }, b: { $defs: { 'gestaltung-breite': { y: 1 } } } })),
      jeCollection: { a: Buffer.byteLength('{"x":"ä"}'), b: Buffer.byteLength('{"$defs":{"gestaltung-breite":{"y":1}}}') },
      gestaltungDefs: Buffer.byteLength('{"gestaltung-breite":{"y":1}}') });
  });
});

/** Plan O2: Regressionswache = Messung M2 + 10 %, aufgerundet (Messung in Task 2.6 Schritt 3, Werte in Plan §4.1). */
const GRENZE_GESAMT = 18394;
const GRENZE_DEFS = 9779;

describe('Schema-Budget — Grenze (O2)', () => {
  it('zwei Kit-Collections bleiben unter Messung + 10 %', () => {
    const g = schemaGroesse(fixture());
    console.log(`schema-budget: gesamt=${g.gesamt} defs=${g.gestaltungDefs}`);
    expect(g.gesamt).toBeLessThanOrEqual(GRENZE_GESAMT);
    expect(g.gestaltungDefs).toBeLessThanOrEqual(GRENZE_DEFS);
  });
});
