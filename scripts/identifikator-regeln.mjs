// Reine Funktionen des Identifikator-Scans (Spec #435 §11.4, F8). Die Liste nennt Kunden und liegt
// deshalb nur im Passwort-Manager und im Actions-Geheimnis; Treffer werden nur mit Listennummer
// gemeldet, nie mit dem Wort.
export function leseListe(roh) {
  return (roh ?? '').split('\n').map((s) => s.trim()).filter((s) => s !== '' && !s.startsWith('#'));
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ein Eintrag trifft den Text (ohne Gross-/Kleinschreibung). Einträge unter vier Zeichen nur an
 *  Wortgrenzen (Buchstabe oder Ziffer davor/danach zählt als Wortinneres), sonst träfe ein Kürzel
 *  jedes zweite Wort und der Scan würde abgeschaltet statt gepflegt. */
export function trifft(text, id) {
  const h = text.toLowerCase();
  const e = id.toLowerCase();
  if (e.length >= 4) return h.includes(e);
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(e)}(?![\\p{L}\\p{N}])`, 'u').test(h);
}

/** Subresource-Integrity-Werte (`sha512-…` in package-lock.json und in `git log -p`) sind Base64:
 *  „+" und „/" stehen dort wie Wortgrenzen, ein kurzer Eintrag träfe zufällig. Entfernt wird nur ein
 *  Wert mit genau der Länge seines Algorithmus; ein falsch langer „sha512-…" bleibt im Scan. */
const INTEGRITAET = /(?<![\w+/=-])sha(?:1-[A-Za-z0-9+/]{27}=|256-[A-Za-z0-9+/]{43}=|384-[A-Za-z0-9+/]{64}|512-[A-Za-z0-9+/]{86}==)(?![\w+/=])/g;
export const ohneIntegritaet = (text) => text.replace(INTEGRITAET, ' ');

export function funde(dateien, liste) {
  const out = [];
  for (const { pfad, inhalt } of dateien) {
    const heuhaufen = ohneIntegritaet(`${pfad}\n${inhalt}`);
    liste.forEach((id, i) => {
      if (trifft(heuhaufen, id)) out.push({ pfad, eintrag: i + 1 });
    });
  }
  return out;
}

/** Wie ein Fundort in der Ausgabe erscheint: der Pfad, ausser er enthält selbst einen Eintrag —
 *  dann nur seine laufende Nummer (die CI-Ausgabe ist ab dem Umschalten öffentlich lesbar). */
export function anzeige(pfad, nr, liste) {
  return liste.some((id) => trifft(pfad, id)) ? `Datei #${nr}` : pfad;
}
