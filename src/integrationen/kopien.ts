import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { spiegleOrdner } from './spiegel.js';

const BILD_ENDUNGEN = ['webp', 'png', 'jpg', 'jpeg', 'avif'] as const;

/** content/bilder → public/bilder als echte Dateien, bei Dev-Start und Build. */
export function bilderCopy(): AstroIntegration {
  return {
    name: 'bondwerk-bilder-copy',
    hooks: {
      'astro:config:setup': async ({ config, logger }) => {
        const ergebnis = await spiegleOrdner(
          fileURLToPath(new URL('content/bilder', config.root)),
          fileURLToPath(new URL('public/bilder', config.root)),
          {
            name: 'bilder-copy',
            anzeige: 'content/bilder',
            endungen: BILD_ENDUNGEN,
            begruendung: 'Ein SVG kann Skripte tragen und liefe beim direkten Aufruf an der Sanitize-Pipeline vorbei; Logos vorher nach PNG wandeln.',
          },
        );
        if (!ergebnis) return;
        for (const datei of ergebnis.uebersprungen) logger.warn(`bilder-copy: ${datei} übersprungen (Systemdatei)`);
        logger.info(`bilder-copy: ${ergebnis.kopiert} Datei(en) content/bilder → public/bilder`);
      },
    },
  };
}
