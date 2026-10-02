// Spec #435 §11.4, F8; Council P1. Alle Testdaten sind synthetisch; die echte Liste kommt nie in einen Test.
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leseListe, funde, anzeige } from '../scripts/identifikator-regeln.mjs';

const SKRIPT = fileURLToPath(new URL('../scripts/identifikator-scan.mjs', import.meta.url));
const aufraeumen: string[] = [];
afterEach(() => { for (const d of aufraeumen.splice(0)) rmSync(d, { recursive: true, force: true }); });
const tmp = (praefix: string): string => { const d = mkdtempSync(join(tmpdir(), praefix)); aufraeumen.push(d); return d; };
const lauf = (args: string[], liste: string, cwd?: string) =>
  spawnSync('node', [SKRIPT, ...args], { cwd, encoding: 'utf8', env: { ...process.env, SITE_KIT_IDENTIFIKATOREN: liste } });

describe('Identifikator-Regeln', () => {
  it('liest die Liste zeilenweise, ohne Leerzeilen und Kommentare', () => {
    expect(leseListe('beispiel-verein\n\n # Kommentar\n  Muster AG  \n')).toEqual(['beispiel-verein', 'Muster AG']);
    expect(leseListe(undefined)).toEqual([]);
  });
  it('findet Einträge in Inhalt und Pfad, ohne Gross-/Kleinschreibung', () => {
    const dateien = [
      { pfad: 'package/dist/a.js', inhalt: 'const x = "Beispiel-Verein";' },
      { pfad: 'package/dist/muster-ag.js', inhalt: 'export {}' },
      { pfad: 'package/dist/c.js', inhalt: 'nichts' },
    ];
    expect(funde(dateien, ['beispiel-verein', 'muster-ag'])).toEqual([
      { pfad: 'package/dist/a.js', eintrag: 1 },
      { pfad: 'package/dist/muster-ag.js', eintrag: 2 },
    ]);
  });
  it('Einträge unter vier Zeichen treffen nur an Wortgrenzen', () => {
    const dateien = [
      { pfad: 'a.js', inhalt: 'die abkürzung xyz steht allein.' },
      { pfad: 'b.js', inhalt: 'xyzabc und abcxyz' },
      { pfad: 'c.js', inhalt: 'Verein-xyz' },
    ];
    expect(funde(dateien, ['xyz'])).toEqual([{ pfad: 'a.js', eintrag: 1 }, { pfad: 'c.js', eintrag: 1 }]);
  });
  it('Integrity-Werte (SRI, wie in package-lock.json) erzeugen keinen Fehlalarm, ein falsch langer Wert schon', () => {
    // Synthetisch: Base64 trennt mit „+" und „/", ein kurzer Eintrag stünde dort an Wortgrenzen.
    const sha512 = `sha512-${'Qw+xyz/'.padEnd(86, 'A')}==`;
    const sha1 = `sha1-${'Zz9Muster'.padEnd(27, 'B')}=`;
    const lock = `{\n  "integrity": "${sha512}",\n  "integrity": "${sha1}"\n}\n`;
    expect(funde([{ pfad: 'package-lock.json', inhalt: lock }], ['xyz', 'muster'])).toEqual([]);
    const getarnt = '{ "integrity": "sha512-Qw+xyz/muster==" }';
    expect(funde([{ pfad: 'package-lock.json', inhalt: getarnt }], ['xyz', 'muster'])).toEqual([
      { pfad: 'package-lock.json', eintrag: 1 }, { pfad: 'package-lock.json', eintrag: 2 },
    ]);
  });
  it('Anzeige: ein Pfad, der selbst einen Eintrag enthält, erscheint nur als Nummer', () => {
    expect(anzeige('package/dist/a.js', 3, ['muster-ag'])).toBe('package/dist/a.js');
    expect(anzeige('package/dist/muster-ag.js', 3, ['muster-ag'])).toBe('Datei #3');
  });
});

