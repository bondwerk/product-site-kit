// Spec #435 §4.4/§11.1 (Befund 4), Plan B12: Versions-Test = Export-Obermenge gegen eine gepinnte Basis.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fehlendeExporte, basisBefunde, integritaetAusLock } from '../scripts/versionen-regeln.mjs';

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
