// Spec #435 §11.1: rekursiver Abdruck eines dist/ (Pfad → sha256), für Byte-Identität innerhalb derselben Version.
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function distAbdruck(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lauf = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (lstatSync(p).isDirectory()) lauf(p);
      else out[relative(dir, p).replace(/\\/g, '/')] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  lauf(dir);
  return out;
}
