// Spec #435 §4.1, §11.4; Council P1/P2; E-R2. Quelltext-Wache der Workflows: die Verdrahtung in
// YAML ist nicht anders messbar (Seam: Workflow-Dateien als Text).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const lies = (n: string) => readFileSync(new URL(`../.github/workflows/${n}`, import.meta.url), 'utf8');
/** npm 10 bricht auf diesem Lockfile ab (edgesOut); jeder Job mit `npm ci` braucht vorher npm 11, exakt gepinnt. */
const NPM11 = /npm install -g npm@11\.\d+\.\d+\b/;

/** Text eines Jobs unter `jobs:` (zwei Leerzeichen Einzug) bis zum nächsten Job oder Dateiende. */
function job(yml: string, name: string): string {
  const start = yml.indexOf(`\n  ${name}:\n`);
  if (start < 0) return '';
  const rest = yml.slice(start + 1);
  const naechster = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return naechster < 0 ? rest : rest.slice(0, naechster + 1);
}

describe('Workflows (Spec #435 §4.1, §11.4; Council P1/P2)', () => {
  it('alle Actions sind auf 40-stellige Commit-SHAs gepinnt', () => {
    for (const n of ['ci.yml', 'release.yml']) {
      const uses = [...lies(n).matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]!);
      expect(uses.length, n).toBeGreaterThan(0);
      for (const u of uses) expect(u, `${n}: ${u}`).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
    }
  });
  it('CI: Typecheck, Tests, Pack zweimal; beide Scans auf push und pull_request, mit Historie und PR-Text', () => {
    const ci = lies('ci.yml');
    for (const s of ['npm ci --ignore-scripts', 'npm run typecheck', 'npm test', 'node scripts/pack-pruefung.mjs --zweimal',
      'node scripts/identifikator-scan.mjs pack-ausgabe/*.tgz', 'node scripts/identifikator-scan.mjs --repo --pr-text',
      'fetch-depth: 0', "'+refs/pull/*:refs/remotes/pull/*'", 'types: [opened, synchronize, reopened, edited]']) {
      expect(ci, s).toContain(s);
    }
    expect(ci).not.toMatch(/if:\s*github\.event_name/);
    expect(ci).not.toContain('continue-on-error');
  });
  it('npm 11 vor jedem npm ci (CI und Release)', () => {
    const r = lies('release.yml');
    for (const [name, text] of [['ci.yml', lies('ci.yml')], ['paket', job(r, 'paket')], ['pruefen', job(r, 'pruefen')]] as const) {
      const npm11 = text.search(NPM11);
      expect(npm11, name).toBeGreaterThanOrEqual(0);
      expect(npm11, name).toBeLessThan(text.indexOf('npm ci --ignore-scripts'));
    }
  });
  it('Release: Tag auf main = Version; Job paket baut und packt vor den Tests; pruefen scannt genau diesen Tarball', () => {
    const r = lies('release.yml');
    expect(r).toContain("tags: ['v*.*.*']");
    const paket = job(r, 'paket');
    const pruefen = job(r, 'pruefen');
    expect(paket).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(paket).toContain('test "v$(node -p "require(\'./package.json\').version")" = "$GITHUB_REF_NAME"');
    expect(paket).toContain('node scripts/pack-pruefung.mjs --zweimal');
    expect(paket).toContain('actions/upload-artifact@');
    expect(paket).not.toContain('npm test');
    expect(pruefen).toContain('needs: paket');
    for (const s of ['npm run typecheck', 'npm test', 'actions/download-artifact@',
      'node scripts/identifikator-scan.mjs pack-ausgabe/*.tgz', 'node scripts/identifikator-scan.mjs --repo']) {
      expect(pruefen, s).toContain(s);
    }
    expect(pruefen).not.toContain('pack-pruefung');
  });
  it('Release: Scans ohne Ausweg — fehlt das Geheimnis, scheitert der Job (kein Überspringen)', () => {
    const r = lies('release.yml');
    expect(r).toContain('SITE_KIT_IDENTIFIKATOREN: ${{ secrets.SITE_KIT_IDENTIFIKATOREN }}');
    expect(r).not.toMatch(/-z\s+"?\$\{?SITE_KIT_IDENTIFIKATOREN|::notice|continue-on-error|\|\|\s*true|\bexit 0\b/);
    expect(r).not.toMatch(/^\s*if:/m);
  });
  it('Release: Publish-Job nach beiden, OIDC ohne Token, Provenance, ohne setup-node und ohne Checkout', () => {
    const r = lies('release.yml');
    const v = job(r, 'veroeffentlichen');
    expect(v).toContain('needs: [paket, pruefen]');
    expect(v).toContain('environment: npm-release');
    expect(v).toContain('id-token: write');
    expect(v).toMatch(/npx --yes npm@11\.\d+\.\d+ publish pack-ausgabe\/\*\.tgz --provenance --access public/);
    expect(v).not.toMatch(/setup-node|actions\/checkout/);
    expect(r).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/);
  });
  it('Release: Publish prüft den sha512-integrity des Tarballs gegen die Ausgabe des Jobs paket, vor npm publish', () => {
    const r = lies('release.yml');
    const paket = job(r, 'paket');
    const v = job(r, 'veroeffentlichen');
    // paket rechnet den integrity des Tarballs aus und reicht ihn als Job-Output weiter.
    expect(paket).toMatch(/outputs:\s*\n\s+integritaet: \$\{\{ steps\.integritaet\.outputs\.integritaet \}\}/);
    expect(paket).toContain('id: integritaet');
    expect(paket).toMatch(/openssl dgst -sha512 -binary/);
    // veroeffentlichen rechnet auf dem heruntergeladenen Tarball neu und vergleicht, bevor publish läuft.
    expect(v).toContain('ERWARTET: ${{ needs.paket.outputs.integritaet }}');
    const vergleich = v.search(/test "\$IST" = "\$ERWARTET"/);
    expect(vergleich).toBeGreaterThan(v.indexOf('actions/download-artifact@'));
    expect(vergleich).toBeGreaterThan(v.search(/openssl dgst -sha512 -binary/));
    expect(vergleich).toBeLessThan(v.indexOf('publish pack-ausgabe'));
  });
  it('Release: kein npm-Cache in den Release-Jobs', () => {
    expect(lies('release.yml')).not.toMatch(/cache:\s*npm/);
  });
});
