/** Import-Spezifizierer, die auf ein hartcodiertes Datenmodul statt auf eine Collection deuten. */
const VERBOTENES_MUSTER = /(^|\/)(i18n\/)?(content|eintraege|daten|data)(\.ts|\.js)?$/i;
const ERLAUBTE_DATEIEN = new Set(['src/content.config.ts']);

export interface LintTreffer { datei: string; zeile: number; specifier: string }

// Über den ganzen Text statt zeilenweise: statische Imports (auch mehrzeilig), dynamisches import()
// und Re-Exports mit `export … from`. Genau eine der drei Gruppen trägt den Spezifizierer.
const IMPORT_MUSTER = new RegExp([
  String.raw`\bimport\s+(?:[^'"]*?\bfrom\s*)?['"]([^'"\n]+)['"]`,
  String.raw`\bimport\s*\(\s*['"]([^'"\n]+)['"]`,
  String.raw`\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*['"]([^'"\n]+)['"]`,
].join('|'), 'g');

function importSpecifiers(quelle: string): { specifier: string; zeile: number }[] {
  const treffer: { specifier: string; zeile: number }[] = [];
  for (const m of quelle.matchAll(IMPORT_MUSTER)) {
    const specifier = (m[1] ?? m[2] ?? m[3])!;
    // Zeile des Spezifizierers selbst: er steht am Ende des Treffers, direkt vor dem schliessenden Quote.
    const offset = m.index + m[0].length - 1 - specifier.length;
    treffer.push({ specifier, zeile: quelle.slice(0, offset).split('\n').length });
  }
  return treffer;
}

/** Design (`src/`) liest Inhalte nur über astro:content, nie über ein importiertes Datenmodul. */
export function lintDatei(relPfad: string, inhalt: string): LintTreffer[] {
  if (ERLAUBTE_DATEIEN.has(relPfad)) return [];
  const out: LintTreffer[] = [];
  for (const { specifier, zeile } of importSpecifiers(inhalt)) {
    if (specifier.startsWith('astro:')) continue;
    if (!specifier.startsWith('.')) continue;
    if (VERBOTENES_MUSTER.test(specifier)) out.push({ datei: relPfad, zeile, specifier });
  }
  return out;
}
