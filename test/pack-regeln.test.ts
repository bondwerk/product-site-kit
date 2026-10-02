// Spec #435 §9.2, §11.4: reine Prüffunktionen der Pack-Prüfung (Seam: scripts/pack-regeln.mjs).
import { describe, expect, it } from 'vitest';
import { pfadBefunde, lebenszyklusBefunde, tarTypBefunde } from '../scripts/pack-regeln.mjs';

describe('Pack-Regeln (Spec #435 §9.2, §11.4)', () => {
  it('Pfad-Allowlist: nur package.json, README.md, LICENSE und gebautes JS/d.ts unter dist/', () => {
    expect(pfadBefunde(['package.json', 'README.md', 'LICENSE', 'dist/schema/index.js', 'dist/schema/index.d.ts'])).toEqual([]);
    expect(pfadBefunde(['src/schema/index.ts', 'dist/schema/index.js.map', 'test/a.test.ts', '.npmrc'])).toEqual([
      'nicht erlaubt: src/schema/index.ts', 'nicht erlaubt: dist/schema/index.js.map', 'nicht erlaubt: test/a.test.ts', 'nicht erlaubt: .npmrc',
    ]);
  });
  it('kein Lebenszyklus-Skript im gepackten package.json', () => {
    expect(lebenszyklusBefunde({ scripts: { build: 'tsc', test: 'vitest run' } })).toEqual([]);
    expect(lebenszyklusBefunde({ scripts: { postinstall: 'x', prepare: 'y' } })).toEqual(['Lebenszyklus-Skript: postinstall', 'Lebenszyklus-Skript: prepare']);
  });
  it('nur reguläre Dateien im Tarball', () => {
    const listing = '-rw-r--r-- 0/0 10 1985-10-26 08:15 package/dist/a.js\nlrwxrwxrwx 0/0 0 1985-10-26 08:15 package/dist/b.js -> /etc/passwd\n';
    expect(tarTypBefunde(listing)).toEqual(['keine reguläre Datei: lrwxrwxrwx 0/0 0 1985-10-26 08:15 package/dist/b.js -> /etc/passwd']);
  });
});
