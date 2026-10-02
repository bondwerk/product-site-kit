import { z } from 'astro/zod';

// TLD-Liste statt generischem Muster: Dateinamen mit Endung (bild.webp, plan.pdf) sind im Content
// der Normalfall und dürfen nicht als Domain gelten.
const TLDS = 'ch|swiss|com|net|org|io|de|at|li|eu|info|shop|app|dev|xyz|ru|me|co|online|top|site|live|cloud|email|link|click|fr|it';

/** URLs, protokoll-relative Verweise, gefährliche Schemes und nackte Domains. */
export const URL_ODER_SCHEME = new RegExp(
  `(https?:\\/\\/|\\/\\/|www\\.|(?:javascript|data|vbscript):|\\b[a-z0-9-]+\\.(?:${TLDS})\\b)`,
  'i',
);

/** E-Mail-Adresse, unabhängig von der TLD. */
export const EMAIL_ADRESSE = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Entfernt die eigenen Adressen (mit optionalem Präfix, nur an Wortgrenzen) aus einer Zeile.
 * Ein Punkt mit Folgezeichen nach der Adresse gehört zu einer fremden Domain (`example.ch.ru`), ein
 * Satzpunkt am Ende (`… example.ch.`) nicht.
 */
export function ohneAdressen(zeile: string, adressen: readonly string[]): string {
  return adressen.reduce((z, a) => {
    const muster = new RegExp(String.raw`(?<![\w.-])(?:https?://|mailto:)?(?:www\.)?${escapeRegex(a)}(?!\.?[\w-])`, 'gi');
    return z.replace(muster, '');
  }, zeile);
}

/** Textfeld ohne fremde URLs, Schemes und E-Mail-Adressen; die eigenen Adressen der Site sind erlaubt. */
export const sichererTextFuer = (adressen: readonly string[]) => (max: number, min = 1) =>
  z.string().min(min).max(max)
    .refine((v) => v === '' || !URL_ODER_SCHEME.test(ohneAdressen(v, adressen)), { message: 'Keine URLs oder Links in Textfeldern' })
    .refine((v) => !EMAIL_ADRESSE.test(ohneAdressen(v, adressen)), { message: 'E-Mail-Adressen gehören in die Kontaktdaten' });

/** Textfeld ohne jede URL und E-Mail (Site ohne eigene Adressen). */
export const sichererText = sichererTextFuer([]);
