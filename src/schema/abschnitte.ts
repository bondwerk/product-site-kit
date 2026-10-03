// Spec #435 §6.3/§6.4: Abschnitte als Discriminated Union über `variante`, stabile ID, Seite mit Abschnitten.
import { z } from 'astro/zod';
import { sichererText } from './text.js';
import { contentBildPfad } from './bild-kontakt.js';
import { linkZiel } from './link.js';
import { gestaltungsfelder, bildpositionFeld } from './gestaltung.js';

/** Vom System vergeben (§6.4): `a-` und 10 Zeichen a-z/0-9. Der Agent ändert sie nie. */
export const abschnittId = z.string().regex(/^a-[a-z0-9]{10}$/, 'Abschnitts-ID: a- und 10 Zeichen a-z/0-9');

const basis = {
  id: abschnittId.optional(),
  anker: z.string().regex(/^[a-z0-9-]{1,40}$/, 'Anker: Kleinbuchstaben, Ziffern, Bindestrich').optional(),
  titel: sichererText(120).optional(),
  lead: sichererText(300).optional(),
  notiz: sichererText(300).optional(),
  ...gestaltungsfelder,
};

const variante = <N extends string, F extends z.ZodRawShape>(name: N, felder: F) =>
  z.object({ variante: z.literal(name), ...basis, ...felder }).strict();

const karte = z.object({
  titel: sichererText(80), text: sichererText(400).optional(),
  bild: contentBildPfad.optional(), bildAlt: sichererText(160).optional(),
  link: linkZiel.optional(), linkLabel: sichererText(40).optional(),
}).strict()
  .refine((k) => (k.bild === undefined) === (k.bildAlt === undefined), { message: 'bild und bildAlt nur zusammen' })
  .refine((k) => (k.link === undefined) === (k.linkLabel === undefined), { message: 'link und linkLabel nur zusammen' });

export const varianten = {
  text: variante('text', { absaetze: z.array(sichererText(1200)).min(1).max(20) }),
  bildText: variante('bildText', { bildposition: bildpositionFeld('bildText'), bild: contentBildPfad, bildAlt: sichererText(160), absaetze: z.array(sichererText(1200)).max(20) }),
  faq: variante('faq', { fragen: z.array(z.object({ frage: sichererText(200), antwort: sichererText(1200) }).strict()).min(1).max(30) }),
  karten: variante('karten', { bildposition: bildpositionFeld('karten'), karten: z.array(karte).min(1).max(12) }),
  ctaBand: variante('ctaBand', { text: sichererText(200).optional(), knopf: z.object({ label: sichererText(40), ziel: linkZiel }).strict() }),
} as const;
export type KitVariante = keyof typeof varianten;
export type KitAbschnitt = z.output<(typeof varianten)[KitVariante]>;

/** Die Site wählt je Collection die erlaubten Varianten. Guard (Befund 5): 0 → Fehler, 1 → Objekt, doppelt → Fehler. */
export function abschnittSchema(erlaubt: readonly KitVariante[]) {
  if (erlaubt.length === 0) throw new Error('abschnittSchema: keine Variante erlaubt');
  const doppelt = [...new Set(erlaubt.filter((n, i) => erlaubt.indexOf(n) !== i))];
  if (doppelt.length) throw new Error(`abschnittSchema: Variante doppelt: ${doppelt.join(', ')}`);
  const optionen = erlaubt.map((k) => varianten[k]);
  if (optionen.length === 1) return optionen[0]!;
  return z.discriminatedUnion('variante', optionen as unknown as [(typeof optionen)[number], ...(typeof optionen)[number][]]);
}

/** Sprungziele des Layouts; kein Abschnitt darf sie als Anker belegen (B17). Seiten-Slugs kommen über die Option dazu. */
export const RESERVIERTE_ANKER: readonly string[] = ['kontakt', 'main', 'inhalt'];

/**
 * Seite mit Markdown-Text davor und Abschnitten (§6.3). `pflicht` markiert Pflichtseiten im gepinnten Schema (x-pflicht);
 * `reservierteAnker` ergänzt die festen Sprungziele um die Seiten-Slugs der Site.
 */
export function seiteSchema<A extends z.ZodType>(abschnitt: A, opt: { pflicht?: boolean; reservierteAnker?: readonly string[] } = {}) {
  const reserviert = new Set([...RESERVIERTE_ANKER, ...(opt.reservierteAnker ?? [])]);
  const s = z.object({
    titel: sichererText(80),
    lead: sichererText(200, 0).optional(),
    abschnitte: z.array(abschnitt).max(40).default([]),
  }).strict().superRefine((d, ctx) => {
    const ids = new Set<string>();
    const anker = new Set<string>();
    for (const a of d.abschnitte as ReadonlyArray<{ id?: string; anker?: string }>) {
      if (a.id !== undefined) {
        if (ids.has(a.id)) ctx.addIssue({ code: 'custom', path: ['abschnitte'], message: `Abschnitts-ID doppelt: ${a.id}` });
        ids.add(a.id);
      }
      if (a.anker !== undefined) {
        if (reserviert.has(a.anker)) ctx.addIssue({ code: 'custom', path: ['abschnitte'], message: `Anker reserviert: ${a.anker}` });
        else if (anker.has(a.anker)) ctx.addIssue({ code: 'custom', path: ['abschnitte'], message: `Anker doppelt: ${a.anker}` });
        anker.add(a.anker);
      }
    }
  });
  return opt.pflicht ? s.meta({ 'x-pflicht': true }) : s;
}
