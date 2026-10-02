// Testhelfer für Inline-Code und Symlinks (Spec #435 §5.1 „csp-inline", „keine-symlinks");
// getestet am Subpath @bondwerk/site-kit/test.
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inlineBefunde, symlinkEintraege } from '../src/test/index.js';

const aufraeumen: string[] = [];
afterEach(() => { for (const d of aufraeumen.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('inlineBefunde', () => {
  it('erkennt Inline-Script, Handler, <style> und style=; externe Scripts, JSON-LD und escapter Text sind sauber', () => {
    expect(inlineBefunde('<script>alert(1)</script>')).toEqual(['script']);
    expect(inlineBefunde('<script type="module" src="/_astro/a.js"></script>')).toEqual([]);
    expect(inlineBefunde('<script type="application/ld+json">{}</script>')).toEqual([]);
    expect(inlineBefunde('<button onclick="x()">x</button>')).toEqual(['handler']);
    expect(inlineBefunde('<style>a{color:red}</style>')).toEqual(['style-block']);
    expect(inlineBefunde('<p style="color:red">x</p>')).toEqual(['style-attr']);
    expect(inlineBefunde('<p>&lt;img src=x onerror=alert(1)&gt;</p>')).toEqual([]);
  });
});

describe('inlineBefunde — src/type nur als echte Attribute', () => {
  it('data-src macht ein Inline-Script nicht zum externen Script', () => {
    expect(inlineBefunde('<script data-src="x">alert(1)</script>')).toEqual(['script']);
    expect(inlineBefunde('<script\nsrc="/_astro/a.js"></script>')).toEqual([]);
  });
  it('data-type="application/ld+json" macht ein Inline-Script nicht zu JSON-LD', () => {
    expect(inlineBefunde('<script data-type="application/ld+json">alert(1)</script>')).toEqual(['script']);
    expect(inlineBefunde('<script\ttype="application/ld+json">{}</script>')).toEqual([]);
  });
});

describe('symlinkEintraege', () => {
  it('liefert Pfade mit Git-Modus 120000 aus dem Index', () => {
    const repo = mkdtempSync(join(tmpdir(), 'kit-symlink-'));
    aufraeumen.push(repo);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: repo });
    writeFileSync(join(repo, 'AGENTS.md'), 'x');
    symlinkSync('AGENTS.md', join(repo, 'CLAUDE.md'));
    execFileSync('git', ['add', '-A'], { cwd: repo });
    expect(symlinkEintraege(repo)).toEqual(['CLAUDE.md']);
  });
});
