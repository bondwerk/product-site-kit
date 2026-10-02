import { describe, expect, it } from 'vitest';
import { sichererText, sichererTextFuer } from '../src/schema/index.js';

describe('sichererText', () => {
  it('lehnt fremde URLs, Schemes und E-Mails ab, lässt Text und Telefon durch', () => {
    const t = sichererText(80);
    for (const schlecht of ['https://fremd.example/x', 'www.fremd.example', 'shop.andere.example.ch', '//boese.example', 'javascript:alert(1)',
      'kontakt@example.xyz', '[hier](https://fremd.example)', 'x'.repeat(81)]) {
      expect(t.safeParse(schlecht).success, schlecht).toBe(false);
    }
    for (const gut of ['Über uns seit 1998.', 'Tel. 044 123 45 67', 'Satzende.Ort beginnt neu']) {
      expect(t.safeParse(gut).success, gut).toBe(true);
    }
  });
  it('sichererTextFuer lässt die eigenen Adressen zu, fremde nicht', () => {
    const t = sichererTextFuer(['kurs.example.ch'])(200);
    for (const gut of ['Mehr auf www.kurs.example.ch', 'Anmeldung unter https://kurs.example.ch/kurse', 'Schreib an info@kurs.example.ch']) {
      expect(t.safeParse(gut).success, gut).toBe(true);
    }
    for (const schlecht of ['Mehr auf fake-kurs.example.ch', 'Schreib an anna@kurs.example.chx', 'Mehr auf www.andere.example.ch']) {
      expect(t.safeParse(schlecht).success, schlecht).toBe(false);
    }
  });
  it('eigene Domain gilt nicht als Präfix einer fremden Domain', () => {
    const t = sichererTextFuer(['example.ch'])(200);
    for (const schlecht of ['Mehr auf https://example.ch.ru/x', 'Mehr auf https://example.ch.evil.example/x', 'Schreib an info@example.ch.ru',
      '[hier](https://example.ch.ru/x)', '[hier](https://example.ch.evil.example/x)']) {
      expect(t.safeParse(schlecht).success, schlecht).toBe(false);
    }
    for (const gut of ['Mehr auf https://example.ch/x', 'Besuch uns auf example.ch.', 'Schreib an info@example.ch', '[hier](https://example.ch/kurse)']) {
      expect(t.safeParse(gut).success, gut).toBe(true);
    }
  });
  it('eigene Adressen sind Daten, kein Muster: Regex-Zeichen werden escaped', () => {
    const t = sichererTextFuer(['info+kurs@example.ch'])(200);
    expect(t.safeParse('Schreib an info+kurs@example.ch').success).toBe(true);
    expect(t.safeParse('Schreib an infoookurs@example.ch').success).toBe(false);
  });
});
