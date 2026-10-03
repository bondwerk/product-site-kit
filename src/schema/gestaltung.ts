// Spec #435 §6.1/§6.2: einzige Quelle für Stufen, Normalwerte, Labels und Kundenwörter. Kein node:*.
import { z } from 'astro/zod';

export const GESTALTUNGSFELDER = ['breite', 'betonung', 'farbe', 'titelgroesse', 'ausrichtung', 'abstand', 'bildposition', 'sichtbar'] as const;
export type Gestaltungsfeld = (typeof GESTALTUNGSFELDER)[number];

export const stufen = {
  breite: ['normal', 'voll'], betonung: ['normal', 'hervorgehoben', 'kasten'], farbe: ['standard', 'hell', 'akzent', 'dunkel'],
  titelgroesse: ['klein', 'normal', 'gross'], ausrichtung: ['links', 'zentriert'], abstand: ['eng', 'normal', 'weit'],
  bildposition: ['links', 'rechts', 'oben'],
} as const;

/** Normalwert je Feld als Daten (§6.1). Komponente, Nullwert-Test und Labels lesen nur von hier. */
export const normalwerte = { breite: 'normal', betonung: 'normal', farbe: 'standard', titelgroesse: 'normal', ausrichtung: 'links', abstand: 'normal', sichtbar: true } as const;
/** bildposition hat je Variante einen eigenen Normalwert (§6.1). */
export const bildpositionNormal: Readonly<Record<string, 'links' | 'rechts' | 'oben'>> = { bildText: 'links', karten: 'oben' };

interface WertEintrag { readonly label: string; readonly wirkung: string; readonly kundenwoerter: readonly string[] }
/** F3: Ersatz setzt einen anderen Wert; O6: Rückfrage setzt keinen Wert, die Freigabe fragt nach (S4: Löschung, Stufe ≥ 2). */
type Ersatz =
  | { readonly kundenwoerter: readonly string[]; readonly art: 'ersatz'; readonly wert: string; readonly satz: string }
  | { readonly kundenwoerter: readonly string[]; readonly art: 'rueckfrage'; readonly satz: string };
interface FeldEintrag { readonly label: string; readonly werte: Readonly<Record<string, WertEintrag>>; readonly ersatz: readonly Ersatz[] }
const w = (label: string, wirkung: string, ...kundenwoerter: string[]): WertEintrag => ({ label, wirkung, kundenwoerter });

