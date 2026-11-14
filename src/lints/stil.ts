// Spec #435 §7.1/§7.2, Plan B2/B18: Stil-Lint für jedes CSS ausser palette.css (Kit und Site). Kein node:*.
const FARB_EIGENSCHAFT = new RegExp('^(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?'
  + '|border-(block|inline)(-(start|end))?(-color)?|outline(-color)?|text-decoration(-color)?|box-shadow|text-shadow'
  + '|-webkit-text-fill-color|column-rule(-color)?|text-emphasis(-color)?|fill|stroke|caret-color|accent-color|all'
  + '|(-webkit-)?border-image(-source)?|list-style-image|(-webkit-)?(backdrop-)?filter)$');
/** filter trägt auch farblose Funktionen (blur, brightness …); geprüft wird nur die Farbe in drop-shadow(…). */
const FILTER = /^(-webkit-)?(backdrop-)?filter$/;
const ERLAUBT = /^(currentcolor|transparent|inherit|none|solid|dashed|dotted|double|wavy|underline|overline|line-through|blink|0|-?\d*\.?\d+(px|rem|em|%)?)$/i;
const PALETTE_VAR = /var\(--pal-[a-z-]+(?:,\s*var\(--pal-[a-z-]+\))?\)/g;
/** Eigenschaften, bei denen transparent den Text oder seine Linie unsichtbar macht. */
const OHNE_TRANSPARENT = /^(color|-webkit-text-fill-color|text-decoration(-color)?)$/;
/** Linien-Schlüsselwörter ausser underline: ersetzen oder entfernen die Unterstreichung. */
const ANDERE_LINIE = /^(none|line-through|overline|blink|inherit|initial|unset|revert|revert-layer|spelling-error|grammar-error)$/i;

/** Teilt an Trennzeichen auf oberster Ebene (nicht in (), [] oder Anführungszeichen). */
function teileOben(text: string, trenner: RegExp): string[] {
  const teile: string[] = [];
  let tiefe = 0; let zitat = ''; let aktuell = '';
  for (const z of text) {
    if (zitat) { if (z === zitat) zitat = ''; }
    else if (z === '"' || z === "'") zitat = z;
    else if (z === '(' || z === '[') tiefe++;
    else if (z === ')' || z === ']') tiefe--;
    else if (tiefe === 0 && trenner.test(z)) { teile.push(aktuell); aktuell = ''; continue; }
    aktuell += z;
  }
  teile.push(aktuell);
  return teile.map((t) => t.trim()).filter(Boolean);
}

type Spez = [number, number, number];
const groesser = (x: Spez, y: Spez): boolean => x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];
const LEGACY_PSEUDO_ELEMENT = /^(before|after|first-line|first-letter)$/i;

