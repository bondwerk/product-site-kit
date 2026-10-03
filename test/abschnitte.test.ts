// Spec #435 §6.3/§6.4; Council „discriminatedUnion braucht ≥2" (Befund 5): Guard für 0, 1, doppelt.
import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';
import { abschnittSchema, seiteSchema } from '../src/schema/index.js';

const text = { variante: 'text', absaetze: ['Seit 1998 im Quartier.'] };
const faq = { variante: 'faq', fragen: [{ frage: 'Wann offen?', antwort: 'Montag bis Freitag.' }] };

describe('abschnittSchema — Guard', () => {
  it('null Varianten: Fehler; doppelte Variante: Fehler', () => {
    expect(() => abschnittSchema([])).toThrow('abschnittSchema: keine Variante erlaubt');
    expect(() => abschnittSchema(['text', 'text'])).toThrow('abschnittSchema: Variante doppelt: text');
  });
  it('genau eine Variante: gültiges Objekt-Schema, keine Union, fremde Variante abgelehnt', () => {
    const s = abschnittSchema(['text']);
    expect(s.safeParse(text).success).toBe(true);
    expect(s.safeParse(faq).success).toBe(false);
    const js = z.toJSONSchema(s, { unrepresentable: 'any' }) as Record<string, unknown>;
    expect(js.type).toBe('object');
    expect(js.anyOf ?? js.oneOf).toBeUndefined();
  });
  it('zwei Varianten: Union über variante', () => {
    const s = abschnittSchema(['text', 'faq']);
    expect(s.safeParse(text).success).toBe(true);
    expect(s.safeParse(faq).success).toBe(true);
    expect(s.safeParse({ variante: 'karten', karten: [] }).success).toBe(false);
  });
});

describe('Varianten (Spec §6.3)', () => {
  const s = abschnittSchema(['text', 'bildText', 'faq', 'karten', 'ctaBand']);
  it('Grenzen und Pflichtfelder', () => {
    expect(s.safeParse({ variante: 'text', absaetze: [] }).success).toBe(false);
    expect(s.safeParse({ variante: 'bildText', bild: 'bilder/a.webp', absaetze: [] }).success).toBe(false);   // bildAlt fehlt
    expect(s.safeParse({ variante: 'bildText', bild: 'bilder/a.webp', bildAlt: 'Laden', absaetze: [], bildposition: 'rechts' }).success).toBe(true);
    expect(s.safeParse({ variante: 'karten', karten: [{ titel: 'Kurs', link: '/kurse' }] }).success).toBe(false);   // linkLabel fehlt
    expect(s.safeParse({ variante: 'karten', karten: [{ titel: 'Kurs', link: '/kurse', linkLabel: 'Mehr' }] }).success).toBe(true);
    expect(s.safeParse({ variante: 'ctaBand', knopf: { label: 'Anfragen', ziel: '#kontakt' } }).success).toBe(true);
    expect(s.safeParse({ variante: 'ctaBand', knopf: { label: 'Anfragen', ziel: 'javascript:alert(1)' } }).success).toBe(false);
  });
  it('ID-Format, unbekannte Felder und Stufenwerte', () => {
    expect(s.safeParse({ ...text, id: 'a-0123456789' }).success).toBe(true);
    for (const id of ['a-012345678', 'b-0123456789', 'a-ABCDEFGHIJ']) expect(s.safeParse({ ...text, id }).success, id).toBe(false);
    expect(s.safeParse({ ...text, style: 'color:red' }).success).toBe(false);
    expect(s.safeParse({ ...text, farbe: 'pink' }).success).toBe(false);
    expect(s.safeParse({ ...text, farbe: 'akzent', betonung: 'kasten', titelgroesse: 'gross', sichtbar: false }).success).toBe(true);
  });
});

