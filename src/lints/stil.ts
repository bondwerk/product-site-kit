// Spec #435 §7.1/§7.2, Plan B2/B18: Stil-Lint für jedes CSS ausser palette.css (Kit und Site). Kein node:*.
const FARB_EIGENSCHAFT = /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|text-decoration(-color)?|box-shadow|fill|stroke|caret-color|accent-color)$/;
const ERLAUBT = /^(currentcolor|transparent|inherit|none|solid|dashed|dotted|underline|0|-?\d*\.?\d+(px|rem|em|%)?)$/i;
const PALETTE_VAR = /var\(--pal-[a-z-]+(?:,\s*var\(--pal-[a-z-]+\))?\)/g;

/** Ein Befund je verletzter Deklaration; Selektoren innerhalb von @media werden einzeln geprüft. */
export function stilBefunde(css: string): string[] {
  const befunde: string[] = [];
  const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of ohneKommentar.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selektor = m[1]!.trim();
    for (const d of m[2]!.split(';').map((x) => x.trim()).filter(Boolean)) {
      const i = d.indexOf(':');
      const eig = d.slice(0, i).trim();
      const wert = d.slice(i + 1).trim();
      const zitat = `«${selektor} { ${d.replace(/\s+/g, ' ')} }»`;
      if (eig.startsWith('--pal-')) befunde.push(`Palette-Token ausserhalb palette.css: ${zitat}`);
      if (/^text-decoration(-line)?$/.test(eig) && /\bnone\b/i.test(wert) && selektor !== '.kit-knopf') befunde.push(`Unterstreichung entfernt ausserhalb .kit-knopf: ${zitat}`);
      if (FARB_EIGENSCHAFT.test(eig) && wert.replace(PALETTE_VAR, '').split(/[\s,]+/).filter(Boolean).some((t) => !ERLAUBT.test(t))) {
        befunde.push(`Farbe nicht aus der Palette: ${zitat}`);
      }
    }
  }
  return befunde;
}
