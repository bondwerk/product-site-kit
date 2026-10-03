// Spec #435 §5.1: Link-Ziele. Nur Regex — das Schema läuft im Validator in einer vm (kein URL-Global vorausgesetzt).
import { z } from 'astro/zod';

/** https ohne Benutzerdaten; jedes Host-Label ohne Punycode-Präfix xn-- (Plan B10). */
const LABEL = '(?!xn--)(?!-)[a-z0-9-]{1,63}(?<!-)';
const PORT = '(?::(?:[0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?';
/** Pfadzeichen: druckbares ASCII ohne " ' < > @ \ und Backtick. */
const PFAD = '(?:[/?#][\\x21\\x23-\\x26\\x28-\\x3d\\x3f\\x41-\\x5b\\x5d-\\x5f\\x61-\\x7e/]*)?';
const HTTPS = new RegExp(`^https://(?:${LABEL}\\.)+[a-z]{2,}${PORT}${PFAD}$`, 'i');
const INTERN = /^\/(?!\/)[a-z0-9/_-]*(?:#[a-z0-9_-]+)?$/;
const ANKER = /^#[a-z0-9_-]+$/;
const TEL = /^tel:\+?[0-9]{6,15}$/;

/** Ziel eines Links oder Knopfs: interner Pfad, Anker, Telefon oder externe https-Adresse. Änderungen stuft S4 über x-klasse ein. */
export const linkZiel = z.string().max(300)
  .refine((v) => INTERN.test(v) || ANKER.test(v) || TEL.test(v) || HTTPS.test(v), { message: 'Linkziel: /pfad, #anker, tel: oder https:// (ohne xn--)' })
  .meta({ 'x-klasse': 'link', description: 'Linkziel: interner Pfad (/kontakt), Anker (#kontakt), Telefon (tel:+41441234567) oder https-Adresse ohne Benutzerdaten.' });
