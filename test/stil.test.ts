// Spec #435 §7.1/§7.2, Plan B2/B18: in jedem CSS ausser palette.css Farben nur aus var(--pal-*), keine Palette-Tokens,
// Unterstreichung nur am Knopf aus.
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stilBefunde } from '../src/lints/index.js';
import { paletteLint } from '../src/integrationen/index.js';

const VORLAGE = readFileSync(new URL('../src/stile/palette.vorlage.css', import.meta.url), 'utf8');

describe('stilBefunde', () => {
  it('erlaubt Palette-Variablen, Schlüsselwörter, Längen und Längen-Variablen', () => {
    expect(stilBefunde('body { font-family: system-ui; max-width: 60rem; margin: 0 auto; padding: 1rem; }')).toEqual([]);
    expect(stilBefunde('.x { color: var(--pal-seite-text); border: 1px solid var(--pal-rahmen); background-color: transparent; --kit-lesebreite: 50rem; }')).toEqual([]);
    expect(stilBefunde('.kit-knopf { text-decoration-line: none; }')).toEqual([]);
  });
  it('meldet Farbliterale, Palette-Deklarationen und entfernte Unterstreichung', () => {
    expect(stilBefunde('a { color: #ff0000; }')).toEqual(['Farbe nicht aus der Palette: «a { color: #ff0000 }»']);
    expect(stilBefunde('.x { background: rgb(1, 2, 3); }')).toEqual(['Farbe nicht aus der Palette: «.x { background: rgb(1, 2, 3) }»']);
    expect(stilBefunde('.x { border-color: red; }')).toEqual(['Farbe nicht aus der Palette: «.x { border-color: red }»']);
    expect(stilBefunde(':root { --pal-seite-bg: #ffffff; }')).toEqual(['Palette-Token ausserhalb palette.css: «:root { --pal-seite-bg: #ffffff }»']);
    expect(stilBefunde('a { text-decoration: none; }')).toEqual(['Unterstreichung entfernt ausserhalb .kit-knopf: «a { text-decoration: none }»']);
    expect(stilBefunde('@media (max-width: 40rem) { .kit-fliesstext a { text-decoration-line: none; } }'))
      .toEqual(['Unterstreichung entfernt ausserhalb .kit-knopf: «.kit-fliesstext a { text-decoration-line: none }»']);
  });
});

