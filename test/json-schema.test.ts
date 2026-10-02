import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { alsJsonSchemaAus } from '../src/json-schema/index.js';
import { sichererText } from '../src/schema/index.js';

describe('alsJsonSchemaAus', () => {
  it('liefert je Collection ein JSON-Schema mit den Grenzen des zod-Schemas', () => {
    const js = alsJsonSchemaAus({ seiten: z.object({ titel: sichererText(80), lead: sichererText(200, 0).optional() }).strict() });
    expect(Object.keys(js)).toEqual(['seiten']);
    expect(js.seiten.type).toBe('object');
    expect(js.seiten.additionalProperties).toBe(false);
    expect(js.seiten.required).toEqual(['titel']);
    expect((js.seiten.properties as Record<string, { maxLength?: number }>).titel.maxLength).toBe(80);
  });
  it('Modus io:output — ein Feld mit .default() steht in required', () => {
    expect(alsJsonSchemaAus({ x: z.object({ sichtbar: z.boolean().default(true) }) }).x.required).toEqual(['sichtbar']);
  });
});
