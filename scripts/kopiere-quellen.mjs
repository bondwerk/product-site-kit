#!/usr/bin/env node
// Plan #435 A1: tsc kennt .astro und .css nicht — beide werden aus src/ wörtlich nach dist/ kopiert.
// Kein Lebenszyklus-Skript; läuft nur über `npm run build`. Symlinks brechen ab (Tarball nur reguläre Dateien).
import { copyFileSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const ENDUNG = /\.(astro|css)$/;
function lauf(dir) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const s = lstatSync(p);
    if (s.isSymbolicLink()) throw new Error(`kopiere-quellen: Symlink in src/ — ${p}`);
    if (s.isDirectory()) lauf(p);
    else if (ENDUNG.test(name)) {
      const ziel = join('dist', relative('src', p));
      mkdirSync(dirname(ziel), { recursive: true });
      copyFileSync(p, ziel);
    }
  }
}
lauf('src');
