// Subpath @bondwerk/site-kit/json-schema — kein node:*-Import (Spec #435 §4.2).
import { z } from 'astro/zod';

/**
 * Maschinenlesbarer Vertrag für den Web-Bond: je Collection ein JSON-Schema (zod 4, Modus io:'output').
 * Die Site bindet ihre Schemas in `express-kit/json-schema.ts`, weil der K1-Vertrag `alsJsonSchema()`
 * ohne Argument ruft.
 */
export function alsJsonSchemaAus(schemas: Readonly<Record<string, z.ZodType>>): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(schemas).map(([k, s]) => [k, z.toJSONSchema(s, { unrepresentable: 'any' }) as Record<string, unknown>]),
  );
}
