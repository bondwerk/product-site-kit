#!/usr/bin/env node
// Versions-Test (Spec #435 §4.4/§11.1, Plan B12; Teil 2 Phase 2 §8/S5): node scripts/versions-test.mjs
// Installiert die gepinnte Basis aus scripts/versions-basis.json ohne Skripte und ohne Peers, prüft ihre integrity gegen
// den Pin und vergleicht Exporte (Obermenge), kit.css (jede alte Regel wörtlich und in gleicher Ordnung enthalten) und das normalisierte HTML
// der Fixture-Site (test/fixture-site mit scripts/versions-fixture.json), gebaut einmal mit der Basis, einmal mit dist/.
// Abweichungen lässt nur scripts/versions-ausnahmen.json zu (je Eintrag genau eine Basisversion).
// Erwartet ein gebautes dist/. Läuft nur in Jobs ohne Secrets und ohne id-token.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ausnahmenBefunde, basisBefunde, cssBefunde, fehlendeExporte, htmlBefunde, integritaetAusLock } from './versionen-regeln.mjs';

const basis = JSON.parse(readFileSync('scripts/versions-basis.json', 'utf8'));
const ausnahmen = JSON.parse(readFileSync('scripts/versions-ausnahmen.json', 'utf8'));
const fehler = [...basisBefunde(basis), ...ausnahmenBefunde(ausnahmen)];
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
const VORIGE = join(ARBEIT, 'node_modules/@bondwerk/site-kit');
const befunde = fehlendeExporte(await exporte(VORIGE), await exporte(KIT)).map((b) => `Export fehlt: ${b}`);

const kitCss = (wurzel) => readFileSync(join(wurzel, 'dist/stile/kit.css'), 'utf8');
befunde.push(...cssBefunde(kitCss(VORIGE), kitCss(KIT), ausnahmen, basis.version).map((b) => `kit.css: ${b}`));

// Builds mit cwd und outDir in der Fixture (gitignored; Astro verschiebt Assets per rename, /tmp wäre ein anderes Gerät).
const FIXTURE = join(KIT, 'test/fixture-site');
const BAU = join(FIXTURE, 'node_modules', '.kit-fixture');
mkdirSync(BAU, { recursive: true });
const lauf = mkdtempSync(join(BAU, 'versionen-'));
try {
  const seitenHtml = (wurzel, name) => {
    const ziel = join(lauf, name);
    execFileSync('npx', ['astro', 'build', '--root', FIXTURE, '--outDir', ziel], { cwd: FIXTURE, stdio: 'pipe',
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', KIT_WURZEL: wurzel, KIT_FIXTURE: resolve('scripts/versions-fixture.json') } });
    return Object.fromEntries(readdirSync(ziel, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== '_astro')
      .map((e) => [e.name, readFileSync(join(ziel, e.name, 'index.html'), 'utf8')]));
  };
  befunde.push(...htmlBefunde(seitenHtml(VORIGE, 'vorige'), seitenHtml(KIT, 'neu'), ausnahmen, basis.version));
} finally { rmSync(lauf, { recursive: true, force: true }); }

if (befunde.length) { console.error(befunde.join('\n')); process.exit(1); }
console.log(`versions-test gegen ${basis.version}: Exporte, kit.css und HTML ok`);
