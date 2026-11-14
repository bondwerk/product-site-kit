// Spec #435 §4.4/§11.1 (Befund 4), Plan B12: Versions-Test = Export-Obermenge gegen eine gepinnte Basis.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fehlendeExporte, basisBefunde, integritaetAusLock, cssRegeln, cssBefunde, cssVergleiche, unwirksameAusnahmen, normalisiereHtml, ausnahmenBefunde, htmlBefunde } from '../scripts/versionen-regeln.mjs';

const BASIS = JSON.parse(readFileSync(new URL('../scripts/versions-basis.json', import.meta.url), 'utf8'));
const GUELTIG = `sha512-${'A'.repeat(86)}==`;

describe('Versions-Regeln', () => {
  it('Export-Obermenge: jeder alte Name in jedem alten Subpath bleibt', () => {
    expect(fehlendeExporte({ schema: ['a', 'b'] }, { schema: ['a', 'b', 'c'], lints: ['x'] })).toEqual([]);
    expect(fehlendeExporte({ schema: ['a', 'b'], lints: ['x'] }, { schema: ['a'] })).toEqual(['schema: b', 'lints: x']);
  });
  it('Basis: Version x.y.z und integrity sha512 in npm-Form, sonst Befund', () => {
    expect(basisBefunde({ version: '0.1.1', integrity: GUELTIG })).toEqual([]);
    expect(basisBefunde({ version: 'latest', integrity: GUELTIG })).toEqual(['versions-basis: version muss x.y.z sein']);
    expect(basisBefunde({ version: '0.1.1', integrity: 'sha1-abc' })).toEqual(['versions-basis: integrity muss sha512- mit 88 Zeichen Base64 sein']);
    expect(basisBefunde(BASIS)).toEqual([]);
  });
  it('integrity der installierten Basis kommt aus deren Lockfile', () => {
    expect(integritaetAusLock({ packages: { 'node_modules/@bondwerk/site-kit': { version: '0.1.1', integrity: 'sha512-x' } } })).toBe('sha512-x');
    expect(() => integritaetAusLock({ packages: {} })).toThrow('versions-test: @bondwerk/site-kit fehlt im Lockfile der Basis');
  });
});

