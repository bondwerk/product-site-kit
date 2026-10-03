import type { AstroIntegration } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { paletteBefunde } from '../lints/palette.js';

/** Astro-Integration (Spec #435 §7.2): Palette-Format und WCAG-Kontrast; Build bricht, Dev meldet. Ohne Datei: Abbruch. */
export function paletteLint(opt: { datei?: string } = {}): AstroIntegration {
  const datei = opt.datei ?? 'src/styles/palette.css';
  return {
    name: 'bondwerk-palette-lint',
    hooks: {
      'astro:config:setup': async ({ config, logger, command }) => {
        const pfad = fileURLToPath(new URL(datei, config.root));
        if (!existsSync(pfad)) throw new Error(`palette-lint: ${datei} fehlt`);
        const befunde = paletteBefunde(readFileSync(pfad, 'utf8'));
        if (!befunde.length) return;
        befunde.forEach((b) => logger.error(b));
        if (command === 'build') throw new Error(`palette-lint: ${befunde.length} Problem(e) in ${datei}`);
      },
    },
  };
}
