import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const NEBENDATEIEN = new Set(['.ds_store', 'thumbs.db', 'desktop.ini', '.gitkeep', '.gitignore']);
const istNebendatei = (name: string): boolean => NEBENDATEIEN.has(name.toLowerCase()) || name.startsWith('._');
const SEGMENT = /^[A-Za-z0-9äöüÄÖÜ._-]+$/;

export interface SpiegelRegeln { name: string; anzeige: string; endungen: readonly string[]; begruendung: string }
export interface SpiegelErgebnis { kopiert: number; uebersprungen: string[] }

const endungVon = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase();
};

/** Spiegelt `quelle` nach `ziel`: nur reguläre Dateien mit erlaubter Endung und sicheren Namen, keine Symlinks. */
export async function spiegle(quelle: string, ziel: string, regeln: SpiegelRegeln): Promise<SpiegelErgebnis> {
  const fehler: string[] = [];
  const uebersprungen: string[] = [];
  let kopiert = 0;
  const durchlaufen = async (rel: string): Promise<void> => {
    const qOrdner = rel ? join(quelle, rel) : quelle;
    const zOrdner = rel ? join(ziel, rel) : ziel;
    await mkdir(zOrdner, { recursive: true });
    for (const e of await readdir(qOrdner, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const anzeige = `${regeln.anzeige}/${r}`;
      if (e.isSymbolicLink()) { fehler.push(`${anzeige} ist ein Symlink — Symlinks werden nicht gespiegelt; lege die Datei selbst ab.`); continue; }
      if (e.isDirectory()) {
        if (!SEGMENT.test(e.name)) { fehler.push(`${anzeige}: unerlaubte Zeichen im Ordnernamen (erlaubt: Buchstaben, Ziffern, Umlaute, . _ -)`); continue; }
        await durchlaufen(r);
        continue;
      }
      if (!e.isFile()) { fehler.push(`${anzeige} ist keine normale Datei.`); continue; }
      if (istNebendatei(e.name)) { uebersprungen.push(anzeige); continue; }
      if (!SEGMENT.test(e.name)) { fehler.push(`${anzeige}: unerlaubte Zeichen im Dateinamen (der Name wird Teil einer öffentlichen Adresse).`); continue; }
      const endung = endungVon(e.name);
      if (!regeln.endungen.includes(endung)) {
        fehler.push(`${anzeige} hat die Endung «${endung ? `.${endung}` : '(keine)'}» — erlaubt: ${regeln.endungen.join(', ')}. ${regeln.begruendung}`);
        continue;
      }
      await copyFile(join(qOrdner, e.name), join(zOrdner, e.name));
      kopiert++;
    }
  };
  await durchlaufen('');
  if (fehler.length) {
    throw new Error(
      `${regeln.name}: ${fehler.length} Eintrag/Einträge unter ${regeln.anzeige}/ gehören nicht in den Spiegel. ` +
        'Der Ordner wird nach public/ und damit öffentlich ausgeliefert.\n' + fehler.map((f) => `  - ${f}`).join('\n'),
    );
  }
  return { kopiert, uebersprungen };
}

/** Wie `spiegle`, räumt das Ziel vorher; fehlt die Quelle, ist das ein legaler Zustand (`null`). */
export async function spiegleOrdner(quelle: string, ziel: string, regeln: SpiegelRegeln): Promise<SpiegelErgebnis | null> {
  if (!existsSync(quelle)) return null;
  await rm(ziel, { recursive: true, force: true });
  return spiegle(quelle, ziel, regeln);
}