// Spec #435 Phase 2 §8 (S5, Versions-Test Teil 2): CSS-Obermenge, normalisiertes HTML, versionierte Ausnahmedatei.
describe('Versions-Regeln Teil 2', () => {
  const AUSNAHME = (o: object) => ({ basis: '0.2.0', begruendung: 'Korrektur Kontrast', ...o });
  it('CSS-Obermenge: jede alte Regel wörtlich (Leerraum und Kommentare egal) im neuen CSS, auch in @media', () => {
    const alt = '/* k */ .a { color: var(--pal-x); }\n@media (max-width: 40rem) { .b { gap: 1rem; } }';
    expect(cssBefunde(alt, '.a{color:var(--pal-x);}  .neu { gap: 0; } @media (max-width: 40rem) {\n  .b {\n gap: 1rem;\n }\n}', [], '0.2.0')).toEqual([]);
    expect(cssBefunde(alt, '.a { color: var(--pal-y); } .b { gap: 1rem; }', [], '0.2.0'))
      .toEqual(['Regel fehlt: .a { color: var(--pal-x) }', 'Regel fehlt: @media (max-width: 40rem) { .b { gap: 1rem } }']);
  });
  it('CSS-Obermenge in Reihenfolge: alte Regeln als Teilfolge, neue dazwischen erlaubt, Umsortierung ist Befund', () => {
    const alt = '.a { gap: 0; } .b { gap: 1px; } .c { gap: 2px; }';
    expect(cssBefunde(alt, '.n { gap: 9px; } .a { gap: 0; } .m { gap: 8px; } .b { gap: 1px; } .c { gap: 2px; } .z { gap: 7px; }', [], '0.2.0')).toEqual([]);
    expect(cssBefunde(alt, '.a { gap: 0; } .c { gap: 2px; } .b { gap: 1px; }', [], '0.2.0')).toEqual(['Regel ausser Reihenfolge: .c { gap: 2px }']);
  });
  it('CSS: eine Ausnahme gilt nur für genau ihre Regel und genau ihre Basisversion', () => {
    const alt = '.a { color: var(--pal-x); } .b { gap: 1rem; }';
    expect(cssBefunde(alt, '', [AUSNAHME({ regel: '.a { color: var(--pal-x) }' })], '0.2.0')).toEqual(['Regel fehlt: .b { gap: 1rem }']);
    expect(cssBefunde(alt, '', [AUSNAHME({ basis: '0.1.1', regel: '.a { color: var(--pal-x) }' })], '0.2.0'))
      .toEqual(['Regel fehlt: .a { color: var(--pal-x) }', 'Regel fehlt: .b { gap: 1rem }']);
  });
  it('CSS: ohne Regeln in der Basis kein stilles Grün', () => {
    expect(cssBefunde('/* leer */', '.a { gap: 0; }', [], '0.2.0')).toEqual(['Basis ohne Regeln: Vergleich leer']);
  });
  it('HTML: Asset-Namen ohne Hash, sonst unverändert', () => {
    expect(normalisiereHtml('<link rel="stylesheet" href="/_astro/_seite_.B3kx9_aZ.css"><img src="/_astro/laden.Dq-7aB12.webp">'))
      .toBe('<link rel="stylesheet" href="/_astro/_seite_.css"><img src="/_astro/laden.webp">');
    expect(normalisiereHtml('<p>a.b.c</p>')).toBe('<p>a.b.c</p>');
  });
  it('HTML: je Seite gleich nach Normalisierung, fehlende oder abweichende Seite ist Befund, Ausnahme je Seite und Basis', () => {
    const alt = { basis: '<a href="/_astro/x.AAAAAAAA.css">', zwei: '<p>2</p>', drei: '<p>3</p>' };
    const neu = { basis: '<a href="/_astro/x.BBBBBBBB.css">', zwei: '<p>zwei</p>', neu: '<p>n</p>' };
    expect(htmlBefunde(alt, neu, [], '0.2.0')).toEqual(['HTML weicht ab: zwei', 'Seite fehlt: drei']);
    expect(htmlBefunde(alt, neu, [AUSNAHME({ seite: 'zwei' }), AUSNAHME({ basis: '0.1.1', seite: 'drei' })], '0.2.0')).toEqual(['Seite fehlt: drei']);
  });
  it('HTML: ohne Seiten in der Basis kein stilles Grün', () => {
    expect(htmlBefunde({}, { a: '<p>' }, [], '0.2.0')).toEqual(['Basis ohne Seiten: Vergleich leer']);
  });
  it('Ausnahmedatei: Liste von Einträgen mit Basis x.y.z, genau einem von regel/seite und Begründung', () => {
    expect(ausnahmenBefunde([])).toEqual([]);
    expect(ausnahmenBefunde([AUSNAHME({ regel: '.a { gap: 0 }' }), AUSNAHME({ seite: 'basis' })])).toEqual([]);
    expect(ausnahmenBefunde({})).toEqual(['versions-ausnahmen: muss eine Liste sein']);
    expect(ausnahmenBefunde([AUSNAHME({ basis: 'latest', regel: '.a {}' })])).toEqual(['versions-ausnahmen[0]: basis muss x.y.z sein']);
    expect(ausnahmenBefunde([AUSNAHME({ begruendung: ' ', seite: 'x' })])).toEqual(['versions-ausnahmen[0]: begruendung fehlt']);
    expect(ausnahmenBefunde([AUSNAHME({})])).toEqual(['versions-ausnahmen[0]: genau eines von regel oder seite']);
    expect(ausnahmenBefunde([AUSNAHME({ regel: '.a {}', seite: 'x' })])).toEqual(['versions-ausnahmen[0]: genau eines von regel oder seite']);
  });
  it('die eingecheckte Ausnahmedatei ist gültig', () => {
    expect(ausnahmenBefunde(JSON.parse(readFileSync(new URL('../scripts/versions-ausnahmen.json', import.meta.url), 'utf8')))).toEqual([]);
  });
});

