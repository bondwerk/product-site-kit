import { URL_ODER_SCHEME, EMAIL_ADRESSE, ohneAdressen } from '../schema/text.js';
import { enthaeltGefaehrlicheKeys } from './json-safe.js';

/** Content-Lint mit den eigenen Adressen der Site: sie dürfen im Text stehen, fremde nicht. */
export function lintTextFuer(adressen: readonly string[]) {
  return (text: string): string[] => {
    const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
    const meldungen: string[] = [];
    for (const zeile of body.split(/\r?\n/)) {
      const rest = ohneAdressen(zeile, adressen);
      if (URL_ODER_SCHEME.test(rest)) meldungen.push(`Externe URL oder Scheme im Content: «${zeile.trim().slice(0, 120)}»`);
      else if (EMAIL_ADRESSE.test(rest)) meldungen.push(`E-Mail-Adresse im Fliesstext: «${zeile.trim().slice(0, 120)}» — Kontaktdaten gehören in die Kontakt-Datei`);
    }
    return meldungen;
  };
}

/** Content-Lint ohne eigene Adressen. */
export const lintText = lintTextFuer([]);

/** Prototype-Pollution-Guard auf der rohen JSON-Quelle: der Build bricht sichtbar. */
export function lintJsonKeys(rohJson: string): string[] {
  return enthaeltGefaehrlicheKeys(rohJson)
    ? ['Gefährlicher JSON-Key (__proto__/constructor/prototype) im Content']
    : [];
}

/** Alle String-Werte eines JSON-Werts, rekursiv. */
export function jsonStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(jsonStrings);
  if (v && typeof v === 'object') return Object.values(v).flatMap(jsonStrings);
  return [];
}
