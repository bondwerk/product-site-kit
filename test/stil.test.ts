// Spec #435 §7.1/§7.2, Plan B2/B18: in jedem CSS ausser palette.css Farben nur aus var(--pal-*), keine Palette-Tokens,
// Unterstreichung nur am Knopf aus.
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

async function bau(dateien: Record<string, string>): Promise<string[]> {
  const w = mkdtempSync(join(tmpdir(), 'kit-stil-'));
  try {
    for (const [p, inhalt] of Object.entries(dateien)) { mkdirSync(dirname(join(w, p)), { recursive: true }); writeFileSync(join(w, p), inhalt); }
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
      'src/styles/site.css: Farbe nicht aus der Palette: «a { color: #ff0000 }»', 'WURF palette-lint: 1 Stil-Problem(e) in src/**/*.css']);
  });
});
