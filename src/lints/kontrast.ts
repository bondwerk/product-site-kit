// Spec #435 §7.3 (Council K6): WCAG-2.x-Kontrast und Prüfmatrix aus der Kombinationstabelle. Kein node:*.
const kanal = (c: number): number => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

export function luminanz(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`keine Farbe #rrggbb: ${hex}`);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((h) => kanal(parseInt(h, 16))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function verhaeltnis(a: string, b: string): number {
  const [hell, dunkel] = [luminanz(a), luminanz(b)].sort((x, y) => y - x) as [number, number];
  return (hell + 0.05) / (dunkel + 0.05);
}

/** Erfüllt, wenn das ungerundete Verhältnis den Mindestwert erreicht. */
export const erfuellt = (v: number, mindest: number): boolean => v >= mindest;

export const FLAECHEN = ['seite', 'hell', 'akzent', 'dunkel'] as const;
export type Flaeche = (typeof FLAECHEN)[number];

/** Welches Element auf welcher Fläche vorkommt (Spec §7.3). Neue Zeile = automatisch geprüft. */
export const kombinationen: ReadonlyArray<{ element: string; flaechen: readonly Flaeche[]; vordergrund: (f: Flaeche) => string; hintergrund: (f: Flaeche) => string; mindest: number }> = [
  { element: 'Text', flaechen: FLAECHEN, vordergrund: (f) => `${f}-text`, hintergrund: (f) => `${f}-bg`, mindest: 4.5 },
  { element: 'Link', flaechen: FLAECHEN, vordergrund: (f) => `${f}-link`, hintergrund: (f) => `${f}-bg`, mindest: 4.5 },
  { element: 'Knopfschrift', flaechen: FLAECHEN, vordergrund: (f) => `${f}-knopf-text`, hintergrund: (f) => `${f}-knopf-bg`, mindest: 4.5 },
  { element: 'Knopffläche', flaechen: FLAECHEN, vordergrund: (f) => `${f}-knopf-bg`, hintergrund: (f) => `${f}-bg`, mindest: 3 },
  { element: 'Akzentlinie', flaechen: ['seite', 'hell'], vordergrund: () => 'akzentlinie', hintergrund: (f) => `${f}-bg`, mindest: 3 },
  { element: 'Rahmen', flaechen: ['seite'], vordergrund: () => 'rahmen', hintergrund: (f) => `${f}-bg`, mindest: 3 },
];

export interface Pruefpaar { vordergrund: string; hintergrund: string; mindest: number }
export const pruefpaare = (): Pruefpaar[] =>
  kombinationen.flatMap((k) => k.flaechen.map((f) => ({ vordergrund: k.vordergrund(f), hintergrund: k.hintergrund(f), mindest: k.mindest })));

/** Werte: Token ohne `--pal-` → #rrggbb, Fallbacks schon aufgelöst. Ein Befund je verfehltem Paar. */
export function kontrastBefunde(werte: Readonly<Record<string, string>>): string[] {
  return pruefpaare().flatMap((p) => {
    const v = verhaeltnis(werte[p.vordergrund]!, werte[p.hintergrund]!);
    return erfuellt(v, p.mindest) ? [] : [`${p.vordergrund} auf ${p.hintergrund}: ${v.toFixed(2)}:1, verlangt ${p.mindest}:1`];
  });
}
