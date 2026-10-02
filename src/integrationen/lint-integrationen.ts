import type { AstroIntegration } from 'astro';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintTextFuer, lintJsonKeys, jsonStrings } from '../lints/content-lint.js';
import { safeJsonParse } from '../lints/json-safe.js';
import { lintDatei } from '../lints/nur-collections.js';

export interface ContentLintOptionen {
  /** Eigene Adressen der Site (Domain oder Mail-Adresse), die im Text stehen dürfen. */
  eigeneAdressen?: readonly string[];
  /** Kontakt-Dateien relativ zur Repo-Wurzel; sie sind vom Text-Lint ausgenommen (ihr Schema ist strict). */
  kontaktDateien?: readonly string[];
}

async function dateienUnter(dir: string, endung: RegExp): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await dateienUnter(p, endung)));
    else if (endung.test(e.name)) out.push(p);
  }
  return out;
}

/** Prüft alle .md/.json unter `contentDir`; Pfade in den Meldungen relativ zur Repo-Wurzel. */
export async function pruefeContent(contentDir: string, opt: ContentLintOptionen = {}): Promise<string[]> {
  if (!existsSync(contentDir)) return [];
  const wurzel = dirname(contentDir);
  const lint = lintTextFuer(opt.eigeneAdressen ?? []);
  const kontakt = new Set(opt.kontaktDateien ?? ['content/de/kontakt.json']);
  const fehler: string[] = [];
  for (const datei of await dateienUnter(contentDir, /\.(md|json)$/i)) {
    const anzeige = relative(wurzel, datei).replace(/\\/g, '/');
    const istJson = /\.json$/i.test(anzeige);
    let roh: string;
    try { roh = readFileSync(datei, 'utf8'); } catch (e) { fehler.push(`${anzeige}: nicht lesbar — ${(e as Error).message}`); continue; }
    if (istJson) for (const m of lintJsonKeys(roh)) fehler.push(`${anzeige}: ${m}`);
    if (kontakt.has(anzeige)) continue;
    let texte: string[];
    try { texte = istJson ? jsonStrings(safeJsonParse(roh)) : [roh]; } catch (e) { fehler.push(`${anzeige}: ungültiges JSON — ${(e as Error).message}`); continue; }
    for (const t of texte) for (const m of lint(t)) fehler.push(`${anzeige}: ${m}`);
  }
  return fehler;
}

/** Astro-Integration: Content-Lint beim Dev-Start (meldet) und beim Build (bricht). */
export function contentLint(opt: ContentLintOptionen = {}): AstroIntegration {
  return {
    name: 'bondwerk-content-lint',
    hooks: {
      'astro:config:setup': async ({ logger, command, config }) => {
        const fehler = await pruefeContent(fileURLToPath(new URL('content', config.root)), opt);
        if (fehler.length) {
          fehler.forEach((f) => logger.error(f));
          if (command === 'build') throw new Error(`content-lint: ${fehler.length} Problem(e) im Content`);
        }
      },
    },
  };
}

/** Astro-Integration: Design darf Inhalte nur über astro:content lesen. */
export function nurCollectionsLint(): AstroIntegration {
  return {
    name: 'bondwerk-nur-collections-lint',
    hooks: {
      'astro:config:setup': async ({ logger, command, config }) => {
        const srcDir = fileURLToPath(new URL('src', config.root));
        if (!existsSync(srcDir)) return;
        const wurzel = fileURLToPath(config.root);
        const fehler: string[] = [];
        for (const datei of await dateienUnter(srcDir, /\.(astro|ts|tsx)$/i)) {
          for (const t of lintDatei(relative(wurzel, datei), readFileSync(datei, 'utf8'))) {
            fehler.push(`${t.datei}:${t.zeile}: verbotener Content-Import «${t.specifier}» — Inhalte nur über astro:content (getCollection/getEntry)`);
          }
        }
        if (fehler.length) {
          fehler.forEach((f) => logger.error(f));
          if (command === 'build') throw new Error(`nur-collections-lint: ${fehler.length} Problem(e)`);
        }
      },
    },
  };
}
