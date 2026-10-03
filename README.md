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

Stil-Lint: `paletteLint()` prüft jedes CSS unter `src/` ausser `palette.css`. Verboten sind
Farbliterale in Farbeigenschaften, `--pal-*`-Deklarationen und `text-decoration*: none` ausserhalb
von `.kit-knopf` (Links im Fliesstext bleiben unterstrichen).

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
Identifikator-Scan, dann `npm publish --provenance` per Trusted Publishing. Kein Token.
Das Paket enthält keine Kundendaten.

Ablauf, Freigabe, Listenpflege und Rückweg bei einem Leck: [RELEASE.md](https://github.com/bondwerk/product-site-kit/blob/main/RELEASE.md).