// Issue #4 Punkt 6: cssRegeln bricht nicht an {, } oder ; in Strings, Kommentare und Strings schliessen sich nicht gegenseitig auf.
describe('cssRegeln — Strings, Kommentare, Escapes (Issue #4 Punkt 6)', () => {
  const FAELLE: Array<[string, string, string[]]> = [
    ['leer', '', []],
    ['nur Kommentar', '/* a { b } */', []],
    ['} im String', '.a { content: "}"; color: red; }', ['.a { content: "}"; color: red }']],
    ['{ im String', '.a { content: "{ x"; gap: 0; }', ['.a { content: "{ x"; gap: 0 }']],
    ['; im String', '.a { content: "a;b"; gap: 0; }', ['.a { content: "a;b"; gap: 0 }']],
    ['einfache Anführungszeichen', ".a { content: '};{'; gap: 0; }", [".a { content: '};{'; gap: 0 }"]],
    ['Escape \\" im String', '.a { content: "a\\"}b"; gap: 0; }', ['.a { content: "a\\"}b"; gap: 0 }']],
    ['Backslash-Backslash schliesst den String', '.a { content: "\\\\"; gap: 0; } .b { gap: 1px; }', ['.a { content: "\\\\"; gap: 0 }', '.b { gap: 1px }']],
    ['Kommentarzeichen im String bleiben', '.a { content: "/* x */"; gap: 0; }', ['.a { content: "/* x */"; gap: 0 }']],
    ['Anführungszeichen im Kommentar öffnen keinen String', '.a { /* " */ gap: 0; } .b { gap: 1px; }', ['.a { gap: 0 }', '.b { gap: 1px }']],
    ['Kommentar nach String', '.a { content: "x"; /* } */ gap: 0; }', ['.a { content: "x"; gap: 0 }']],
    ['Attribut-String im Selektor', 'a[href="}"] { gap: 0; } .b { gap: 1px; }', ['a[href="}"] { gap: 0 }', '.b { gap: 1px }']],
    ['Doppelpunkt im String trennt nicht', '.a { content: "a: b"; }', ['.a { content: "a: b" }']],
    ['Leerraum im String bleibt, ausserhalb wird kollabiert', '.a   {  content:   "a   b";  }', ['.a { content: "a   b" }']],
    ['ungequotetes url() mit ; und }', '.a { background-image: url(data:image/svg+xml;base64,AA}A); gap: 0; }', ['.a { background-image: url(data:image/svg+xml;base64,AA}A); gap: 0 }']],
    ['String in @media-Kopf', '@media (min-width: 1px) { .a { content: "}"; } }', ['@media (min-width: 1px) { .a { content: "}" } }']],
    ['@import mit ; im String endet vor dem Block, der Kopf bleibt .a', '@import "a;b.css"; .a { gap: 0; }', ['.a { gap: 0 }']],
    ['Escape ausserhalb eines Strings schützt die Klammer', '.a\\{b { gap: 0; }', ['.a\\{b { gap: 0 }']],
  ];
  it.each(FAELLE)('%s', (_name, css, soll) => {
    expect(cssRegeln(css)).toEqual(soll);
  });
  it('Fehlerpfad: nicht geschlossener String oder Kommentar wirft statt still falsch zu lesen', () => {
    expect(() => cssRegeln('.a { content: "x; }')).toThrow('cssRegeln: Zeichenkette nicht geschlossen');
    expect(() => cssRegeln(".a { content: 'x; }")).toThrow('cssRegeln: Zeichenkette nicht geschlossen');
    expect(() => cssRegeln('.a { gap: 0; } /* offen')).toThrow('cssRegeln: Kommentar nicht geschlossen');
    expect(() => cssRegeln('.a { background-image: url(x; } .b { gap: 0; }')).toThrow('cssRegeln: Klammer nicht geschlossen');
  });
  it('der Vergleich sieht eine Regel mit } im String als eine Regel', () => {
    const alt = '.a { content: "}"; gap: 0; } .b { gap: 1px; }';
    expect(cssBefunde(alt, alt, [], '0.2.0')).toEqual([]);
    expect(cssBefunde(alt, '.a { content: "}"; gap: 9px; } .b { gap: 1px; }', [], '0.2.0')).toEqual(['Regel fehlt: .a { content: "}"; gap: 0 }']);
  });
});

