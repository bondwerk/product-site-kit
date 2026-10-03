import type { AstroIntegration } from 'astro';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paletteBefunde } from '../lints/palette.js';
import { stilBefunde } from '../lints/stil.js';

/** Einziges erlaubtes @import-Ziel ausserhalb src/: das Kit-CSS, das der Stil-Lint im Kit selbst prüft. */
const KIT_CSS = '@bondwerk/site-kit/stile/kit.css';

type Fund = { datei: string } | { symlink: string };

/** Alle .css und .astro unter dir, sortiert. Symlinks werden nicht verfolgt, sondern gemeldet. */
function quellen(dir: string): Fund[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((n): Fund[] => {
    const p = join(dir, n);
    const s = lstatSync(p);
    if (s.isSymbolicLink()) return [{ symlink: p }];
    if (s.isDirectory()) return quellen(p);
    return s.isFile() && /\.(css|astro)$/.test(n) ? [{ datei: p }] : [];
  });
}

/** CSS einer Datei: bei .astro der Inhalt aller <style …>-Blöcke. */
function cssAus(pfad: string): string {
  const text = readFileSync(pfad, 'utf8');
  if (!pfad.endsWith('.astro')) return text;
  return [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]!).join('\n');
}

/** @import-Ziele, die nicht unter src/ liegen (relativ zur Datei aufgelöst; Wurzelpfade, URLs und Pakete zählen als aussen). */
function importBefunde(css: string, pfad: string, src: string): string[] {
  const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...ohneKommentar.matchAll(/@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1/gi)].flatMap((m) => {
    const ziel = m[2]!;
    if (ziel === KIT_CSS) return [];
    const relativ = ziel.startsWith('./') || ziel.startsWith('../');
    const aufgeloest = relativ ? relative(src, resolve(dirname(pfad), ziel.replace(/[?#].*$/, ''))) : '..';
    return aufgeloest.startsWith('..') || isAbsolute(aufgeloest) ? [`@import ausserhalb src/: «${ziel}»`] : [];
  });
}

/**
 * Astro-Integration (Spec #435 §7.2, Plan B18): Palette-Format und WCAG-Kontrast, dazu der Stil-Lint über jedes CSS
 * unter src/ ausser der Palette und über die <style>-Blöcke aller .astro-Dateien unter src/. Symlinks unter src/ und
 * @import mit Ziel ausserhalb src/ sind Befunde. Build bricht, Dev meldet. Ohne Palette-Datei: Abbruch.
 */
export function paletteLint(opt: { datei?: string } = {}): AstroIntegration {
  const datei = opt.datei ?? 'src/styles/palette.css';
  return {
    name: 'bondwerk-palette-lint',
    hooks: {
      'astro:config:setup': async ({ config, logger, command }) => {
        const wurzel = fileURLToPath(config.root);
        const pfad = join(wurzel, datei);
        const src = join(wurzel, 'src');
        if (!existsSync(pfad)) throw new Error(`palette-lint: ${datei} fehlt`);
        const palette = paletteBefunde(readFileSync(pfad, 'utf8'));
        const stil = quellen(src).flatMap((f) => {
          if ('symlink' in f) return [`${relative(wurzel, f.symlink)}: Symlink wird nicht verfolgt`];
          const css = cssAus(f.datei);
          const befunde = [...importBefunde(css, f.datei, src), ...(f.datei === pfad ? [] : stilBefunde(css))];
          return befunde.map((b) => `${relative(wurzel, f.datei)}: ${b}`);
        });
        [...palette, ...stil].forEach((b) => logger.error(b));
        if (command !== 'build') return;
        if (palette.length) throw new Error(`palette-lint: ${palette.length} Problem(e) in ${datei}`);
        if (stil.length) throw new Error(`palette-lint: ${stil.length} Stil-Problem(e) unter src/`);
      },
    },
  };
}