describe('stilBefunde — Umgehungen (Abschluss-Review Kit-Block)', () => {
  const FARBE = (z: string) => [`Farbe nicht aus der Palette: ${z}`];
  it('Eigenschaftsnamen ohne Rücksicht auf Gross-/Kleinschreibung; Deklaration ohne Doppelpunkt wird übersprungen', () => {
    expect(stilBefunde('a { COLOR: red; }')).toEqual(FARBE('«a { COLOR: red }»'));
    expect(stilBefunde('a { Text-Decoration: none; }')).toEqual(['Unterstreichung entfernt ausserhalb .kit-knopf: «a { Text-Decoration: none }»']);
    expect(stilBefunde(':root { --PAL-seite-bg: #ffffff; }')).toEqual(['Palette-Token ausserhalb palette.css: «:root { --PAL-seite-bg: #ffffff }»']);
    expect(stilBefunde('a { kaputt; color: var(--pal-seite-link); }')).toEqual([]);
    expect(stilBefunde('a { colorX; }')).toEqual([]);
  });
  it('transparent als Text- oder Linienfarbe ist verboten (color, -webkit-text-fill-color, text-decoration-color, Kurzschreibweise)', () => {
    const T = (z: string) => [`Text- oder Linienfarbe transparent: ${z}`];
    expect(stilBefunde('a { color: transparent; }')).toEqual(T('«a { color: transparent }»'));
    expect(stilBefunde('a { -webkit-text-fill-color: transparent; }')).toEqual(T('«a { -webkit-text-fill-color: transparent }»'));
    expect(stilBefunde('a { text-decoration-color: transparent; }')).toEqual(T('«a { text-decoration-color: transparent }»'));
    expect(stilBefunde('a { text-decoration: underline transparent; }')).toEqual(T('«a { text-decoration: underline transparent }»'));
    expect(stilBefunde('.x { background-color: transparent; border-color: transparent; }')).toEqual([]);
  });
  it('text-decoration ausserhalb .kit-knopf nur mit underline', () => {
    const U = (z: string) => [`Unterstreichung entfernt ausserhalb .kit-knopf: ${z}`];
    expect(stilBefunde('a { text-decoration: line-through; }')).toEqual(U('«a { text-decoration: line-through }»'));
    expect(stilBefunde('a { text-decoration-line: overline; }')).toEqual(U('«a { text-decoration-line: overline }»'));
    expect(stilBefunde('a { text-decoration-line: underline overline; }')).toEqual(U('«a { text-decoration-line: underline overline }»'));
    expect(stilBefunde('a { text-decoration: dotted; }')).toEqual(U('«a { text-decoration: dotted }»'));
    expect(stilBefunde('a { text-decoration-line: none; }')).toEqual(U('«a { text-decoration-line: none }»'));
    expect(stilBefunde('a { text-decoration: underline dotted var(--pal-seite-link); text-decoration-line: underline; }')).toEqual([]);
    expect(stilBefunde('.kit-knopf { text-decoration: none; }')).toEqual([]);
  });
  it('weitere Farbeigenschaften: logische Ränder, Bild, Schatten, Füllfarbe, Spaltenlinie, Betonung, all', () => {
    for (const eig of ['border-block', 'border-block-color', 'border-block-start-color', 'border-block-end', 'border-inline', 'border-inline-color',
      'border-inline-start', 'border-inline-end-color', 'background-image', 'text-shadow', '-webkit-text-fill-color', 'column-rule', 'column-rule-color',
      'text-emphasis', 'text-emphasis-color', 'all']) {
      expect(stilBefunde(`.x { ${eig}: red; }`), eig).toEqual(FARBE(`«.x { ${eig}: red }»`));
    }
    expect(stilBefunde('.x { background-image: linear-gradient(#000, #fff); }')).toHaveLength(1);
    expect(stilBefunde('.x { border-block: 1px solid var(--pal-rahmen); text-shadow: none; background-image: none; all: inherit; }')).toEqual([]);
  });
  it('CSS-Escape im Eigenschaftsnamen ist ein Befund', () => {
    expect(stilBefunde('a { c\\olor: red; }')).toEqual(['Escape im Eigenschaftsnamen: «a { c\\olor: red }»']);
    expect(stilBefunde('a { \\63 olor: red; }')).toEqual(['Escape im Eigenschaftsnamen: «a { \\63 olor: red }»']);
  });
});

async function bau(dateien: Record<string, string>, vorbereiten?: (w: string) => void): Promise<string[]> {
  const w = mkdtempSync(join(tmpdir(), 'kit-stil-'));
  try {
    for (const [p, inhalt] of Object.entries(dateien)) { mkdirSync(dirname(join(w, p)), { recursive: true }); writeFileSync(join(w, p), inhalt); }
    vorbereiten?.(w);
    const meldungen: string[] = [];
    const logger = { error: (m: string) => meldungen.push(m), info: () => {}, warn: () => {} };
    const hook = (paletteLint().hooks as Record<string, (p: object) => Promise<void>>)['astro:config:setup']!;
    await hook({ config: { root: pathToFileURL(`${w}/`) }, logger, command: 'build' }).catch((e: Error) => meldungen.push(`WURF ${e.message}`));
    return meldungen;
  } finally { rmSync(w, { recursive: true, force: true }); }
}