describe('seiteSchema (Spec §6.3/§6.4, B9)', () => {
  const seite = seiteSchema(abschnittSchema(['text', 'faq']));
  it('abschnitte default [], max 40; titel Pflicht; doppelte ID abgelehnt', () => {
    expect(seite.parse({ titel: 'Über uns' }).abschnitte).toEqual([]);
    expect(seite.safeParse({ titel: 'X', abschnitte: Array.from({ length: 41 }, () => text) }).success).toBe(false);
    expect(seite.safeParse({ lead: 'x' }).success).toBe(false);
    const doppelt = seite.safeParse({ titel: 'X', abschnitte: [{ ...text, id: 'a-0000000001' }, { ...faq, id: 'a-0000000001' }] });
    expect(doppelt.success).toBe(false);
    expect(doppelt.error?.issues[0]?.message).toBe('Abschnitts-ID doppelt: a-0000000001');
    expect(seite.safeParse({ titel: 'X', abschnitte: [{ ...text, id: 'a-0000000001' }, { ...faq, id: 'a-0000000002' }, faq] }).success).toBe(true);
  });
});

describe('seiteSchema — Anker (B17)', () => {
  const seite = seiteSchema(abschnittSchema(['text', 'faq']), { reservierteAnker: ['impressum'] });
  const fehler = (abschnitte: object[]) => seite.safeParse({ titel: 'X', abschnitte }).error?.issues.map((i) => i.message) ?? [];
  it('doppelte Anker auf einer Seite und reservierte IDs abgelehnt; Seiten-Slugs über die Option', () => {
    expect(fehler([{ ...text, anker: 'angebot' }, { ...faq, anker: 'preise' }])).toEqual([]);
    expect(fehler([{ ...text, anker: 'angebot' }, { ...faq, anker: 'angebot' }])).toEqual(['Anker doppelt: angebot']);
    for (const r of ['kontakt', 'main', 'inhalt', 'impressum']) expect(fehler([{ ...text, anker: r }]), r).toEqual([`Anker reserviert: ${r}`]);
    expect(seiteSchema(abschnittSchema(['text'])).safeParse({ titel: 'X', abschnitte: [{ ...text, anker: 'impressum' }] }).success).toBe(true);
  });
});

describe('anker und .strict() (Review-Befund 5)', () => {
  const s = abschnittSchema(['text', 'faq', 'karten', 'ctaBand']);
  const seite = seiteSchema(abschnittSchema(['text']));
  it('anker-Regex: gültig angenommen; Grossbuchstaben, Leerzeichen, 41 Zeichen abgelehnt', () => {
    expect(s.safeParse({ ...text, anker: 'kontakt-1' }).success).toBe(true);
    expect(s.safeParse({ ...text, anker: 'a'.repeat(40) }).success).toBe(true);
    for (const schlecht of ['Kontakt', 'a b', 'a'.repeat(41)]) expect(s.safeParse({ ...text, anker: schlecht }).success, schlecht).toBe(false);
  });
  it('karte: unbekanntes Feld abgelehnt', () => {
    expect(s.safeParse({ variante: 'karten', karten: [{ titel: 'Kurs', fremd: 1 }] }).success).toBe(false);
    expect(s.safeParse({ variante: 'karten', karten: [{ titel: 'Kurs' }] }).success).toBe(true);
  });
  it('knopf: unbekanntes Feld abgelehnt', () => {
    expect(s.safeParse({ variante: 'ctaBand', knopf: { label: 'Los', ziel: '/x', fremd: 1 } }).success).toBe(false);
  });
  it('faq-Eintrag: unbekanntes Feld abgelehnt', () => {
    expect(s.safeParse({ variante: 'faq', fragen: [{ frage: 'F?', antwort: 'A.', fremd: 1 }] }).success).toBe(false);
  });
  it('Seitenobjekt: unbekanntes Feld abgelehnt', () => {
    expect(seite.safeParse({ titel: 'Start', abschnitte: [] }).success).toBe(true);
    expect(seite.safeParse({ titel: 'Start', abschnitte: [], fremd: 1 }).success).toBe(false);
  });
});
