// Spec #435 §4.2: das K1-Bundle läuft im vm ohne require — der Schema-Pfad darf nichts aus node:* ziehen,
// auch nicht transitiv. Gemessen mit esbuild platform:'neutral' (dort sind Node-Builtins nicht auflösbar).
import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const NODE_BUILTIN = /^(node:|(fs|path|os|child_process|crypto|url|util|stream|module|process)(\/|$))/;

async function importeVon(eintrag: string): Promise<string[]> {
  const r = await build({
    entryPoints: [fileURLToPath(new URL(eintrag, import.meta.url))],
    bundle: true, write: false, platform: 'neutral', format: 'esm', metafile: true, logLevel: 'silent',
    external: ['astro/zod'],
  });
  return Object.values(r.metafile.inputs).flatMap((i) => i.imports.map((x) => x.path));
}

describe('Schema-Subpaths sind node-frei', () => {
  for (const eintrag of ['../src/schema/index.ts', '../src/json-schema/index.ts']) {
    it(`${eintrag} bündelt mit platform neutral und zieht kein node:*`, async () => {
      expect((await importeVon(eintrag)).filter((p) => NODE_BUILTIN.test(p))).toEqual([]);
    });
  }
});
