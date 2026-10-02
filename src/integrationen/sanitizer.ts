import { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';

// Typ ausdrücklich: die abgeleitete Form verwiese in der .d.ts auf das transitive hast-util-sanitize.
/** Protokoll-Allowlist für Markdown-Links und -Bilder; javascript:/data:/irc/xmpp bleiben draussen. */
export const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: ['http', 'https', 'mailto', 'tel'], src: ['http', 'https'] },
};

interface HastKnoten { type: string; tagName?: string; properties?: Record<string, unknown>; children?: HastKnoten[] }

/**
 * rehype-Plugin: externe Links (http/https) öffnen im neuen Tab mit rel="noopener noreferrer".
 *
 * Reihenfolge: NACH `rehype-sanitize` einhängen, also
 * `rehypePlugins: [[rehypeSanitize, sanitizeSchema], rehypeExterneLinks]`. Das `defaultSchema` von
 * rehype-sanitize entfernt `target` und `rel`; läuft dieses Plugin davor, fehlen beide Attribute im
 * Ergebnis still.
 */
export function rehypeExterneLinks() {
  return (baum: HastKnoten): void => {
    const gehe = (k: HastKnoten): void => {
      if (k.type === 'element' && k.tagName === 'a') {
        const href = k.properties?.href;
        if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
          k.properties = { ...k.properties, target: '_blank', rel: ['noopener', 'noreferrer'] };
        }
      }
      for (const kind of k.children ?? []) gehe(kind);
    };
    gehe(baum);
  };
}
