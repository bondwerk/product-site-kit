# @bondwerk/site-kit

Gemeinsame Bausteine für die Kunden-Sites von bondwerk auf Astro 7: Feld-Primitiven und der
JSON-Schema-Vertrag für den Web-Bond, Content-Lints, Build-Integrationen und Testhelfer.

## Einbinden

    npm install @bondwerk/site-kit@<version> --save-exact

Immer eine exakte Version, dazu `save-exact=true` in der `.npmrc` der Site. `astro`, `zod` und
`rehype-sanitize` sind peerDependencies; `npm ls zod` zeigt in der Site genau eine Version.

| Subpath | Inhalt | Laufzeit |
|---|---|---|
| `@bondwerk/site-kit/schema` | zod-Primitiven (`sichererText`, `contentBildPfad`, `plz`, `chTelefon`, …) | ohne `node:*`, läuft im Schema-Bundle |
| `@bondwerk/site-kit/json-schema` | `alsJsonSchemaAus(schemas)` | ohne `node:*` |
| `@bondwerk/site-kit/lints` | Content-Lint, JSON-Guard, Nur-Collections-Lint, Kontaktdaten-Gate | Build und CI |
| `@bondwerk/site-kit/integrationen` | Astro-Integrationen und Sanitizer | Build |
| `@bondwerk/site-kit/test` | Testhelfer (Inline-Code, Symlinks) | nur Tests |
| `@bondwerk/site-kit/komponenten/Abschnitte.astro` | rendert `abschnitte` | Build |
| `@bondwerk/site-kit/stile/kit.css`, `@bondwerk/site-kit/stile/palette.vorlage.css` | CSS aller Stufen bzw. Vorlage für `src/styles/palette.css` | Build |

Von `./komponenten/*` ist nur `Abschnitte.astro` öffentlicher Vertrag. Die übrigen Dateien darunter
(`Abschnitt.astro`, `Link.astro`, `varianten/*`) sind intern und können sich in jeder Version ändern.

### Sanitizer und externe Links

`rehypeExterneLinks` läuft **nach** `rehype-sanitize`:

    rehypePlugins: [[rehypeSanitize, sanitizeSchema], rehypeExterneLinks]

Das `defaultSchema` von rehype-sanitize entfernt `target` und `rel`. In umgekehrter Reihenfolge
fehlen beide Attribute im Ergebnis, ohne Fehlermeldung.

## Gestaltung

