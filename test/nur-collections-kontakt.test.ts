// Nur-Collections-Lint und Kontaktdaten-Gate (Spec #435 §5.1); getestet am Subpath @bondwerk/site-kit/lints.
import { describe, expect, it } from 'vitest';
import { lintDatei, kontaktGateBefund } from '../src/lints/index.js';

describe('lintDatei — Inhalte nur über Collections', () => {
  it('flaggt hartcodierte Datenmodule, erlaubt astro:content, npm-Pakete, Komponenten und die Content-Config', () => {
    expect(lintDatei('src/pages/index.astro', "import { x } from '../i18n/content.ts';")).toHaveLength(1);
    expect(lintDatei('src/pages/index.astro', "import s from '../i18n/settlements';")).toHaveLength(1);
    expect(lintDatei('src/pages/index.astro', "import { getCollection } from 'astro:content';")).toEqual([]);
    expect(lintDatei('src/pages/index.astro', "import Basis from '../layouts/Basis.astro';\nimport x from 'rehype-sanitize';")).toEqual([]);
    expect(lintDatei('src/content.config.ts', "import { x } from './content';")).toEqual([]);
    expect(lintDatei('src/a.ts', "// eins\n// zwei\nimport d from './daten.ts';")).toEqual([{ datei: 'src/a.ts', zeile: 3, specifier: './daten.ts' }]);
  });
});

describe('kontaktGateBefund (Spec #435 §5.1: blockierendes Gate für Kontaktdaten)', () => {
  it('meldet eine geänderte Kontakt-Datei, sonst nichts', () => {
    const kontakt = ['content/de/kontakt.json'];
    expect(kontaktGateBefund(['content/de/seiten/a.md', 'content/de/kontakt.json', ''], kontakt)).toBe('geaendert');
    expect(kontaktGateBefund(['content/de/seiten/a.md', ''], kontakt)).toBe('unveraendert');
    expect(kontaktGateBefund([' content/de/kontakt.json '], kontakt)).toBe('geaendert');
  });
});
