import type { AstroIntegration } from 'astro';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paletteBefunde } from '../lints/palette.js';
import { stilBefunde } from '../lints/stil.js';

/** Alle .css unter dir, sortiert; Symlinks werden nicht verfolgt. */
function cssDateien(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((n) => {
    const p = join(dir, n);
    const s = lstatSync(p);
    if (s.isDirectory()) return cssDateien(p);
    return s.isFile() && n.endsWith('.css') ? [p] : [];
  });
}

/**
 * Astro-Integration (Spec #435 §7.2, Plan B18): Palette-Format und WCAG-Kontrast, dazu der Stil-Lint über jedes CSS
 * unter src/ ausser der Palette. Build bricht, Dev meldet. Ohne Palette-Datei: Abbruch.
 */
export function paletteLint(opt: { datei?: string } = {}): AstroIntegration {
  const datei = opt.datei ?? 'src/styles/palette.css';
  return {
    name: 'bondwerk-palette-lint',
    hooks: {
      'astro:config:setup': async ({ config, logger, command }) => {
        const wurzel = fileURLToPath(config.root);
        const pfad = join(wurzel, datei);
        if (!existsSync(pfad)) throw new Error(`palette-lint: ${datei} fehlt`);
        const palette = paletteBefunde(readFileSync(pfad, 'utf8'));
        const stil = cssDateien(join(wurzel, 'src')).filter((p) => p !== pfad)
          .flatMap((p) => stilBefunde(readFileSync(p, 'utf8')).map((b) => `${relative(wurzel, p)}: ${b}`));
        [...palette, ...stil].forEach((b) => logger.error(b));
        if (command !== 'build') return;
        if (palette.length) throw new Error(`palette-lint: ${palette.length} Problem(e) in ${datei}`);
        if (stil.length) throw new Error(`palette-lint: ${stil.length} Stil-Problem(e) in src/**/*.css`);
      },
    },
  };
}
