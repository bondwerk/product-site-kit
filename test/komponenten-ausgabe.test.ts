// Spec #435 §11.1 (Befund 4): Byte-Identität nur innerhalb derselben Kit-Version — Nullwert-Test; Wirkungs-Test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distAbdruck } from './helfer/abdruck.js';
import { normalwerte, bildpositionNormal, stufen } from '../src/schema/gestaltung.js';

const KIT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE = join(KIT, 'test/fixture-site');
// Isolation: Builds laufen mit cwd und outDir in der Fixture (gitignored, gleiches Dateisystem wie .astro/.prerender;
// Astro verschiebt Assets per rename, /tmp wäre ein anderes Gerät). Nichts landet im Repo-Root.
const BAU = join(FIXTURE, 'node_modules', '.kit-fixture');
mkdirSync(BAU, { recursive: true });
const tmp = mkdtempSync(join(BAU, 'lauf-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function baue(name: string, seiten: Record<string, object[]>): string {
  const json = join(tmp, `${name}.json`);
  writeFileSync(json, JSON.stringify(seiten));
  const ziel = join(tmp, name);
  execFileSync('npx', ['astro', 'build', '--root', FIXTURE, '--outDir', ziel], { cwd: FIXTURE, stdio: 'pipe', env: { ...process.env, KIT_WURZEL: KIT, KIT_FIXTURE: json } });
  return ziel;
}

/** Ein Abschnitt je Variante, mit IDs, ohne Gestaltungsfelder. */
const BASIS = [
  { variante: 'text', id: 'a-0000000001', titel: 'Über uns', lead: 'Seit 1998.', absaetze: ['Grünwerk am Feldweg 3.'] },
  { variante: 'bildText', id: 'a-0000000002', titel: 'Laden', bild: 'bilder/laden.webp', bildAlt: 'Ladenlokal', absaetze: ['Hell und freundlich.'] },
  { variante: 'faq', id: 'a-0000000003', titel: 'Fragen', fragen: [{ frage: 'Wann offen?', antwort: 'Montag bis Freitag.' }] },
  { variante: 'karten', id: 'a-0000000004', karten: [{ titel: 'Kurs', text: 'Für alle.', bild: 'bilder/kurs.webp', bildAlt: 'Kurs', link: '/kurse', linkLabel: 'Mehr' },
    { titel: 'Partner', link: 'https://example.ch/kurse', linkLabel: 'Kurse' }] },
  { variante: 'ctaBand', id: 'a-0000000005', text: 'Fragen?', knopf: { label: 'Anfragen', ziel: '#kontakt' } },
];
/** Dieselben Abschnitte, jedes Feld auf seinem Normalwert — aus den Daten gelesen, nicht abgeschrieben. */
const NORMAL = BASIS.map((a) => ({ ...a, ...normalwerte, ...(a.variante in bildpositionNormal ? { bildposition: bildpositionNormal[a.variante as keyof typeof bildpositionNormal] } : {}) }));

describe('distAbdruck', () => {
  it('Pfad → sha256 aller Dateien, sortiert', () => {
    const d = mkdtempSync(join(tmp, 'abdruck-'));
    writeFileSync(join(d, 'b.txt'), 'b');
    writeFileSync(join(d, 'a.txt'), 'a');
    expect(distAbdruck(d)).toEqual({
      'a.txt': 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
      'b.txt': '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
    });
  });
});

describe('Komponenten-Ausgabe (gebaut, Spec §11.1)', () => {
  let leer: string, normal: string, wirkung: string;
  const FAELLE: Array<[string, string, number]> = [];   // [feld, wert, Index in BASIS]
  for (const [feld, werte] of Object.entries(stufen)) for (const w of werte) {
    if (feld === 'bildposition') { for (const i of [1, 3]) if (w !== bildpositionNormal[BASIS[i]!.variante as keyof typeof bildpositionNormal]) FAELLE.push([feld, w, i]); continue; }
    if (w !== (normalwerte as Record<string, unknown>)[feld]) FAELLE.push([feld, w, 0]);
  }
  beforeAll(() => {
    leer = baue('leer', { basis: BASIS });
    normal = baue('normal', { basis: NORMAL });
    const seiten: Record<string, object[]> = { basis: BASIS, 'aus-sichtbar': BASIS.map((a, i) => (i === 2 ? { ...a, sichtbar: false } : a)) };
    for (const [feld, w, i] of FAELLE) seiten[`w-${feld}-${w}-${i}`] = BASIS.map((a, j) => (j === i ? { ...a, [feld]: w } : a));
    wirkung = baue('wirkung', seiten);
  }, 300_000);
  const html = (d: string, s: string) => readFileSync(join(d, s, 'index.html'), 'utf8');

  it('Nullwert: ohne Felder und mit jedem Feld auf normalwert ist dist/ byte-gleich (gleiche Kit-Version)', () => {
    expect(distAbdruck(normal)).toEqual(distAbdruck(leer));
    expect(html(leer, 'basis')).toContain('data-abschnitt-id="a-0000000003"');
    expect(html(leer, 'basis')).not.toMatch(/data-(breite|betonung|farbe|titelgroesse|ausrichtung|abstand|bildposition)=/);
  });
  it('Wirkung: jeder Nicht-Normalwert ändert das HTML genau um sein Attribut', () => {
    const basis = html(wirkung, 'basis');
    for (const [feld, w, i] of FAELLE) {
      const h = html(wirkung, `w-${feld}-${w}-${i}`);
      const attr = ` data-${feld}="${w}"`;
      expect(h.split(attr).length - 1, `${feld}=${w}`).toBe(1);
      expect(h.replace(attr, ''), `${feld}=${w}`).toBe(basis);
    }
  });
  it('sichtbar:false lässt genau diesen Abschnitt weg; CSS ist in allen Builds dasselbe; nichts inline', () => {
    const h = html(wirkung, 'aus-sichtbar');
    expect(h).not.toContain('a-0000000003');
    for (const id of ['a-0000000001', 'a-0000000002', 'a-0000000004', 'a-0000000005']) expect(h).toContain(id);
    const css = (d: string) => Object.fromEntries(Object.entries(distAbdruck(d)).filter(([p]) => p.endsWith('.css')));
    expect(Object.keys(css(leer)).length).toBeGreaterThan(0);
    expect(css(wirkung)).toEqual(css(leer));
    expect(html(leer, 'basis')).not.toMatch(/<style\b|\sstyle=/);
  });
  it('interner Link ohne target und rel, Knopf als .kit-knopf, externer Link mit target und rel', () => {
    const h = html(leer, 'basis');
    // intern: weder target noch rel (genau diese Anker-Tags, nichts dazwischen)
    expect(h).toMatch(/<a href="\/kurse">Mehr<\/a>/);
    expect(h).toMatch(/<a href="#kontakt" class="kit-knopf">Anfragen<\/a>/);
    // extern https: target="_blank" UND rel="noopener noreferrer"
    expect(h).toMatch(/<a href="https:\/\/example\.ch\/kurse" target="_blank" rel="noopener noreferrer">Kurse<\/a>/);
    // je genau einmal im ganzen Dokument: nur der externe Link trägt beides
    expect(h.split('target="_blank"').length - 1).toBe(1);
    expect(h.split('rel="noopener noreferrer"').length - 1).toBe(1);
    expect(h).not.toMatch(/<a href="(\/|#)[^>]*\s(target|rel)=/);
  });
});
