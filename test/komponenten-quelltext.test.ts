// Spec #435 §7.2: Kit-Komponenten ohne style=, ohne <style>/<script>, ohne set:html; Normalwerte aus den Daten.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = fileURLToPath(new URL('../src/komponenten', import.meta.url));
const dateien = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(d, e.name)) : [join(d, e.name)]));

describe('Komponenten-Quelltext', () => {
  it('genau die geplanten Komponenten', () => {
    expect(dateien(WURZEL).map((p) => p.slice(WURZEL.length + 1)).sort()).toEqual(['Abschnitt.astro', 'Abschnitte.astro', 'Link.astro',
      'varianten/BildText.astro', 'varianten/CtaBand.astro', 'varianten/Faq.astro', 'varianten/Karten.astro', 'varianten/Text.astro']);
  });
  it('kein style=, <style>, <script>, set:html, is:inline, set:text, innerHTML, Fragment', () => {
    for (const p of dateien(WURZEL)) expect(readFileSync(p, 'utf8'), p).not.toMatch(/\sstyle\s*=|<style\b|<script\b|set:html|set:text|is:inline|innerHTML|<Fragment\b/i);
  });
  it('Abschnitt.astro liest Normalwerte aus den Daten, nicht aus Wertlisten', () => {
    const s = readFileSync(join(WURZEL, 'Abschnitt.astro'), 'utf8');
    expect(s).toMatch(/from '\.\.\/schema\/gestaltung\.js'/);
    expect(s).toContain('normalwerte[');
    expect(s).toContain('bildpositionNormal[');
    expect(s).not.toMatch(/stufen\./);
  });
});
