// Spec #435 §4.4/§11.1 (Befund 4), Plan B12: Versions-Test = Export-Obermenge gegen eine gepinnte Basis.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fehlendeExporte, basisBefunde, integritaetAusLock, cssBefunde, normalisiereHtml, ausnahmenBefunde, htmlBefunde } from '../scripts/versionen-regeln.mjs';

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
