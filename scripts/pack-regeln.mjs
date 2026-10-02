// Reine Prüffunktionen der Release-CI (Spec #435 §11.4). Nicht im Paket (files-Allowlist).
export const ERLAUBTE_PFADE = [/^package\.json$/, /^README\.md$/, /^LICENSE$/, /^dist\/[a-z0-9/_-]+\.(js|d\.ts)$/];
export const LEBENSZYKLUS = ['preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare',
  'prepublishOnly', 'prepack', 'postpack', 'publish', 'postpublish'];

export function pfadBefunde(pfade) {
  return pfade.filter((p) => !ERLAUBTE_PFADE.some((re) => re.test(p))).map((p) => `nicht erlaubt: ${p}`);
}

export function lebenszyklusBefunde(pkg) {
  return Object.keys(pkg.scripts ?? {}).filter((s) => LEBENSZYKLUS.includes(s)).map((s) => `Lebenszyklus-Skript: ${s}`);
}

export function tarTypBefunde(listing) {
  return listing.split('\n').filter((z) => z.trim() !== '' && !z.startsWith('-')).map((z) => `keine reguläre Datei: ${z}`);
}
