// Spec #435 §7.3: relative Luminanz nach WCAG 2.x, gerundet erst in der Anzeige, nie vor dem Vergleich.
import { describe, expect, it } from 'vitest';
import { verhaeltnis, erfuellt, pruefpaare, kontrastBefunde, FLAECHEN } from '../src/lints/kontrast.js';

describe('Kontrast nach WCAG 2.x', () => {
  it('Referenzpaare', () => {
    expect(verhaeltnis('#000000', '#ffffff')).toBe(21);
    expect(verhaeltnis('#ffffff', '#000000')).toBe(21);
    expect(verhaeltnis('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(verhaeltnis('#1a1a1a', '#ffffff')).toBeCloseTo(17.4, 1);
    const v = verhaeltnis('#777777', '#FFFFFF');
    expect(v).toBeGreaterThan(4.47);
    expect(v).toBeLessThan(4.49);
  });
  it('Vergleich mit >= und ohne Runden', () => {
    expect(erfuellt(4.5, 4.5)).toBe(true);
    expect(erfuellt(verhaeltnis('#777777', '#ffffff'), 4.5)).toBe(false);
    expect(erfuellt(verhaeltnis('#767676', '#ffffff'), 4.5)).toBe(true);
    expect(() => verhaeltnis('#fff', '#000000')).toThrow('keine Farbe #rrggbb');
  });
});

describe('Prüfmatrix aus Kombinationen (Spec §7.3, B1)', () => {
  it('ergibt genau die 19 Paare', () => {
    const erwartet = [
      ...FLAECHEN.flatMap((f) => [[`${f}-text`, `${f}-bg`, 4.5], [`${f}-link`, `${f}-bg`, 4.5], [`${f}-knopf-text`, `${f}-knopf-bg`, 4.5], [`${f}-knopf-bg`, `${f}-bg`, 3]]),
      ['akzentlinie', 'seite-bg', 3], ['akzentlinie', 'hell-bg', 3], ['rahmen', 'seite-bg', 3],
    ].map(([v, h, m]) => `${v}|${h}|${m}`).sort();
    expect(pruefpaare().map((p) => `${p.vordergrund}|${p.hintergrund}|${p.mindest}`).sort()).toEqual(erwartet);
    expect(FLAECHEN).toEqual(['seite', 'hell', 'akzent', 'dunkel']);
  });
  it('Befund nennt Paar, Verhältnis und Mindestwert', () => {
    const werte = Object.fromEntries(pruefpaare().flatMap((p) => [[p.vordergrund, '#000000'], [p.hintergrund, '#ffffff']]));
    werte['akzent-link'] = '#777777';
    werte['akzent-bg'] = '#ffffff';
    expect(kontrastBefunde(werte).filter((b) => b.startsWith('akzent-link'))).toEqual(['akzent-link auf akzent-bg: 4.48:1, verlangt 4.5:1']);
  });
});