describe('identifikator-scan.mjs <tarball>', () => {
  function tarball(dateien: Record<string, string>): string {
    const d = tmp('kit-scan-test-');
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      mkdirSync(dirname(join(d, 'package', pfad)), { recursive: true });
      writeFileSync(join(d, 'package', pfad), inhalt);
    }
    execFileSync('tar', ['-czf', join(d, 'p.tgz'), '-C', d, 'package']);
    return join(d, 'p.tgz');
  }

  it('ohne Liste: Exit 2', () => { expect(lauf([tarball({ 'dist/a.js': 'x' })], '').status).toBe(2); });
  it('Treffer im Inhalt: Exit 1, Meldung nennt Pfad und Listennummer, nicht das Wort', () => {
    const r = lauf([tarball({ 'dist/a.js': 'const x = "beispiel-verein";' })], 'beispiel-verein');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Treffer: package/dist/a.js (Listeneintrag #1)');
    expect(r.stderr.toLowerCase()).not.toContain('beispiel-verein');
  });
  it('Treffer im Dateinamen: Exit 1, Meldung nennt nur die Nummer', () => {
    const r = lauf([tarball({ 'dist/beispiel-verein.js': 'export {}' })], 'beispiel-verein');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Treffer: Datei #\d+ \(Listeneintrag #1\)/);
    expect(r.stderr.toLowerCase()).not.toContain('beispiel-verein');
  });
  it('kein Treffer: Exit 0', () => { expect(lauf([tarball({ 'dist/a.js': 'export {}' })], 'beispiel-verein').status).toBe(0); });
});

describe('identifikator-scan.mjs --repo', () => {
  const g = (cwd: string, ...a: string[]): string =>
    execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' }).trim();
  /** Repo, dessen ERSTER Commit einen Treffer trägt, der im zweiten gelöscht ist: `git ls-files` ist sauber. */
  function repoMitHistorie(): { repo: string; sha: string } {
    const repo = tmp('kit-scan-repo-');
    g(repo, 'init', '-q', '-b', 'main');
    writeFileSync(join(repo, 'a.txt'), 'gruss an beispiel-verein\n');
    g(repo, 'add', 'a.txt');
    g(repo, 'commit', '-q', '-m', 'eins');
    const sha = g(repo, 'rev-parse', 'HEAD');
    g(repo, 'rm', '-q', 'a.txt');
    writeFileSync(join(repo, 'b.txt'), 'sauber\n');
    g(repo, 'add', 'b.txt');
    g(repo, 'commit', '-q', '-m', 'zwei');
    return { repo, sha };
  }

  it('Treffer nur in der Historie: Exit 1, Meldung nennt den Commit, nicht das Wort', () => {
    const { repo, sha } = repoMitHistorie();
    const r = lauf(['--repo'], 'beispiel-verein', repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`Treffer: commit ${sha} (Listeneintrag #1)`);
    expect(r.stderr.toLowerCase()).not.toContain('beispiel-verein');
  });
  it('Treffer im PR-Text: Exit 1, Meldung „PR-Text"', () => {
    const { repo } = repoMitHistorie();
    const pr = join(tmp('kit-scan-pr-'), 'pr.txt');
    writeFileSync(pr, 'Titel: Anpassung für muster-ag\n');
    const r = lauf(['--repo', '--pr-text', pr], 'muster-ag', repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Treffer: PR-Text (Listeneintrag #1)');
  });
  it('sauberer Stand samt Historie und PR-Text: Exit 0', () => {
    const { repo } = repoMitHistorie();
    const pr = join(tmp('kit-scan-pr-'), 'pr.txt');
    writeFileSync(pr, 'Titel: Gerüst\n');
    expect(lauf(['--repo', '--pr-text', pr], 'muster-ag', repo).status).toBe(0);
  });
  it('Treffer in einem Branch-Namen: Exit 1, Meldung nennt nur die Quelle, nicht den Ref-Namen', () => {
    const { repo } = repoMitHistorie();
    g(repo, 'branch', 'feature/muster-ag-anpassung');
    const r = lauf(['--repo'], 'muster-ag', repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Treffer: Ref-Namen und Tag-Texte (Listeneintrag #1)');
    expect(r.stderr.toLowerCase()).not.toContain('muster-ag');
  });
  it('nicht lesbare Datei (im Index, im Arbeitsbaum gelöscht): Meldung über anzeige(), ohne Stack und ohne Pfad im Klartext', () => {
    const { repo } = repoMitHistorie();
    writeFileSync(join(repo, 'muster-ag.txt'), 'x\n');
    writeFileSync(join(repo, 'weg.txt'), 'x\n');
    g(repo, 'add', 'muster-ag.txt', 'weg.txt');
    g(repo, 'commit', '-q', '-m', 'drei');
    rmSync(join(repo, 'muster-ag.txt'));
    rmSync(join(repo, 'weg.txt'));
    const sauber = lauf(['--repo'], 'beispiel-ag', repo);
    expect(sauber.status).toBe(0);
    expect(sauber.stderr).toContain('Nicht lesbar: weg.txt (ENOENT)');
    const r = lauf(['--repo'], 'muster-ag', repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Nicht lesbar: Datei #\d+ \(ENOENT\)/);
    expect(r.stderr.toLowerCase()).not.toContain('muster-ag');
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
});
