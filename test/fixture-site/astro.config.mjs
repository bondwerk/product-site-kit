// Fixture für Nullwert- und Wirkungs-Test (Spec #435 §11.1). Lädt das Kit aus KIT_WURZEL/dist; der CSS-/HTML-Vergleich
// über Versionen (S5) kann dieselbe Fixture mit einem anderen KIT_WURZEL bauen.
import { defineConfig } from 'astro/config';

const kit = process.env.KIT_WURZEL;
if (!kit) throw new Error('KIT_WURZEL fehlt');
export default defineConfig({
  build: { inlineStylesheets: 'never' },
  vite: {
    build: { assetsInlineLimit: 0 },
    resolve: { alias: [
      { find: /^@bondwerk\/site-kit\/(komponenten|stile)\/(.*)$/, replacement: `${kit}/dist/$1/$2` },
      { find: /^@bondwerk\/site-kit\/schema$/, replacement: `${kit}/dist/schema/index.js` },
    ] },
  },
});