// Issue #4 Punkt 5: eine Ausnahme, die im Lauf keine Abweichung deckt, ist ein Befund.
describe('unwirksameAusnahmen (Issue #4 Punkt 5)', () => {
  const A = (o: object) => ({ basis: '0.2.0', begruendung: 'Korrektur', ...o });
  const ALT = '.a { gap: 0; } .b { gap: 1px; } .c { gap: 2px; }';
  const SEITEN = { alt: { x: '<p>1</p>', y: '<p>2</p>' }, neu: { x: '<p>1</p>', y: '<p>zwei</p>' } };
  const lauf = (ausnahmen: object[], neuCss = '.b { gap: 1px; } .c { gap: 2px; }', basis = '0.2.0', paare: Array<[string, string]> = [[ALT, neuCss]]) =>
    unwirksameAusnahmen(ausnahmen, basis, { css: paare, html: [SEITEN.alt, SEITEN.neu] });
  const REGEL_A = '.a { gap: 0 }';
  it('leere Liste: kein Befund', () => {
    expect(lauf([])).toEqual([]);
  });
  it('Regel-Ausnahme: wirksam, wenn die Regel im neuen CSS fehlt oder ausser Reihenfolge steht', () => {
    expect(lauf([A({ regel: REGEL_A })])).toEqual([]);
    expect(lauf([A({ regel: '.c { gap: 2px }' })], '.a { gap: 0; } .c { gap: 2px; } .b { gap: 1px; }')).toEqual([]);
  });
  it('Regel-Ausnahme ohne Wirkung: Regel steht in Ordnung im neuen CSS, nie in der Basis, oder anderer Leerraum (nicht normalisiert)', () => {
    const NICHTS = (i: number, r: string) => `versions-ausnahmen[${i}]: Regel ohne Wirkung, deckt keine Abweichung: ${r}`;
    expect(lauf([A({ regel: REGEL_A })], '.a { gap: 0; } .b { gap: 1px; } .c { gap: 2px; }')).toEqual([NICHTS(0, REGEL_A)]);
    expect(lauf([A({ regel: '.zz { gap: 3px }' })])).toEqual([NICHTS(0, '.zz { gap: 3px }')]);
    expect(lauf([A({ regel: '.a {gap:0}' })])).toEqual([NICHTS(0, '.a {gap:0}')]);
  });
  it('mehrere Ausnahmen: nur die unwirksame wird gemeldet, mit ihrem Index', () => {
    expect(lauf([A({ regel: REGEL_A }), A({ regel: '.c { gap: 2px }' }), A({ seite: 'y' })]))
      .toEqual(['versions-ausnahmen[1]: Regel ohne Wirkung, deckt keine Abweichung: .c { gap: 2px }']);
  });
  it('Seiten-Ausnahme: wirksam bei abweichender oder fehlender Seite, sonst Befund', () => {
    const NICHTS = (i: number, s: string) => `versions-ausnahmen[${i}]: Seite ohne Wirkung, deckt keine Abweichung: ${s}`;
    expect(lauf([A({ seite: 'y' })])).toEqual([]);
    expect(lauf([A({ seite: 'x' })])).toEqual([NICHTS(0, 'x')]);
    expect(lauf([A({ seite: 'gibtesnicht' })])).toEqual([NICHTS(0, 'gibtesnicht')]);
    expect(unwirksameAusnahmen([A({ seite: 'y' })], '0.2.0', { css: [], html: [{ y: '<p>2</p>' }, {}] })).toEqual([]);
  });
  it('Ausnahme für eine andere Basisversion wirkt nie und ist ein Befund', () => {
    expect(lauf([A({ basis: '0.1.1', regel: REGEL_A })])).toEqual(['versions-ausnahmen[0]: gilt für Basis 0.1.1, die aktuelle Basis ist 0.2.0']);
    expect(lauf([A({ basis: '0.1.1', seite: 'y' })])).toEqual(['versions-ausnahmen[0]: gilt für Basis 0.1.1, die aktuelle Basis ist 0.2.0']);
  });
  it('mit zwei CSS-Dateien genügt die Wirkung in einer', () => {
    const ok = [[ALT, '.a { gap: 0; } .b { gap: 1px; } .c { gap: 2px; }'], [ALT, '.b { gap: 1px; } .c { gap: 2px; }']] as Array<[string, string]>;
    expect(lauf([A({ regel: REGEL_A })], '', '0.2.0', ok)).toEqual([]);
    expect(lauf([A({ regel: REGEL_A })], '', '0.2.0', [ok[0]!])).toHaveLength(1);
  });
  it('kaputte Einträge meldet ausnahmenBefunde; hier kein Doppelbefund und kein Absturz', () => {
    expect(lauf([A({}), null as unknown as object, 'x' as unknown as object])).toEqual([]);
  });
});