/** Spezifität eines einzelnen Selektors nach Selectors Level 4; null, wenn er sich nicht sicher lesen lässt. */
function spezifitaet(sel: string): Spez | null {
  const sp: Spez = [0, 0, 0];
  const ident = (i: number): number => { while (i < sel.length && /[\w-]/.test(sel[i]!)) i++; return i; };
  const klammer = (i: number): number => {   // i zeigt auf «(»; Rückgabe: Index nach der passenden «)»
    let t = 0;
    for (let j = i; j < sel.length; j++) { if (sel[j] === '(') t++; else if (sel[j] === ')' && --t === 0) return j + 1; }
    return -1;
  };
  const maxListe = (liste: string): Spez | null => {
    let best: Spez = [0, 0, 0];
    for (const t of teileOben(liste, /,/)) { const x = spezifitaet(t); if (!x) return null; if (groesser(x, best)) best = x; }
    return best;
  };
  for (let i = 0; i < sel.length;) {
    const z = sel[i]!;
    if (z === '#') { sp[0]++; i = ident(i + 1); }
    else if (z === '.') { sp[1]++; i = ident(i + 1); }
    else if (z === '[') { const e = sel.indexOf(']', i); if (e < 0) return null; sp[1]++; i = e + 1; }
    else if (z === ':') {
      const element = sel[i + 1] === ':';
      const start = i + (element ? 2 : 1);
      const ende = ident(start);
      const name = sel.slice(start, ende).toLowerCase();
      i = ende;
      let args: string | undefined;
      if (sel[i] === '(') { const e = klammer(i); if (e < 0) return null; args = sel.slice(i + 1, e - 1); i = e; }
      if (element || LEGACY_PSEUDO_ELEMENT.test(name)) { sp[2]++; continue; }
      if (name === 'where') continue;
      if (args !== undefined && /^(is|not|has|matches|-webkit-any|-moz-any)$/.test(name)) {
        const m = maxListe(args); if (!m) return null; sp[0] += m[0]; sp[1] += m[1]; sp[2] += m[2]; continue;
      }
      sp[1]++;
      if (args !== undefined && /^nth-(last-)?child$/.test(name)) {
        const of = /\bof\b\s*([\s\S]*)$/i.exec(args);   // auch «2 of.a»; An+B selbst enthält nie «of»
        if (of) { const m = maxListe(of[1]!); if (!m) return null; sp[0] += m[0]; sp[1] += m[1]; sp[2] += m[2]; }
      }
    } else if (z === '*') i++;
    else if (/[a-zA-Z_-]/.test(z)) { sp[2]++; i = ident(i); }
    else if (/[\s>+~|]/.test(z)) i++;
    else return null;   // Escape (\6b it- umgeht die kit-Prüfung), & (Nesting) oder Unbekanntes
  }
  return sp;
}

/**
 * Betreiber-Entscheid 13.10. (Kit 0.3.0): Links ohne Unterstreichung ausserhalb von Fliesstext und Kit-Abschnitten.
 * kit.css unterstreicht dort mit «.kit-fliesstext a:not(.kit-knopf), .kit-abschnitt a:not(.kit-knopf)» (0,2,1).
 * Erlaubt ist genau der Wert «none» (also auch kein !important) an einer Regel, die diesen Schutz nie schlagen kann:
 * jeder Selektor strikt unter (0,2,1) (eine ID allein liegt darüber), kein kit-*, nicht in einer Stilregel verschachtelt;
 * ein Escape macht den Selektor unlesbar (spezifitaet → null) und damit zum Befund.
 */
const KIT_SCHUTZ: Spez = [0, 2, 1];
function schlaegtKitSchutzNie(selektor: string, verschachtelt: boolean): boolean {
  if (verschachtelt || /kit-/i.test(selektor)) return false;
  return teileOben(selektor, /,/).every((s) => { const x = spezifitaet(s); return x !== null && groesser(KIT_SCHUTZ, x); });
}

/**
 * Betreiber-Entscheid 13.10. (Kit 0.3.0): linear-gradient ist erlaubt, wenn jeder Farbstopp var(--pal-*), transparent oder
 * color-mix(in srgb, var(--pal-*) n%, transparent) ist;
 * sonst nur Richtung (to …, Winkel) und Stopp-Positionen. Gültige Verläufe fallen aus dem Wert, alles andere prüft die Farbregel.
 */
