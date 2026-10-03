// Spec #435 §7.1/§7.2, Plan B1: Paletten-Format und Kontrast. Kein node:* (wird auch in Tests der Sites genutzt).
import { FLAECHEN, kontrastBefunde } from './kontrast.js';

export const PFLICHT_TOKENS: readonly string[] = [...FLAECHEN.flatMap((f) => [`${f}-bg`, `${f}-text`, `${f}-link`]), 'akzentlinie', 'rahmen'];
export const OPTIONALE_TOKENS: readonly string[] = FLAECHEN.flatMap((f) => [`${f}-knopf-bg`, `${f}-knopf-text`]);
/** Fallback eines optionalen Tokens auf ein bestehendes (Spec §4.4); kit.css schreibt dieselben Paare. */
export const FALLBACK: Readonly<Record<string, string>> = Object.fromEntries(FLAECHEN.flatMap((f) => [[`${f}-knopf-bg`, `${f}-text`], [`${f}-knopf-text`, `${f}-bg`]]));

export function lesePalette(css: string): { werte: Record<string, string>; befunde: string[] } {
  const ohneKommentar = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /^\s*:root\s*\{([^{}]*)\}\s*$/.exec(ohneKommentar);
  if (!m) return { werte: {}, befunde: ['palette.css: genau ein :root-Block und sonst nichts'] };
  const werte: Record<string, string> = {};
  const befunde: string[] = [];
  for (const roh of m[1]!.split(';').map((d) => d.trim()).filter(Boolean)) {
    const d = /^--pal-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})$/.exec(roh);
    if (!d) { befunde.push(`palette.css: unerlaubte Deklaration «${roh.replace(/\s+/g, ' ')}»`); continue; }
    const [, token, wert] = d as unknown as [string, string, string];
    if (!PFLICHT_TOKENS.includes(token) && !OPTIONALE_TOKENS.includes(token)) { befunde.push(`palette.css: unbekanntes Token --pal-${token}`); continue; }
    if (token in werte) { befunde.push(`palette.css: Token doppelt --pal-${token}`); continue; }
    werte[token] = wert.toLowerCase();
  }
  for (const t of PFLICHT_TOKENS) if (!(t in werte) && !befunde.some((b) => b.includes(`--pal-${t}:`))) befunde.push(`palette.css: Pflicht-Token fehlt --pal-${t}`);
  return { werte, befunde };
}

/** Format zuerst; nur ein formal gültige Palette wird auf Kontrast geprüft (Fallbacks aufgelöst). */
export function paletteBefunde(css: string): string[] {
  const { werte, befunde } = lesePalette(css);
  if (befunde.length) return befunde;
  const wirksam = { ...werte };
  for (const [opt, ziel] of Object.entries(FALLBACK)) wirksam[opt] ??= wirksam[ziel]!;
  return kontrastBefunde(wirksam);
}
