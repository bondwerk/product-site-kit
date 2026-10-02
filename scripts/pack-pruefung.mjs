#!/usr/bin/env node
// Release-Gate (Spec #435 §11.4): baut, packt und prüft den Tarball; mit --zweimal zusätzlich,
// ob zwei Bauten aus demselben Stand dasselbe integrity ergeben. Ergebnis liegt in pack-ausgabe/.
// Erwartet npm 11 im PATH (CI und Release installieren es vorher exakt gepinnt).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pfadBefunde, lebenszyklusBefunde, tarTypBefunde } from './pack-regeln.mjs';

const AUSGABE = 'pack-ausgabe';
const npm = (args) => execFileSync('npm', args, { encoding: 'utf8' });

function baueUndPacke() {
  rmSync('dist', { recursive: true, force: true });
  npm(['run', 'build']);
  rmSync(AUSGABE, { recursive: true, force: true });
  mkdirSync(AUSGABE);
  const [info] = JSON.parse(npm(['pack', '--json', '--pack-destination', AUSGABE]));
  return info;
}

const zweimal = process.argv.includes('--zweimal');
const info = baueUndPacke();
const tgz = join(AUSGABE, info.filename);
const befunde = [
  ...pfadBefunde(info.files.map((f) => f.path)),
  ...tarTypBefunde(execFileSync('tar', ['-tvzf', tgz], { encoding: 'utf8' })),
  ...lebenszyklusBefunde(JSON.parse(execFileSync('tar', ['-xzOf', tgz, 'package/package.json'], { encoding: 'utf8' }))),
];
if (zweimal) {
  const zweites = baueUndPacke();
  if (zweites.integrity !== info.integrity) befunde.push(`nicht reproduzierbar: ${info.integrity} ≠ ${zweites.integrity}`);
}
if (befunde.length) {
  console.error(befunde.join('\n'));
  process.exit(1);
}
console.log(`pack-pruefung: ${info.files.length} Dateien, ${info.integrity}${zweimal ? ', reproduzierbar' : ''}`);
