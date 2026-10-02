export type InlineArt = 'script' | 'handler' | 'style-block' | 'style-attr';

const MUSTER: ReadonlyArray<readonly [InlineArt, RegExp]> = [
  // src/type nur als echte Attribute (Whitespace davor): data-src/data-type machen kein externes Script.
  ['script', /<script\b(?![^>]*\ssrc\s*=)(?![^>]*\stype\s*=\s*["']?application\/ld\+json)[^>]*>/i],
  ['handler', /<[a-z][a-z0-9-]*\b[^>]*\son[a-z]+\s*=/i],
  ['style-block', /<style\b/i],
  ['style-attr', /<[a-z][a-z0-9-]*\b[^>]*\sstyle\s*=/i],
];

/** Welche Arten Inline-Code stehen im HTML? Je Art höchstens ein Eintrag, in fester Reihenfolge. */
export function inlineBefunde(html: string): InlineArt[] {
  return MUSTER.filter(([, re]) => re.test(html)).map(([art]) => art);
}
