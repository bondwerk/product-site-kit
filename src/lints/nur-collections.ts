/** Import-Spezifizierer, die auf ein hartcodiertes Datenmodul statt auf eine Collection deuten. */
const VERBOTENES_MUSTER = /(^|\/)(i18n\/)?(content|settlements|daten|data)(\.ts|\.js)?$/i;
const ERLAUBTE_DATEIEN = new Set(['src/content.config.ts']);

export interface LintTreffer { datei: string; zeile: number; specifier: string }

function importSpecifiers(quelle: string): { specifier: string; zeile: number }[] {
  const treffer: { specifier: string; zeile: number }[] = [];
  const muster = /\bimport\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
  quelle.split(/\r?\n/).forEach((zeile, i) => {
    muster.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = muster.exec(zeile))) treffer.push({ specifier: m[1]!, zeile: i + 1 });
  });
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
