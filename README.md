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

### Sanitizer und externe Links

`rehypeExterneLinks` läuft **nach** `rehype-sanitize`:

    rehypePlugins: [[rehypeSanitize, sanitizeSchema], rehypeExterneLinks]

Das `defaultSchema` von rehype-sanitize entfernt `target` und `rel`. In umgekehrter Reihenfolge
fehlen beide Attribute im Ergebnis, ohne Fehlermeldung.

## Veröffentlichung

Nur aus der Release-CI dieses Repos: Tag `vX.Y.Z` auf `main`, Tests, Pack-Prüfung,
Identifikator-Scan, dann `npm publish --provenance` per Trusted Publishing. Kein Token.
Das Paket enthält keine Kundendaten.

Ablauf, Freigabe, Listenpflege und Rückweg bei einem Leck: [RELEASE.md](https://github.com/bondwerk/product-site-kit/blob/main/RELEASE.md).