describe('paletteLint prüft jedes CSS unter src/ ausser palette.css (B18)', () => {
  it('sauberes Site-CSS baut, Farbliteral bricht den Build mit Dateiname', async () => {
    expect(await bau({ 'src/styles/palette.css': VORLAGE, 'src/styles/site.css': 'body { margin: 0; }' })).toEqual([]);
    expect(await bau({ 'src/styles/palette.css': VORLAGE, 'src/styles/site.css': 'a { color: #ff0000; }', 'src/komponenten/x.css': '.y { gap: 1rem; }' })).toEqual([
      'src/styles/site.css: Farbe nicht aus der Palette: «a { color: #ff0000 }»', 'WURF palette-lint: 1 Stil-Problem(e) unter src/']);
  });
});

describe('paletteLint — Symlinks, @import und <style> in .astro (Abschluss-Review)', () => {
  const P = { 'src/styles/palette.css': VORLAGE };
  it('Symlink auf .css unter src/ ist ein Befund statt still übersprungen', async () => {
    const m = await bau({ ...P, 'aussen/rot.css': 'a { color: #ff0000; }' }, (w) => symlinkSync(join(w, 'aussen/rot.css'), join(w, 'src/styles/rot.css')));
    expect(m).toEqual(['src/styles/rot.css: Symlink wird nicht verfolgt', 'WURF palette-lint: 1 Stil-Problem(e) unter src/']);
  });
  it('Symlink auf ein Verzeichnis unter src/ ist ein Befund', async () => {
    const m = await bau({ ...P, 'aussen/rot.css': 'a { color: #ff0000; }' }, (w) => symlinkSync(join(w, 'aussen'), join(w, 'src/fremd')));
    expect(m).toEqual(['src/fremd: Symlink wird nicht verfolgt', 'WURF palette-lint: 1 Stil-Problem(e) unter src/']);
  });
  it('@import mit Ziel ausserhalb src/ ist ein Befund; innerhalb src/ und das Kit-CSS sind erlaubt', async () => {
    const m = await bau({ ...P, 'public/rot.css': 'a { color: #ff0000; }', 'src/styles/teil.css': '.y { gap: 1rem; }',
      'src/styles/site.css': [
        '@import "./teil.css";', "@import url('../styles/teil.css') layer(x);", '@import "@bondwerk/site-kit/stile/kit.css";',
        '@import "../../public/rot.css";', '@import url(/rot.css);', '@import "https://example.ch/x.css";', '@import "fremdes-paket/x.css";',
      ].join('\n') });
    expect(m).toEqual([
      'src/styles/site.css: @import ausserhalb src/: «../../public/rot.css»',
      'src/styles/site.css: @import ausserhalb src/: «/rot.css»',
      'src/styles/site.css: @import ausserhalb src/: «https://example.ch/x.css»',
      'src/styles/site.css: @import ausserhalb src/: «fremdes-paket/x.css»',
      'WURF palette-lint: 4 Stil-Problem(e) unter src/']);
  });
  it('<style>-Blöcke in src/**/*.astro werden mit dem Stil-Lint geprüft (auch is:global, auch @import)', async () => {
    const m = await bau({ ...P,
      'src/pages/index.astro': '---\nconst x = 1;\n---\n<p class="a">x</p>\n<style>\n.a { color: var(--pal-seite-text); }\n</style>\n<style is:global>\na { color: #ff0000; }\n</style>',
      'src/komponenten/K.astro': '<style lang="css" is:inline>@import "../../aussen.css"; .k { text-decoration: none; }</style>',
      'src/komponenten/Sauber.astro': '<div>ohne Stil</div>' });
    expect(m).toEqual([
      'src/komponenten/K.astro: @import ausserhalb src/: «../../aussen.css»',
      'src/komponenten/K.astro: Unterstreichung entfernt ausserhalb .kit-knopf: «.k { text-decoration: none }»',
      'src/pages/index.astro: Farbe nicht aus der Palette: «a { color: #ff0000 }»',
      'WURF palette-lint: 3 Stil-Problem(e) unter src/']);
  });
});
