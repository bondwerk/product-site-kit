// Content- und Nur-Collections-Lint als Astro-Integrationen (Spec #435 §5.1): getestet über den Hook
// astro:config:setup aus @bondwerk/site-kit/integrationen, mit Stub-config und Stub-logger.
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentLint, nurCollectionsLint } from '../src/integrationen/index.js';

const aufraeumen: string[] = [];
afterEach(() => { for (const d of aufraeumen.splice(0)) rmSync(d, { recursive: true, force: true }); });

function site(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), 'kit-lint-'));
  aufraeumen.push(wurzel);
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    mkdirSync(join(wurzel, pfad, '..'), { recursive: true });
    writeFileSync(join(wurzel, pfad), inhalt);
  }
  return wurzel;
}

async function baue(integration: { hooks: object }, wurzel: string): Promise<string[]> {
  const fehler: string[] = [];
  const logger = { error: (m: string) => fehler.push(m), info: () => {}, warn: () => {} };
  const hook = (integration.hooks as Record<string, unknown>)['astro:config:setup'] as (p: object) => Promise<void>;
  await hook({ config: { root: pathToFileURL(`${wurzel}/`) }, logger, command: 'build' }).catch((e: Error) => fehler.push(`WURF ${e.message}`));
  return fehler;
}

describe('contentLint', () => {
  it('meldet URL im Markdown, __proto__ und kaputtes JSON; Kontakt-Datei ist vom Text-Lint ausgenommen; eigene Adressen sind erlaubt; Build bricht', async () => {
    const wurzel = site({
      'content/de/seiten/a.md': '---\ntitel: A\n---\nMehr auf https://fremd.example.ch',
      'content/de/seiten/b.md': '---\ntitel: B\n---\nMehr auf www.example.ch oder info@example.ch',
      'content/de/x.json': '{"__proto__": {"a": 1}}',
      'content/de/kaputt.json': '{',
      'content/de/kontakt.json': '{"kontakt": {"email": "hallo@gruenwerk.example.ch"}}',
    });
    const fehler = await baue(contentLint({ eigeneAdressen: ['example.ch'], kontaktDateien: ['content/de/kontakt.json'] }), wurzel);
    expect(fehler.filter((f) => f.startsWith('content/de/seiten/a.md:'))).toHaveLength(1);
    expect(fehler.filter((f) => f.startsWith('content/de/seiten/b.md'))).toEqual([]);
    expect(fehler.filter((f) => f.startsWith('content/de/x.json:') && f.includes('__proto__'))).toHaveLength(1);
    expect(fehler.filter((f) => f.startsWith('content/de/kaputt.json: ungültiges JSON'))).toHaveLength(1);
    expect(fehler.filter((f) => f.startsWith('content/de/kontakt.json'))).toEqual([]);
    expect(fehler.at(-1)).toBe('WURF content-lint: 3 Problem(e) im Content');
  });
});

describe('nurCollectionsLint', () => {
  it('bricht den Build, wenn src/ ein Datenmodul importiert', async () => {
    const wurzel = site({ 'src/pages/index.astro': "---\nimport { x } from '../i18n/content.ts';\n---\n<p>x</p>" });
    const fehler = await baue(nurCollectionsLint(), wurzel);
    expect(fehler[0]).toMatch(/^src\/pages\/index\.astro:2: verbotener Content-Import «\.\.\/i18n\/content\.ts»/);
    expect(fehler.at(-1)).toBe('WURF nur-collections-lint: 1 Problem(e)');
  });
});
