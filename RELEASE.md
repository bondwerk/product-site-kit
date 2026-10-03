# Release von @bondwerk/site-kit

## Ablauf

1. Version in `package.json` heben, PR, grüne CI (inklusive Identifikator-Scan), Merge auf `main`.
2. Tag `vX.Y.Z` auf dem Merge-Commit pushen. Nur Admins dürfen `v*`-Tags anlegen; kein Tag lässt
   sich löschen, verschieben oder überschreiben (Rulesets `release-tags-anlegen` und
   `release-tags-unveraenderlich`).
3. Workflow „Release": `paket` baut und packt und gibt den `integrity` (sha512) des Tarballs als
   Job-Output weiter, `pruefen` testet und scannt genau diesen Tarball, `veroeffentlichen` wartet im
   Environment `npm-release` auf die Freigabe, rechnet den `integrity` des heruntergeladenen
   Tarballs neu und bricht bei Abweichung vor `npm publish` ab.
4. Freigabe durch den Betreiber (Selbstfreigabe, ein Reviewer). Die Kontrolle gegen eine bösartige
   Version liegt im bewussten Pin pro Site: keine Site übernimmt eine Version ohne `kit-bump`, PR
   und neuen `kitVersion`-Pin.
5. Kontrolle: `npm view @bondwerk/site-kit@X.Y.Z dist.integrity` gleich dem `integrity` aus dem
   Log von `paket`; die Paketseite zeigt Provenance mit Repo und Tag-Commit.
6. Nach dem Release hebt ein PR `scripts/versions-basis.json` auf die eben veröffentlichte Version;
   `integrity` aus `npm view @bondwerk/site-kit@X.Y.Z dist.integrity`, gleich dem Wert aus dem Log von `paket`.

CI und Release arbeiten mit npm 11, exakt gepinnt (npm 10 bricht auf dem Lockfile ab). Lokal
entsprechend `npx npm@11 …`.

## Versionen

- v0.1.0: Tag gesetzt, Veröffentlichung am Pfad-Fehler gescheitert, nie auf npm; erste veröffentlichte Version ist 0.1.1.
- v0.2.0: Abschnitte (text, bildText, faq, karten, ctaBand), Gestaltungsfelder, kit.css, Palette mit Kontrast- und Stil-Lint, Komponenten; Peer astro ^7.2.8 (Minor; Versions-Test gegen 0.1.1: Exporte).

## Sichtbarkeit

Das Repo ist bis zum ersten Release privat. Vor dem Umschalten auf öffentlich scannt der Betreiber
Code, ganze Historie, PR-Refs, alle Ref-Namen samt Tag-Texten und alle PR-Texte gegen die
Identifikator-Liste. Erwartetes Ergebnis: 0 Treffer; das tatsächliche Ergebnis wird in Task 1.18
festgehalten. Ab dem Umschalten scannt die CI jeden Push und jeden PR.

## Identifikator-Liste

- Die Liste liegt im Passwort-Manager-Eintrag „site-kit Identifikatoren" und als Actions-Geheimnis
  `SITE_KIT_IDENTIFIKATOREN`, nirgends sonst: nicht im Repo, nicht in Issues, PRs oder Logs.
- Fehlt das Geheimnis, meldet die CI nur einen Hinweis und überspringt den Scan; der Release
  scheitert dann im Job `pruefen` (Exit 2). Das Geheimnis wird deshalb vor dem ersten PR gesetzt.
- Die CI scannt Titel und Beschreibung eines PRs, nicht seine Kommentare und Reviews. Kundennamen
  haben auch in Kommentaren nichts verloren; vor dem Umschalten scannt der Betreiber sie mit.
- Jede Änderung geschieht im selben Schritt an beiden Orten: Eintrag im Passwort-Manager
  bearbeiten, nach `/dev/shm/kit-ids.txt` legen (`chmod 600`),
  `gh secret set SITE_KIT_IDENTIFIKATOREN --repo bondwerk/product-site-kit < /dev/shm/kit-ids.txt`,
  `shred -u /dev/shm/kit-ids.txt`.
- Ein Eintrag je Zeile. Einträge unter vier Zeichen treffen nur an Wortgrenzen; ein Kürzel, das
  auch mitten in Wörtern stört, wird durch eine längere, eindeutige Form ergänzt.
- Integrity-Werte (`sha1-`, `sha256-`, `sha384-`, `sha512-` in exakter Länge, etwa im
  `package-lock.json`) werden vor dem Abgleich entfernt, weil Base64 zufällig kurze Einträge enthält.
- Neuer Kunde = neuer Eintrag, bevor das erste Stück Code aus seinem Umfeld ins Kit wandert.

## Rückweg bei einem Leck

Ein Kundenname, eine Domain oder ein anderes Identifikationsmerkmal ist veröffentlicht worden:

1. **npm, innerhalb von 72 Stunden nach dem Veröffentlichen:** betroffene Version zurückziehen
   (npmjs.com → Paket → Settings → „Unpublish" für genau diese Version, mit 2FA). npm erlaubt
   das in diesem Fenster, solange kein anderes veröffentlichtes Paket von der Version abhängt.
2. **npm, nach 72 Stunden:** `npm deprecate @bondwerk/site-kit@X.Y.Z "<Grund ohne den Namen>"`
   in einer kurzen Sitzung mit 2FA, sofort eine bereinigte Folgeversion veröffentlichen und alle
   Sites per `kit-bump` darauf heben.
3. **GitHub:** Repo sofort auf privat schalten, betroffene Commits aus der Historie entfernen
   (neuer Stand, Force-Push nur mit Betreiber-Freigabe; die Tag-Rulesets verhindern das für
   Tags, dafür braucht es eine befristete Ausnahme durch den Admin) und über den GitHub-Support
   zwischengespeicherte Ansichten und PR-Refs entfernen lassen.
4. Liste um den durchgerutschten Eintrag ergänzen (Abschnitt oben), vollständigen Scan
   (`--repo --pr-text`) wiederholen, erst bei 0 Treffern wieder öffentlich.
5. Den betroffenen Kunden nach Rücksprache mit dem Betreiber informieren.