// Issue #4 Punkt 4: palette.vorlage.css wird wie kit.css gegen die Basis verglichen.
describe('cssVergleiche — kit.css und palette.vorlage.css (Issue #4 Punkt 4)', () => {
  const VORLAGE_ALT = ':root { --pal-seite-bg: #ffffff; --pal-seite-text: #1a1a1a; }';
  const KIT = ['.a { gap: 0; }', '.a { gap: 0; } .neu { gap: 1px; }'] as [string, string];
  const paare = (vorlageNeu: string) => ({ 'kit.css': KIT, 'palette.vorlage.css': [VORLAGE_ALT, vorlageNeu] as [string, string] });
  it('gleiche Vorlage und Zusätze: kein Befund', () => {
    expect(cssVergleiche(paare(VORLAGE_ALT), [], '0.2.0')).toEqual([]);
    expect(cssVergleiche(paare(`/* neu */ ${VORLAGE_ALT} .neu { gap: 0; }`), [], '0.2.0')).toEqual([]);
  });
  it('geänderter Wert, entferntes Token oder anderes Token: Befund mit Dateinamen', () => {
    const F = (r: string) => [`palette.vorlage.css: Regel fehlt: ${r}`];
    const ALT_REGEL = ':root { --pal-seite-bg: #ffffff; --pal-seite-text: #1a1a1a }';
    expect(cssVergleiche(paare(':root { --pal-seite-bg: #fffffe; --pal-seite-text: #1a1a1a; }'), [], '0.2.0')).toEqual(F(ALT_REGEL));
    expect(cssVergleiche(paare(':root { --pal-seite-bg: #ffffff; }'), [], '0.2.0')).toEqual(F(ALT_REGEL));
    expect(cssVergleiche(paare(''), [], '0.2.0')).toEqual(F(ALT_REGEL));
  });
  it('kit.css-Befunde tragen ihren Dateinamen, beide Dateien werden gemeldet', () => {
    expect(cssVergleiche({ 'kit.css': ['.a { gap: 0; }', ''], 'palette.vorlage.css': [VORLAGE_ALT, ''] }, [], '0.2.0'))
      .toEqual(['kit.css: Regel fehlt: .a { gap: 0 }', 'palette.vorlage.css: Regel fehlt: :root { --pal-seite-bg: #ffffff; --pal-seite-text: #1a1a1a }']);
  });
  it('Ausnahme je Regel und Basis gilt auch für die Vorlage; leere Basis-Vorlage ist Befund', () => {
    const ALT_REGEL = ':root { --pal-seite-bg: #ffffff; --pal-seite-text: #1a1a1a }';
    expect(cssVergleiche(paare(''), [{ basis: '0.2.0', regel: ALT_REGEL, begruendung: 'x' }], '0.2.0')).toEqual([]);
    expect(cssVergleiche(paare(''), [{ basis: '0.1.1', regel: ALT_REGEL, begruendung: 'x' }], '0.2.0')).toHaveLength(1);
    expect(cssVergleiche({ 'kit.css': KIT, 'palette.vorlage.css': ['/* leer */', VORLAGE_ALT] }, [], '0.2.0')).toEqual(['palette.vorlage.css: Basis ohne Regeln: Vergleich leer']);
  });
});

// Verdrahtungs-Wache: die Prüfungen laufen im Versions-Test der CI (node scripts/versions-test.mjs), der selbst Netz braucht.
describe('versions-test.mjs ruft die Prüfungen auf (Issue #4)', () => {
  const SKRIPT = readFileSync(new URL('../scripts/versions-test.mjs', import.meta.url), 'utf8');
  it('beide Stylesheets und die Ausnahmen-Prüfung mit den Ergebnissen beider Vergleiche', () => {
    expect(SKRIPT).toContain("const STILE = ['kit.css', 'palette.vorlage.css'];");
    expect(SKRIPT).toContain('befunde.push(...cssVergleiche(cssPaare, ausnahmen, basis.version));');
    expect(SKRIPT).toContain('befunde.push(...unwirksameAusnahmen(ausnahmen, basis.version, { css: Object.values(cssPaare), html: [altSeiten, neuSeiten] }));');
  });
});