Abschnitte (`text`, `bildText`, `faq`, `karten`, `ctaBand`) tragen optionale Gestaltungsfelder mit
Normalwerten (Spec #435 §6.1). Lässt eine Seite ein Feld weg, gilt der Normalwert; `kit.css`
schreibt dafür keine Regel.

Palette: 14 Pflicht-Tokens (`--pal-*`) und 8 optionale Knopf-Tokens je Fläche. Fehlt ein
Knopf-Token, greift der Fallback auf das umgekehrte Flächenpaar. Der Kontrast-Lint rechnet mit dem
wirksamen Wert.

Stil-Lint: `paletteLint()` prüft jedes CSS unter `src/` ausser `palette.css` und die `<style>`-Blöcke
aller `.astro`-Dateien unter `src/`. Verboten sind Farbliterale in Farbeigenschaften,
`--pal-*`-Deklarationen, `transparent` als Text- oder Linienfarbe, CSS-Escapes im
Eigenschaftsnamen und ausserhalb von `.kit-knopf` jede `text-decoration`-Linie ausser `underline`
(Links im Fliesstext und in Kit-Abschnitten bleiben unterstrichen). Ausnahme ab 0.3.0: `text-decoration: none`
(bzw. `text-decoration-line: none`) ist ausserhalb von Fliesstext und Kit-Abschnitten erlaubt, etwa `a`, `.knopf`
oder `.news__karte h3 a`. Grundlage ist die Kaskade: `kit.css` unterstreicht mit
`.kit-fliesstext a:not(.kit-knopf), .kit-abschnitt a:not(.kit-knopf)` (Spezifität 0,2,1). Der Lint lässt `none`
deshalb nur zu, wenn jeder Selektor der Regel eine Spezifität strikt unter (0,2,1) hat (also keine ID, höchstens
eine Klasse plus Elemente oder zwei Klassen ohne Element), nirgends `kit-` vorkommt, kein Escape, kein
`!important` und die Regel nicht in einer anderen Stilregel verschachtelt ist (CSS-Nesting). Kein `@import` darf
`layer` tragen (Befund, auch über eine Zwischendatei), sonst gewänne jedes Site-CSS gegen `kit.css`; `@layer`-Blöcke bleiben erlaubt. **Folge:** Fliesstext, den die Site
selbst rendert (etwa Markdown), muss in `class="kit-fliesstext"` stehen; sonst verliert er mit einer globalen
Regel wie `a { text-decoration: none }` die Unterstreichung, ohne dass der Lint es merkt.
Farbverläufe: `linear-gradient` ist erlaubt, wenn jeder Farbstopp `var(--pal-*)`, `transparent` oder genau
`color-mix(in srgb, var(--pal-*) n%, transparent)` (n von 0 bis 100) ist, dazu Richtung, Winkel und Positionen.
Literal-Farben im Verlauf, andere `color-mix`-Formen, `radial-gradient` und `repeating-linear-gradient` bleiben
Befunde. Verläufe gehören in `background-image`; Zusätze wie `no-repeat` oder `center` in der Kurzform
`background` sind Befunde, dafür `background-repeat`, `background-position` usw. einzeln setzen. Symlinks unter `src/` und `@import` mit Ziel ausserhalb
von `src/` (ausser `@bondwerk/site-kit/stile/kit.css`) sind ebenfalls Befunde. Nicht geprüft werden
`public/*.css` und Präprozessor-Dateien (`.scss`, `.pcss` usw.); eine Site legt ihr CSS deshalb als
`.css` unter `src/` oder in `<style>` ab.

Pflicht für Konsumenten (Beispiel: eine Site „Grünwerk" auf `example.ch`):

- `build: { inlineStylesheets: 'never' }` in `astro.config.mjs`
- `paletteLint()` in den Integrationen
- `kit.css` und `palette.css` im Layout importieren, `class="kit-seite"` am `body`
- Markdown-Text in `class="kit-fliesstext"`
- Seiten-Slugs der Site als `reservierteAnker` an `seiteSchema`

Längen lassen sich im eigenen CSS der Site setzen: `--kit-lesebreite`,
`--kit-abstand-eng|normal|weit` und die Titelgrössen
`--kit-titel-gross-2|klein-2|gross-3|klein-3` (in `em`; eine Site mit eigenen
Überschriftsgrössen setzt sie passend).

Schema-Vertrag im JSON-Schema: `x-gestaltung` (Major.Minor), `x-gestaltungsstufe`, `x-klasse`
(`inhalt` oder `link`) und `x-ersatz` (Ersatz und Rückfrage).

## Veröffentlichung

Nur aus der Release-CI dieses Repos: Tag `vX.Y.Z` auf `main`, Tests, Pack-Prüfung,
Identifikator-Scan, Versions-Test gegen die gepinnte Basisversion aus `scripts/versions-basis.json` (Exporte bleiben eine
Obermenge, jede alte `kit.css`-Regel bleibt wörtlich und in gleicher Ordnung enthalten, das normalisierte HTML der Fixture-Site
bleibt gleich; Abweichungen nur über `scripts/versions-ausnahmen.json`, je Eintrag `basis`, `regel` oder
`seite` und `begruendung`, gültig nur für genau diese Basisversion), dann `npm publish --provenance` per Trusted Publishing. Kein Token.
Das Paket enthält keine Kundendaten.

Ablauf, Freigabe, Listenpflege und Rückweg bei einem Leck: [RELEASE.md](https://github.com/bondwerk/product-site-kit/blob/main/RELEASE.md).
