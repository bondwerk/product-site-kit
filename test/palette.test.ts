// Spec #435 §7.1/§7.2, Plan B1: genau ein :root mit --pal-*: #rrggbb; Pflicht 14 Tokens, Knopf-Tokens je Fläche optional.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { paletteBefunde } from '../src/lints/index.js';
import { paletteLint } from '../src/integrationen/index.js';

const VORLAGE = readFileSync(new URL('../src/stile/palette.vorlage.css', import.meta.url), 'utf8');
const mit = (css: string, token: string, wert: string) => css.replace(new RegExp(`(--pal-${token}:\\s*)#[0-9a-fA-F]{6}`), `$1${wert}`);

describe('paletteBefunde — Format (§7.2)', () => {
  it('die Vorlage besteht', () => expect(paletteBefunde(VORLAGE)).toEqual([]));
  it('zusätzliche Regel, var(), Funktion, unbekanntes Token, fehlendes und doppeltes Pflicht-Token', () => {
    expect(paletteBefunde(`${VORLAGE}\nbody { color: red; }`)).toEqual(['palette.css: genau ein :root-Block und sonst nichts']);
    expect(paletteBefunde(VORLAGE.replace('--pal-rahmen: #6b7280;', '--pal-rahmen: var(--pal-seite-text);'))).toEqual(['palette.css: unerlaubte Deklaration «--pal-rahmen: var(--pal-seite-text)»']);
    expect(paletteBefunde(VORLAGE.replace('--pal-rahmen: #6b7280;', '--pal-rahmen: rgb(1, 2, 3);'))).toEqual(['palette.css: unerlaubte Deklaration «--pal-rahmen: rgb(1, 2, 3)»']);
    expect(paletteBefunde(VORLAGE.replace('--pal-rahmen: #6b7280;', '--pal-rahmen: #6b7280;\n  --pal-pink-bg: #ff00ff;'))).toEqual(['palette.css: unbekanntes Token --pal-pink-bg']);
    expect(paletteBefunde(VORLAGE.replace('  --pal-rahmen: #6b7280;\n', ''))).toEqual(['palette.css: Pflicht-Token fehlt --pal-rahmen']);
    expect(paletteBefunde(VORLAGE.replace('--pal-rahmen: #6b7280;', '--pal-rahmen: #6b7280;\n  --pal-rahmen: #6b7280;'))).toEqual(['palette.css: Token doppelt --pal-rahmen']);
  });
});

describe('paletteBefunde — Kontrast (§7.3, B1)', () => {
  it('Verstoss nennt Paar, Verhältnis, Mindestwert', () => {
    expect(paletteBefunde(mit(VORLAGE, 'akzent-link', '#0b5cad'))).toEqual(['akzent-link auf akzent-bg: 1.00:1, verlangt 4.5:1']);
  });
  it('Befund K6: mittlere Akzentfarbe mit dunkler Fläche ist lösbar (Fallback je Fläche)', () => {
    let p = mit(VORLAGE, 'akzent-bg', '#e67e22');
    p = mit(p, 'akzent-text', '#000000');
    p = mit(p, 'akzent-link', '#000000');
    expect(paletteBefunde(p)).toEqual([]);
  });
  it('gesetztes Knopf-Token wird geprüft statt des Fallbacks', () => {
    const p = VORLAGE.replace('  --pal-rahmen: #6b7280;\n', '  --pal-rahmen: #6b7280;\n  --pal-akzent-knopf-bg: #0b5cae;\n  --pal-akzent-knopf-text: #ffffff;\n');
    expect(paletteBefunde(p)).toEqual([expect.stringMatching(/^akzent-knopf-bg auf akzent-bg: 1\.0\d:1, verlangt 3:1$/)]);
  });
});

async function lauf(css: string | null, command: 'build' | 'dev'): Promise<string[]> {
  const w = mkdtempSync(join(tmpdir(), 'kit-palette-'));
  try {
    if (css !== null) { mkdirSync(join(w, 'src/styles'), { recursive: true }); writeFileSync(join(w, 'src/styles/palette.css'), css); }
    const meldungen: string[] = [];
    const logger = { error: (m: string) => meldungen.push(m), info: () => {}, warn: () => {} };
    const hook = (paletteLint().hooks as Record<string, (p: object) => Promise<void>>)['astro:config:setup']!;
    await hook({ config: { root: pathToFileURL(`${w}/`) }, logger, command }).catch((e: Error) => meldungen.push(`WURF ${e.message}`));
    return meldungen;
  } finally { rmSync(w, { recursive: true, force: true }); }
}

describe('paletteLint (Astro-Integration)', () => {
  it('Build bricht bei Verstoss, Dev meldet nur; fehlende Datei bricht immer', async () => {
    expect(await lauf(VORLAGE, 'build')).toEqual([]);
    expect(await lauf(mit(VORLAGE, 'akzent-link', '#0b5cad'), 'build')).toEqual(['akzent-link auf akzent-bg: 1.00:1, verlangt 4.5:1', 'WURF palette-lint: 1 Problem(e) in src/styles/palette.css']);
    expect(await lauf(mit(VORLAGE, 'akzent-link', '#0b5cad'), 'dev')).toEqual(['akzent-link auf akzent-bg: 1.00:1, verlangt 4.5:1']);
    expect(await lauf(null, 'dev')).toEqual(['WURF palette-lint: src/styles/palette.css fehlt']);
  });
});
