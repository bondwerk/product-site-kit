import { z } from 'astro/zod';

/** Bildpfad unter bilder/ (Unterordner erlaubt), nur Rasterformate: kein SVG (Script-Träger), kein Ausbruch. */
export const contentBildPfad = z
  .string()
  .regex(/^bilder\/(?!.*\.\.)[a-z0-9äöü/._-]+\.(webp|png|jpe?g|avif)$/i, 'Rasterbild unter bilder/ erwartet (kein SVG)')
  .refine((v) => !v.includes('..'), { message: 'Pfad-Ausbruch' })
  .meta({ 'x-klasse': 'inhalt' });

/** Schweizer PLZ, vierstellig. */
export const plz = z.string().regex(/^\d{4}$/, 'CH-PLZ (4-stellig) erwartet');

/** CH-Telefonnummer: Präfix +41, 0041 oder 0, insgesamt 10 bis 13 Ziffern. */
export const chTelefon = z
  .string()
  .regex(/^(\+41|0041|0)[\s.\d()]{7,}$/, 'CH-Telefonnummer erwartet')
  .refine((v) => {
    const ziffern = v.replace(/\D/g, '').length;
    return ziffern >= 10 && ziffern <= 13;
  }, 'CH-Telefonnummer: 10 bis 13 Ziffern erwartet');