export const kundenwoerter: Readonly<Record<Gestaltungsfeld, FeldEintrag>> = {
  breite: { label: 'Breite des Abschnitts', ersatz: [], werte: {
    normal: w('normale Breite', 'Lesebreite'),
    voll: w('über die ganze Breite', 'volle Inhaltsspalte, nicht der ganze Bildschirm', 'über die ganze Breite', 'breiter', 'nicht so schmal') } },
  betonung: { label: 'Hervorhebung', ersatz: [], werte: {
    normal: w('ohne Hervorhebung', 'ohne Hervorhebung'),
    hervorgehoben: w('hervorgehoben', 'Akzentlinie links und grösserer Lead', 'hervorheben', 'auffälliger'),
    kasten: w('als Kasten', 'gerahmte Fläche mit Innenabstand', 'einrahmen', 'als Kasten') } },
  farbe: { label: 'Hintergrundfarbe', ersatz: [], werte: {
    standard: w('ohne Hintergrundfarbe', 'Seitenhintergrund'),
    hell: w('hell hinterlegt', 'helle Fläche aus der Palette', 'heller Hintergrund'),
    akzent: w('in der Hausfarbe', 'Fläche in der Hausfarbe', 'farbig', 'in unserer Farbe'),
    dunkel: w('dunkel hinterlegt', 'dunkle Fläche aus der Palette', 'dunkel hinterlegt') } },
  titelgroesse: { label: 'Grösse der Überschrift', werte: {
    klein: w('klein', 'kleinere Überschrift', 'kleiner', 'dezenter'),
    normal: w('normal', 'normale Überschrift'),
    gross: w('gross', 'grössere Überschrift; die Hierarchie h2/h3 bleibt', 'grösser') },
    ersatz: [{ kundenwoerter: ['fetter', 'dicker'], art: 'ersatz', wert: 'gross', satz: '‚Fetter‘ gibt es nicht als eigene Einstellung; wir haben die Überschrift grösser gemacht.' }] },
  ausrichtung: { label: 'Ausrichtung', ersatz: [], werte: {
    links: w('linksbündig', 'Titel und Lead linksbündig', 'linksbündig'),
    zentriert: w('zentriert', 'Titel und Lead zentriert', 'zentriert', 'in die Mitte') } },
  abstand: { label: 'Abstand', ersatz: [], werte: {
    eng: w('weniger Abstand', 'weniger Abstand oben und unten', 'enger zusammen', 'weniger Abstand'),
    normal: w('normaler Abstand', 'normaler Abstand'),
    weit: w('mehr Abstand', 'mehr Abstand oben und unten', 'mehr Luft') } },
  bildposition: { label: 'Position des Bilds', ersatz: [], werte: {
    links: w('links', 'Bild links neben dem Text', 'Bild links'),
    rechts: w('rechts', 'Bild rechts neben dem Text', 'Bild rechts'),
    oben: w('über dem Text', 'Bild über dem Text', 'Bild über dem Text') } },
  sichtbar: { label: 'Sichtbarkeit', werte: {
    true: w('eingeblendet', 'der Abschnitt erscheint auf der Seite'),
    false: w('ausgeblendet', 'der Abschnitt erscheint nicht, der Inhalt bleibt in der Datei', 'ausblenden', 'vorerst ausblenden') },
    ersatz: [{ kundenwoerter: ['entfernen', 'weg', 'raus'], art: 'rueckfrage', satz: 'Ausgeblendet ist nicht gelöscht — soll der Inhalt endgültig entfernt werden? Bitte bestätigen.' }] },
};

const zitat = (ws: readonly string[]) => ws.map((x) => `„${x}“`).join(', ');

/** Beschreibung für das JSON-Schema (§8.2): jeder Wert in einem Satz, Kundenwörter, Normalwert, Ersatz. */
export function beschreibung(feld: Gestaltungsfeld): string {
  const e = kundenwoerter[feld];
  const werte = Object.entries(e.werte)
    .map(([wert, x]) => `${wert}: ${x.wirkung}${x.kundenwoerter.length ? ` (Kunde sagt etwa ${zitat(x.kundenwoerter)})` : ''}`)
    .join('; ');
  const normal = feld === 'bildposition' ? 'je nach Art des Abschnitts, siehe x-normalwert' : `Normalwert ${String(normalwerte[feld])}`;
  const ersatz = e.ersatz.map((r) => (r.art === 'ersatz'
    ? ` Ersatz: ${zitat(r.kundenwoerter)} wird ${r.wert}; die Freigabe nennt die Ersetzung.`
    : ` Rückfrage: ${zitat(r.kundenwoerter)} setzt keinen Wert; die Freigabe fragt: ${r.satz}`)).join('');
  return `${e.label}. Werte: ${werte}. Feld weglassen = ${normal}.${ersatz}`;
}

/** Gestaltungsfelder eines Abschnitts (§6.1): alle .optional(), nie .default() (Nullwert = kein Byte). */
export const gestaltungsfelder = {
  breite: z.enum(stufen.breite).optional(),
  betonung: z.enum(stufen.betonung).optional(),
  farbe: z.enum(stufen.farbe).optional(),
  titelgroesse: z.enum(stufen.titelgroesse).optional(),
  ausrichtung: z.enum(stufen.ausrichtung).optional(),
  abstand: z.enum(stufen.abstand).optional(),
  sichtbar: z.boolean().optional(),
} as const;
