#!/usr/bin/env node
// Release-Gate (Spec #435 §11.4, F8; Council P1):
//   node scripts/identifikator-scan.mjs <paket.tgz>   — jede Datei im Tarball, Inhalt und Pfad
//   node scripts/identifikator-scan.mjs --repo [--pr-text <datei>]
//        — alle Dateien aus `git ls-files` (Inhalt und Pfad), jeder Commit aus `git rev-list --all`
//          (Autor, Committer, Nachricht, Patch; mit geholten PR-Refs auch deren Commits), die
//          alle Ref-Namen (Branches, Tags, Remotes) samt Tag-Texten und optional ein PR-Text (Titel und Beschreibung bzw. `gh pr list --json`).
// Liste aus SITE_KIT_IDENTIFIKATOREN; leer = Exit 2 (fail-closed), Treffer = Exit 1. Die Ausgabe
// nennt nur Fundort und Listennummer, nie die Trefferzeile und nie einen Pfad, der selbst einen
// Eintrag enthält.
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { leseListe, funde, anzeige } from './identifikator-regeln.mjs';

const NUTZUNG = 'Nutzung: node scripts/identifikator-scan.mjs <paket.tgz> | --repo [--pr-text <datei>]';
const argv = process.argv.slice(2);
const liste = leseListe(process.env.SITE_KIT_IDENTIFIKATOREN);
if (liste.length === 0) {
  console.error('identifikator-scan: Liste leer oder nicht gesetzt (SITE_KIT_IDENTIFIKATOREN) — fail-closed.');
  process.exit(2);
}

/** Symlinks werden nicht verfolgt: gescannt wird ihr Ziel-Text. */
const lies = (p) => (lstatSync(p).isSymbolicLink() ? readlinkSync(p) : readFileSync(p, 'utf8'));

function tarballQuellen(tgz) {
  const ziel = mkdtempSync(join(tmpdir(), 'kit-scan-'));
  try {
    execFileSync('tar', ['-xzf', tgz, '-C', ziel]);
    const out = [];
    const lauf = (d) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (lstatSync(p).isDirectory()) lauf(p);
        else out.push({ pfad: relative(ziel, p), inhalt: lies(p) });
      }
    };
    lauf(ziel);
    return out;
  } finally {
    rmSync(ziel, { recursive: true, force: true });
  }
}

/** Dateien, die `git ls-files` nennt, aber nicht lesbar sind (Submodul, im Arbeitsbaum gelöscht). */
const nichtLesbar = [];

/** Liest eine Datei aus `git ls-files`; ein Lesefehler wird vermerkt statt geworfen (kein Stack, keine
 *  Fehlermeldung mit Pfad in der Ausgabe). Ihr Pfad bleibt als Quelle im Scan. */
function lesbar(p) {
  try {
    return lies(p);
  } catch (e) {
    nichtLesbar.push({ pfad: p, code: e?.code ?? 'Lesefehler' });
    return '';
  }
}

function repoQuellen(prText) {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  const dateien = git('ls-files', '-z').split('\0').filter(Boolean).map((p) => ({ pfad: p, inhalt: lesbar(p) }));
  const commits = git('rev-list', '--all').split('\n').filter(Boolean).map((sha) => ({
    pfad: `commit ${sha}`,
    inhalt: git('show', '--no-color', '--no-ext-diff', '--no-textconv', '-m', '-p', '--format=%an%n%ae%n%cn%n%ce%n%B', sha),
  }));
  // Alle Refs, nicht nur Tags: ein Branch- oder Remote-Name ist ebenso öffentlich wie ein Tag.
  const refs = [{ pfad: 'Ref-Namen und Tag-Texte', inhalt: git('for-each-ref', '--format=%(refname)%0a%(contents)') }];
  const pr = prText === undefined ? [] : [{ pfad: 'PR-Text', inhalt: readFileSync(prText, 'utf8') }];
  return [...dateien, ...commits, ...refs, ...pr];
}

let quellen;
if (argv[0] === '--repo') {
  const i = argv.indexOf('--pr-text');
  if (i >= 0 && !argv[i + 1]) {
    console.error(NUTZUNG);
    process.exit(2);
  }
  quellen = repoQuellen(i >= 0 ? argv[i + 1] : undefined);
} else if (argv.length === 1 && !argv[0].startsWith('--')) {
  quellen = tarballQuellen(argv[0]);
} else {
  console.error(NUTZUNG);
  process.exit(2);
}

const nummer = (pfad) => quellen.findIndex((q) => q.pfad === pfad) + 1;
for (const { pfad, code } of nichtLesbar) console.error(`Nicht lesbar: ${anzeige(pfad, nummer(pfad), liste)} (${code})`);

const treffer = funde(quellen, liste);
if (treffer.length) {
  for (const t of treffer) {
    console.error(`Treffer: ${anzeige(t.pfad, nummer(t.pfad), liste)} (Listeneintrag #${t.eintrag})`);
  }
  process.exit(1);
}
console.log(`identifikator-scan: ${quellen.length} Quellen, ${liste.length} Einträge, keine Treffer`);
