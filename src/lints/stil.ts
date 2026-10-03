// Spec #435 §7.1/§7.2, Plan B2/B18: Stil-Lint für jedes CSS ausser palette.css (Kit und Site). Kein node:*.
const FARB_EIGENSCHAFT = new RegExp('^(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?'
  + '|border-(block|inline)(-(start|end))?(-color)?|outline(-color)?|text-decoration(-color)?|box-shadow|text-shadow'
  + '|-webkit-text-fill-color|column-rule(-color)?|text-emphasis(-color)?|fill|stroke|caret-color|accent-color|all)$');
const ERLAUBT = /^(currentcolor|transparent|inherit|none|solid|dashed|dotted|double|wavy|underline|overline|line-through|blink|0|-?\d*\.?\d+(px|rem|em|%)?)$/i;
const PALETTE_VAR = /var\(--pal-[a-z-]+(?:,\s*var\(--pal-[a-z-]+\))?\)/g;
/** Eigenschaften, bei denen transparent den Text oder seine Linie unsichtbar macht. */
const OHNE_TRANSPARENT = /^(color|-webkit-text-fill-color|text-decoration(-color)?)$/;
/** Linien-Schlüsselwörter ausser underline: ersetzen oder entfernen die Unterstreichung. */
const ANDERE_LINIE = /^(none|line-through|overline|blink|inherit|initial|unset|revert|revert-layer|spelling-error|grammar-error)$/i;

/** Ein Befund je verletzter Deklaration; Selektoren innerhalb von @media werden einzeln geprüft. */
export function stilBefunde(css: string): string[] {
  const befunde: string[] = [];
  const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of ohneKommentar.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // Anweisungen ohne Block davor (@import, @charset) gehören nicht zum Selektor.
    const selektor = m[1]!.split(';').at(-1)!.trim();
    for (const d of m[2]!.split(';').map((x) => x.trim()).filter(Boolean)) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const roh = d.slice(0, i).trim();
      const eig = roh.toLowerCase();
      const wert = d.slice(i + 1).trim();
      const zitat = `«${selektor} { ${d.replace(/\s+/g, ' ')} }»`;
      if (roh.includes('\\')) { befunde.push(`Escape im Eigenschaftsnamen: ${zitat}`); continue; }
      const teile = wert.replace(PALETTE_VAR, '').split(/[\s,]+/).filter(Boolean);
      if (eig.startsWith('--pal-')) befunde.push(`Palette-Token ausserhalb palette.css: ${zitat}`);
      if (/^text-decoration(-line)?$/.test(eig) && selektor !== '.kit-knopf'
        && (!teile.some((t) => t.toLowerCase() === 'underline') || teile.some((t) => ANDERE_LINIE.test(t)))) {
        befunde.push(`Unterstreichung entfernt ausserhalb .kit-knopf: ${zitat}`);
      }
      if (OHNE_TRANSPARENT.test(eig) && teile.some((t) => t.toLowerCase() === 'transparent')) {
        befunde.push(`Text- oder Linienfarbe transparent: ${zitat}`);
      }
      if (FARB_EIGENSCHAFT.test(eig) && teile.some((t) => !ERLAUBT.test(t))) {
        befunde.push(`Farbe nicht aus der Palette: ${zitat}`);
      }
    }
  }
  return befunde;
}
