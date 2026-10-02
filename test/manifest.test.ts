// Spec #435 §4.1, §4.2, §9.2 und Plan A1/A6: das Manifest ist die Grenze des öffentlichen Pakets.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Record<string, any>;
const LEBENSZYKLUS = ['preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare',
  'prepublishOnly', 'prepack', 'postpack', 'publish', 'postpublish'];
const SUBPATHS = ['integrationen', 'json-schema', 'lints', 'schema', 'test'];

describe('package.json des Kits', () => {
  it('Name, Repo, Exporte, files, peers und keine Lebenszyklus-Skripte', () => {
    expect(pkg.name).toBe('@bondwerk/site-kit');
    expect(pkg.repository).toEqual({ type: 'git', url: 'git+https://github.com/bondwerk/product-site-kit.git' });
    expect(Object.keys(pkg.exports).sort()).toEqual([...SUBPATHS.map((s) => `./${s}`), './package.json'].sort());
    for (const s of SUBPATHS) {
      expect(pkg.exports[`./${s}`], s).toEqual({ types: `./dist/${s}/index.d.ts`, default: `./dist/${s}/index.js` });
    }
    expect(pkg.files).toEqual(['dist/**/*.js', 'dist/**/*.d.ts', 'README.md', 'LICENSE']);
    expect(pkg.peerDependencies).toEqual({ astro: '^7.0.6', zod: '^4.3.6', 'rehype-sanitize': '^6.0.0' });
    expect(pkg.dependencies ?? {}).toEqual({});
    expect(Object.keys(pkg.scripts ?? {}).filter((s) => LEBENSZYKLUS.includes(s))).toEqual([]);
  });
});
