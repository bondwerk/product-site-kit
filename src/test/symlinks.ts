import { execFileSync } from 'node:child_process';

/** Pfade im Git-Index mit Modus 120000 (Symlink). Der Web-Bond lehnt solche Bäume beim Fetch ab. */
export function symlinkEintraege(repoWurzel: string): string[] {
  return execFileSync('git', ['ls-files', '-s'], { cwd: repoWurzel, encoding: 'utf8' })
    .split('\n')
    .filter((z) => z.startsWith('120000 '))
    .map((z) => z.slice(z.indexOf('\t') + 1));
}
