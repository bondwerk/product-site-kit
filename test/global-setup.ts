// Baut dist/ genau einmal vor allen Testdateien (exporte, Fixture-Site, Versions-Helfer lesen es).
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const wurzel = fileURLToPath(new URL('..', import.meta.url));
  rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });
  execFileSync('npm', ['run', 'build'], { cwd: wurzel, stdio: 'pipe' });
}
