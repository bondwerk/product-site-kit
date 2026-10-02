// Bilder-Spiegel (Spec #435 §5.1 „Build-Integrationen"): getestet über den Hook astro:config:setup
// der Integration aus @bondwerk/site-kit/integrationen, mit Stub-config und Stub-logger.
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { bilderCopy } from '../src/integrationen/index.js';

const aufraeumen: string[] = [];
afterEach(() => { for (const d of aufraeumen.splice(0)) rmSync(d, { recursive: true, force: true }); });

function site(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), 'kit-spiegel-'));
  aufraeumen.push(wurzel);
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    mkdirSync(join(wurzel, pfad, '..'), { recursive: true });
    writeFileSync(join(wurzel, pfad), inhalt);
  }
  return wurzel;
}

async function lauf(wurzel: string): Promise<string[]> {
  const meldungen: string[] = [];
  const logger = { info: (m: string) => meldungen.push(`info ${m}`), warn: (m: string) => meldungen.push(`warn ${m}`) };
  const hook = bilderCopy().hooks['astro:config:setup'] as unknown as (p: object) => Promise<void>;
  await hook({ config: { root: pathToFileURL(`${wurzel}/`) }, logger });
  return meldungen;
}

describe('bilderCopy', () => {
  it('spiegelt Rasterbilder nach public/bilder und überspringt Systemdateien', async () => {
    const wurzel = site({ 'content/bilder/a.webp': 'x', 'content/bilder/team/b.png': 'y', 'content/bilder/.DS_Store': 'z' });
    const meldungen = await lauf(wurzel);
    expect(existsSync(join(wurzel, 'public/bilder/a.webp'))).toBe(true);
    expect(existsSync(join(wurzel, 'public/bilder/team/b.png'))).toBe(true);
    expect(existsSync(join(wurzel, 'public/bilder/.DS_Store'))).toBe(false);
    expect(meldungen.some((m) => m.startsWith('warn') && m.includes('.DS_Store'))).toBe(true);
  });

  it('bricht bei Symlink und bei SVG ab und nennt beide', async () => {
    const wurzel = site({ 'content/bilder/a.webp': 'x', 'content/bilder/logo.svg': '<svg/>' });
    // Ziel des Links ist eine Datei im selben Ordner: geprüft wird die Art des Eintrags, nicht das Ziel.
    symlinkSync('a.webp', join(wurzel, 'content/bilder/link.webp'));
    await expect(lauf(wurzel)).rejects.toThrow(/link\.webp ist ein Symlink[\s\S]*logo\.svg hat die Endung|logo\.svg hat die Endung[\s\S]*link\.webp ist ein Symlink/);
  });
});
