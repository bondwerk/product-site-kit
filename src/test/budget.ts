// Spec #435 §8.3: Grösse des Agenten-Vertrags in Bytes (UTF-8), wie tools.ts ihn einbettet.
const bytes = (v: unknown): number => new TextEncoder().encode(JSON.stringify(v)).length;

export interface SchemaGroesse { gesamt: number; jeCollection: Record<string, number>; gestaltungDefs: number }

export function schemaGroesse(js: Readonly<Record<string, unknown>>): SchemaGroesse {
  const jeCollection = Object.fromEntries(Object.entries(js).map(([k, v]) => [k, bytes(v)]));
  const defs = Object.values(js).reduce<number>((s, v) => {
    const d = (v as { $defs?: Record<string, unknown> }).$defs;
    if (!d) return s;
    const g = Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith('gestaltung-')));
    return s + (Object.keys(g).length ? bytes(g) : 0);
  }, 0);
  return { gesamt: bytes(js), jeCollection, gestaltungDefs: defs };
}
