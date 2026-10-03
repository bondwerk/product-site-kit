#!/usr/bin/env node
// Versions-Test (Spec #435 §4.4/§11.1, Plan B12): node scripts/versions-test.mjs
// Installiert die gepinnte Basis aus scripts/versions-basis.json ohne Skripte und ohne Peers, prüft ihre integrity gegen
// den Pin und vergleicht die Exporte (Obermenge). Erwartet ein gebautes dist/. Läuft nur in Jobs ohne Secrets und ohne id-token.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { basisBefunde, fehlendeExporte, integritaetAusLock } from './versionen-regeln.mjs';

const basis = JSON.parse(readFileSync('scripts/versions-basis.json', 'utf8'));
const fehler = basisBefunde(basis);
if (fehler.length) { console.error(fehler.join('\n')); process.exit(2); }
const KIT = resolve('.');
const ARBEIT = resolve('pack-ausgabe/vorige');
rmSync(ARBEIT, { recursive: true, force: true });
mkdirSync(ARBEIT, { recursive: true });
writeFileSync(join(ARBEIT, 'package.json'), '{ "private": true }\n');
execFileSync('npm', ['install', `@bondwerk/site-kit@${basis.version}`, '--save-exact', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund'],
  { cwd: ARBEIT, stdio: 'pipe' });
if (integritaetAusLock(JSON.parse(readFileSync(join(ARBEIT, 'package-lock.json'), 'utf8'))) !== basis.integrity) {
  console.error(`versions-test: integrity der Basis ${basis.version} weicht vom Pin ab`);
  process.exit(1);
}

/** Exportierte Namen je Subpath; die Peers (astro, zod) löst Node aus dem node_modules des Kits auf. */
async function exporte(wurzel) {
  const pkg = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(pkg.exports)) {
    if (k.includes('*') || typeof v !== 'object') continue;
    out[k.slice(2)] = Object.keys(await import(pathToFileURL(join(wurzel, v.default)).href)).sort();
  }
  return out;
}
const befunde = fehlendeExporte(await exporte(join(ARBEIT, 'node_modules/@bondwerk/site-kit')), await exporte(KIT));
if (befunde.length) { console.error(befunde.map((b) => `Export fehlt: ${b}`).join('\n')); process.exit(1); }
console.log(`versions-test gegen ${basis.version}: Exporte ok`);