const VERLAUF_TEIL = /^(to|top|bottom|left|right|transparent|-?\d*\.?\d+(deg|grad|rad|turn|px|rem|em|%)?)$/i;
/** Als Farbstopp zusätzlich genau diese Form: Palette-Farbe zu n % (0–100) gegen transparent gemischt, in srgb. */
const ABGESCHWAECHT = /color-mix\(\s*in\s+srgb\s*,\s*var\(--pal-[a-z-]+\)\s+(?:100(?:\.0+)?|\d{1,2}(?:\.\d+)?)%\s*,\s*transparent\s*\)/g;
function ohnePaletteVerlaeufe(wert: string): string {
  const anfang = /(?<![\w-])linear-gradient\(/gi;
  let aus = ''; let pos = 0;
  for (let m = anfang.exec(wert); m; m = anfang.exec(wert)) {
    let tiefe = 1; let ende = m.index + m[0].length;
    for (; ende < wert.length && tiefe > 0; ende++) tiefe += wert[ende] === '(' ? 1 : wert[ende] === ')' ? -1 : 0;
    if (tiefe > 0) break;
    const innen = wert.slice(m.index + m[0].length, ende - 1).replace(ABGESCHWAECHT, ' ').replace(PALETTE_VAR, ' ');
    const gueltig = !/[()]/.test(innen) && innen.split(/[\s,]+/).filter(Boolean).every((t) => VERLAUF_TEIL.test(t));
    if (gueltig) { aus += wert.slice(pos, m.index); pos = ende; }
    anfang.lastIndex = ende;
  }
  return aus + wert.slice(pos);
}

/** Wertteile innerhalb aller drop-shadow(…) eines filter-Werts; ein nicht geschlossenes drop-shadow bleibt samt Namen stehen und wird so zum Befund. */
function dropShadowTeile(wert: string): string[] {
  const anfang = /(?<![\w-])drop-shadow\(/gi;
  const teile: string[] = [];
  for (let m = anfang.exec(wert); m; m = anfang.exec(wert)) {
    let tiefe = 1; let ende = m.index + m[0].length;
    for (; ende < wert.length && tiefe > 0; ende++) tiefe += wert[ende] === '(' ? 1 : wert[ende] === ')' ? -1 : 0;
    const innen = tiefe > 0 ? wert.slice(m.index) : wert.slice(m.index + m[0].length, ende - 1);
    teile.push(...innen.replace(PALETTE_VAR, '').split(/[\s,]+/).filter(Boolean));
    anfang.lastIndex = ende;
  }
  return teile;
}

/** Index nach dem Ende der Zeichenkette, die bei text[i] (" oder ') beginnt; Backslash maskiert das nächste Zeichen; -1, wenn sie nicht schliesst. */
function stringEnde(text: string, i: number): number {
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === text[i]) return j + 1;
  }
  return -1;
}

/** Bei text[i] == «(» eines ungequoteten url( … ): Index nach der schliessenden «)»; -1, wenn sie fehlt; null, wenn hier kein ungequotetes url( beginnt. */
function urlEnde(text: string, i: number): number | null {
  if (text[i] !== '(' || !/(?<![\w-])url$/i.test(text.slice(Math.max(0, i - 4), i))) return null;
  let j = i + 1;
  while (/\s/.test(text[j] ?? '')) j++;
  if (text[j] === '"' || text[j] === "'") return null;   // url("…") liest die Zeichenkette
  for (; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === ')') return j + 1;
  }
  return -1;
}

/** Teilt an zeichen ausserhalb von Zeichenketten, ungequoteten url(…) und Escapes; Kommentare sind beim Lesen schon entfernt. */
function teileAn(text: string, zeichen: string): string[] {
  const teile: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const z = text[i]!;
    if (z === '"' || z === "'") { const e = stringEnde(text, i); if (e < 0) break; i = e - 1; }
    else if (z === '\\') i++;
    else if (z === '(') { const e = urlEnde(text, i); if (e === -1) break; if (e) i = e - 1; }
    else if (z === zeichen) { teile.push(text.slice(start, i)); start = i + 1; }
  }
  teile.push(text.slice(start));
  return teile;
}

/** Index des ersten Doppelpunkts ausserhalb von Zeichenketten und Escapes; -1, wenn keiner. */
function ersterDoppelpunkt(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const z = text[i]!;
    if (z === '"' || z === "'") { const e = stringEnde(text, i); if (e < 0) return -1; i = e - 1; }
    else if (z === '\\') i++;
    else if (z === ':') return i;
  }
  return -1;
}

type Block = { selektor: string; dekl: string; verschachtelt: boolean };

/**
 * Blöcke mit ihren Deklarationen; verschachtelt = eine umgebende Regel ist eine Stilregel (CSS-Nesting), keine @-Regel.
 * Gleiche Lesart wie cssRegeln in scripts/versionen-regeln.mjs: Kommentare fallen beim Lesen weg, {, } und ; in Zeichenketten,
 * in ungequoteten url(data:…;base64,…) und nach einem Backslash gliedern nichts. Was sich nicht sicher lesen lässt
 * (offene Zeichenkette, offener Kommentar, offene oder überzählige Klammer), kommt als Text in fehler zurück; es wirft nie.
 */
