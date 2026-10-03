// Spec #435 §7.1/§7.2/§7.4, Plan B1/B2/B15/B18: kit.css besteht den Stil-Lint, nutzt jedes Token, unterstreicht Fliesstext-Links,
// jede Stufe hat eine Regel, Normalwerte keine, Titelgrössen relativ und geordnet, keine eigenen Custom Properties.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PFLICHT_TOKENS, OPTIONALE_TOKENS, FALLBACK } from '../src/lints/palette.js';
import { stilBefunde } from '../src/lints/stil.js';
import { stufen, normalwerte } from '../src/schema/gestaltung.js';

const ROH = readFileSync(new URL('../src/stile/kit.css', import.meta.url), 'utf8');
const CSS = ROH.replace(/\/\*[\s\S]*?\*\//g, '');
const regeln = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selektor: m[1]!.trim(), deklarationen: m[2]!.split(';').map((d) => d.trim()).filter(Boolean) }));

describe('kit.css', () => {
  it('besteht den Stil-Lint; keine eigenen Custom Properties', () => {
    expect(stilBefunde(ROH)).toEqual([]);
    for (const r of regeln) for (const d of r.deklarationen) expect(d.trim().startsWith('--'), `${r.selektor}: ${d}`).toBe(false);
  });
  it('jedes Token wird genutzt, nur bekannte Tokens, optionale nur mit ihrem Fallback', () => {
    const genutzt = new Set([...CSS.matchAll(/var\(--pal-([a-z-]+)/g)].map((m) => m[1]!));
    expect([...genutzt].sort()).toEqual([...PFLICHT_TOKENS, ...OPTIONALE_TOKENS].sort());
    for (const opt of OPTIONALE_TOKENS) {
      const vorkommen = [...CSS.matchAll(new RegExp(`var\\(--pal-${opt}(,[^)]*\\))?\\)`, 'g'))].map((m) => m[0]);
      for (const v of vorkommen) expect(v, opt).toBe(`var(--pal-${opt}, var(--pal-${FALLBACK[opt]}))`);
    }
  });
  it('Fliesstext-Links unterstrichen (B2)', () => {
    expect(regeln.some((r) => r.selektor.includes('.kit-fliesstext a') && r.selektor.includes('.kit-abschnitt a:not(.kit-knopf)')
      && r.deklarationen.includes('text-decoration-line: underline'))).toBe(true);
  });
  it('jede Nicht-Normalstufe hat einen Selektor, Normalwerte keinen', () => {
    for (const [feld, werte] of Object.entries(stufen)) for (const w of werte) {
      const sel = `[data-${feld}="${w}"]`;
      const normal = feld === 'bildposition' ? false : (normalwerte as Record<string, unknown>)[feld] === w;
      expect(CSS.includes(sel), `${sel}`).toBe(!normal);
    }
  });
  it('Titelgrössen relativ in em, je Ebene klein < normal < gross (B15)', () => {
    /** Standardgrössen nach HTML Living Standard, Rendering „Sections and headings": h2 1.5em, h3 1.17em. */
    const NORMAL = { 2: 1.5, 3: 1.17 } as const;
    for (const e of [2, 3] as const) {
      const wert = (stufe: 'klein' | 'gross') => {
        const m = new RegExp(`\\[data-titelgroesse="${stufe}"\\] h${e}\\.kit-abschnitt__titel \\{ font-size: var\\(--kit-titel-${stufe}-${e}, ([\\d.]+)em\\); \\}`).exec(CSS);
        expect(m, `h${e} ${stufe}`).not.toBeNull();
        return Number(m![1]);
      };
      expect(wert('klein'), `h${e} klein`).toBeLessThan(NORMAL[e]);
      expect(NORMAL[e], `h${e} gross`).toBeLessThan(wert('gross'));
    }
    expect(CSS).not.toMatch(/--kit-titel-[a-z0-9-]+,\s*[\d.]+rem/);
  });
});
