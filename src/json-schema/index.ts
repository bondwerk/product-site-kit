// Subpath @bondwerk/site-kit/json-schema — kein node:*-Import (Spec #435 §4.2).
import { z } from 'astro/zod';
import { GESTALTUNG_KENNUNG } from '../schema/version.js';

type Obj = Record<string, unknown>;

/** B3: Kennung an jeder Collection, deren $defs Gestaltungsfelder tragen (zod erzeugt sie aus den id-Metadaten, Weg A). */
function mitKennung(collection: Obj): Obj {
  const defs = collection.$defs as Obj | undefined;
  return defs && Object.keys(defs).some((k) => k.startsWith('gestaltung-')) ? { ...collection, 'x-gestaltung': GESTALTUNG_KENNUNG } : collection;
}

/**
 * Maschinenlesbarer Vertrag für den Web-Bond: je Collection ein JSON-Schema (zod 4, Modus io:'output'),
 * bei Kit-Abschnitten mit $defs, x-label, x-wert-label, x-gestaltungsstufe, x-normalwert, x-ersatz und x-gestaltung.
 * Die Site bindet ihre Schemas in `express-kit/json-schema.ts`, weil der K1-Vertrag `alsJsonSchema()` ohne Argument ruft.
 */
export function alsJsonSchemaAus(schemas: Readonly<Record<string, z.ZodType>>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(schemas).map(([k, s]) => [k, mitKennung(z.toJSONSchema(s, { unrepresentable: 'any' }) as Obj)]),
  );
}