function bloecke(css: string): { out: Block[]; fehler: string[] } {
  const out: Block[] = [];
  const fehler: string[] = [];
  const stapel: Array<{ selektor: string; dekl: string }> = [];
  let puffer = ''; let semi = -1;   // semi: Index des letzten ; auf oberster Ebene im Puffer
  for (let i = 0; i < css.length; i++) {
    const z = css[i]!;
    if (z === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2);
      if (e < 0) { fehler.push('Kommentar nicht geschlossen'); return { out, fehler }; }
      i = e + 1;
    } else if (z === '"' || z === "'") {
      const e = stringEnde(css, i);
      if (e < 0) { fehler.push('Zeichenkette nicht geschlossen'); return { out, fehler }; }
      puffer += css.slice(i, e); i = e - 1;
    } else if (z === '\\') { puffer += css.slice(i, i + 2); i++; }
    else if (z === '(' && urlEnde(css, i) !== null) {
      const e = urlEnde(css, i)!;
      if (e < 0) { fehler.push('«(» nicht geschlossen'); return { out, fehler }; }
      puffer += css.slice(i, e); i = e - 1;
    }
    else if (z === ';') { semi = puffer.length; puffer += z; }
    else if (z === '{') {
      if (stapel.length) stapel.at(-1)!.dekl += puffer.slice(0, semi + 1);
      stapel.push({ selektor: puffer.slice(semi + 1).trim(), dekl: '' });
      puffer = ''; semi = -1;
    } else if (z === '}') {
      const b = stapel.pop();
      if (b) out.push({ selektor: b.selektor, dekl: b.dekl + puffer, verschachtelt: stapel.some((e) => !e.selektor.startsWith('@')) });
      else fehler.push('«}» ohne öffnendes «{»');
      puffer = ''; semi = -1;
    } else puffer += z;
  }
  if (stapel.length) fehler.push('«{» nicht geschlossen');
  return { out, fehler };
}

/** Ein Befund je verletzter Deklaration; Selektoren innerhalb von @media werden einzeln geprüft. */
export function stilBefunde(css: string): string[] {
  const befunde: string[] = [];
  const { out, fehler } = bloecke(css);
  for (const { selektor, dekl, verschachtelt } of out) {
    for (const d of teileAn(dekl, ';').map((x) => x.trim()).filter(Boolean)) {
      const i = ersterDoppelpunkt(d);
      if (i < 0) continue;
      const roh = d.slice(0, i).trim();
      const eig = roh.toLowerCase();
      const wert = d.slice(i + 1).trim();
      const zitat = `«${selektor} { ${d.replace(/\s+/g, ' ')} }»`;
      if (roh.includes('\\')) { befunde.push(`Escape im Eigenschaftsnamen: ${zitat}`); continue; }
      const teile = ohnePaletteVerlaeufe(wert).replace(PALETTE_VAR, '').split(/[\s,]+/).filter(Boolean);
      if (eig.startsWith('--pal-')) befunde.push(`Palette-Token ausserhalb palette.css: ${zitat}`);
      if (/^text-decoration(-line)?$/.test(eig) && selektor !== '.kit-knopf'
        && !(teile.every((t) => t.toLowerCase() === 'none') && schlaegtKitSchutzNie(selektor, verschachtelt))
        && (!teile.some((t) => t.toLowerCase() === 'underline') || teile.some((t) => ANDERE_LINIE.test(t)))) {
        befunde.push(`Unterstreichung entfernt ausserhalb .kit-knopf: ${zitat}`);
      }
      if (OHNE_TRANSPARENT.test(eig) && teile.some((t) => t.toLowerCase() === 'transparent')) {
        befunde.push(`Text- oder Linienfarbe transparent: ${zitat}`);
      }
      if (FARB_EIGENSCHAFT.test(eig) && (FILTER.test(eig) ? dropShadowTeile(wert) : teile).some((t) => !ERLAUBT.test(t))) {
        befunde.push(`Farbe nicht aus der Palette: ${zitat}`);
      }
    }
  }
  return [...befunde, ...fehler.map((f) => `CSS nicht sicher lesbar: ${f}`)];
}
