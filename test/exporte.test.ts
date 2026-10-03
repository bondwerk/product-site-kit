// Verdrahtungs-Wache (Spec #435 §4.2, Plan A1): jeder Baustein ist über den Paketnamen und die
// `exports` des Manifests erreichbar, so wie ein Konsument ihn lädt — gebautes JavaScript aus dist/,
// geladen von Node ohne Vite-Transform (Self-Reference auf `@bondwerk/site-kit/<subpath>`).
// dist/ baut test/global-setup.ts genau einmal vor allen Testdateien (Plan #435 S2, Task 2.1).
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const wurzel = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, { types: string; default: string }>;
};

// Erwartete öffentliche Namen je Subpath (Plan #435 §2.1, Dateikarte); wächst mit jedem Task.
const ERWARTET: Record<string, string[]> = {
  schema: ['EMAIL_ADRESSE', 'URL_ODER_SCHEME', 'chTelefon', 'contentBildPfad', 'plz', 'sichererText', 'sichererTextFuer'],
  'json-schema': ['alsJsonSchemaAus'],
  lints: ['enthaeltGefaehrlicheKeys', 'kontaktGateBefund', 'lintDatei', 'lintJsonKeys', 'lintText', 'safeJsonParse'],
  integrationen: ['bilderCopy', 'contentLint', 'nurCollectionsLint', 'rehypeExterneLinks', 'sanitizeSchema'],
  test: ['inlineBefunde', 'symlinkEintraege'],
};

function exporteUeberPaketnamen(subpath: string): string[] {
  const code = `const m = await import('@bondwerk/site-kit/${subpath}'); console.log(JSON.stringify(Object.keys(m).sort()));`;
  const aus = execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: wurzel, encoding: 'utf8' });
  return JSON.parse(aus.trim()) as string[];
}

describe('Exporte über package.json erreichbar', () => {
  for (const [subpath, namen] of Object.entries(ERWARTET)) {
    it(`@bondwerk/site-kit/${subpath} lädt aus dist/ und exportiert genau die geplanten Namen`, () => {
      expect(exporteUeberPaketnamen(subpath)).toEqual([...namen].sort());
      expect(existsSync(new URL(`../${pkg.exports[`./${subpath}`].types}`, import.meta.url)), 'Typen-Datei').toBe(true);
    });
  }
});
