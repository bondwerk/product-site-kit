// Spec #435 §6.1/§6.2: Stufen, Normalwerte und Kundenwörter sind Daten; Erwartungen aus der Spec-Tabelle.
import { describe, expect, it } from 'vitest';
import { GESTALTUNGSFELDER, stufen, normalwerte, bildpositionNormal, kundenwoerter, beschreibung, gestaltungsfelder } from '../src/schema/gestaltung.js';

const SPEC = {
  breite: { werte: ['normal', 'voll'], normal: 'normal', label: 'Breite des Abschnitts', woerter: ['über die ganze Breite', 'breiter', 'nicht so schmal'] },
  betonung: { werte: ['normal', 'hervorgehoben', 'kasten'], normal: 'normal', label: 'Hervorhebung', woerter: ['hervorheben', 'auffälliger', 'einrahmen', 'als Kasten'] },
  farbe: { werte: ['standard', 'hell', 'akzent', 'dunkel'], normal: 'standard', label: 'Hintergrundfarbe', woerter: ['farbig', 'in unserer Farbe', 'dunkel hinterlegt', 'heller Hintergrund'] },
  titelgroesse: { werte: ['klein', 'normal', 'gross'], normal: 'normal', label: 'Grösse der Überschrift', woerter: ['grösser', 'kleiner', 'dezenter'] },
  ausrichtung: { werte: ['links', 'zentriert'], normal: 'links', label: 'Ausrichtung', woerter: ['zentriert', 'in die Mitte', 'linksbündig'] },
  abstand: { werte: ['eng', 'normal', 'weit'], normal: 'normal', label: 'Abstand', woerter: ['mehr Luft', 'enger zusammen', 'weniger Abstand'] },
  bildposition: { werte: ['links', 'rechts', 'oben'], normal: undefined, label: 'Position des Bilds', woerter: ['Bild links', 'Bild rechts', 'Bild über dem Text'] },
  sichtbar: { werte: ['true', 'false'], normal: true, label: 'Sichtbarkeit', woerter: ['ausblenden', 'vorerst ausblenden'] },
} as const;
const WERT_LABEL: Record<string, Record<string, string>> = {
  breite: { voll: 'über die ganze Breite' }, betonung: { hervorgehoben: 'hervorgehoben', kasten: 'als Kasten' },
  farbe: { hell: 'hell hinterlegt', akzent: 'in der Hausfarbe', dunkel: 'dunkel hinterlegt' }, titelgroesse: { gross: 'gross', klein: 'klein' },
  ausrichtung: { zentriert: 'zentriert', links: 'linksbündig' }, abstand: { weit: 'mehr Abstand', eng: 'weniger Abstand' },
  bildposition: { links: 'links', rechts: 'rechts', oben: 'über dem Text' }, sichtbar: { false: 'ausgeblendet' },
};

describe('Gestaltung als Daten (Spec §6.1, §6.2)', () => {
  it('Felder, Werte in Reihenfolge und Normalwerte wie in der Spec', () => {
    expect([...GESTALTUNGSFELDER]).toEqual(Object.keys(SPEC));
    for (const [feld, s] of Object.entries(SPEC)) {
      if (feld !== 'sichtbar') expect([...(stufen as Record<string, readonly string[]>)[feld]!], feld).toEqual(s.werte);
      if (feld !== 'bildposition') expect((normalwerte as Record<string, unknown>)[feld], feld).toBe(s.normal);
    }
    expect(bildpositionNormal).toEqual({ bildText: 'links', karten: 'oben' });
  });
  it('Feld-Labels, Wert-Labels und Kundenwörter wie in der Spec-Tabelle §6.2', () => {
    for (const [feld, s] of Object.entries(SPEC)) {
      const k = kundenwoerter[feld as keyof typeof kundenwoerter];
      expect(k.label, feld).toBe(s.label);
      expect(Object.keys(k.werte), feld).toEqual(s.werte.map(String));
      expect(Object.values(k.werte).flatMap((w) => w.kundenwoerter).sort(), feld).toEqual([...s.woerter].sort());
      for (const [wert, label] of Object.entries(WERT_LABEL[feld]!)) expect(k.werte[wert]!.label, `${feld}=${wert}`).toBe(label);
    }
  });
  it('F3: „fetter", „dicker" → titelgroesse gross mit dem Ersatz-Satz der Spec', () => {
    expect(kundenwoerter.titelgroesse.ersatz).toEqual([{ kundenwoerter: ['fetter', 'dicker'], art: 'ersatz', wert: 'gross',
      satz: '‚Fetter‘ gibt es nicht als eigene Einstellung; wir haben die Überschrift grösser gemacht.' }]);
  });
  it('O6: „entfernen", „weg", „raus" blenden nicht aus, sondern lösen eine Rückfrage aus', () => {
    expect(kundenwoerter.sichtbar.werte.false!.kundenwoerter).toEqual(['ausblenden', 'vorerst ausblenden']);
    expect(kundenwoerter.sichtbar.ersatz).toEqual([{ kundenwoerter: ['entfernen', 'weg', 'raus'], art: 'rueckfrage', stufe: 2,
      satz: 'Ausgeblendet ist nicht gelöscht — soll der Inhalt endgültig entfernt werden? Bitte bestätigen.' }]);
    expect(beschreibung('sichtbar')).toContain('Ausgeblendet ist nicht gelöscht');
    expect(beschreibung('sichtbar')).toContain('„entfernen“');
  });
  it('Beschreibung (§8.2): jeder Wert, alle Kundenwörter, der Normalwert, bei Ersatz der Hinweis', () => {
    for (const feld of GESTALTUNGSFELDER) {
      const b = beschreibung(feld);
      for (const w of Object.keys(kundenwoerter[feld].werte)) expect(b, `${feld}: ${w}`).toContain(`${w}: `);
      for (const wort of SPEC[feld].woerter) expect(b, wort).toContain(`„${wort}“`);
      if (feld !== 'bildposition') expect(b).toContain(`Normalwert ${String(SPEC[feld].normal)}`);
    }
    expect(beschreibung('titelgroesse')).toContain('„fetter“');
  });
  it('alle Gestaltungsfelder sind optional ohne Default (§5.1 breite-Begründung)', () => {
    for (const [feld, s] of Object.entries(gestaltungsfelder)) {
      expect(s.safeParse(undefined).success, feld).toBe(true);
      expect(s.parse(undefined), feld).toBeUndefined();
    }
    expect(gestaltungsfelder.titelgroesse.safeParse('fett').success).toBe(false);
  });
});
