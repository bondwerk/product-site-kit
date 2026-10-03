// Spec #435 §5.1: Link-Ziele. Nur Regex — das Schema läuft im Validator in einer vm (kein URL-Global vorausgesetzt).
import { z } from 'astro/zod';

/** https ohne Benutzerdaten; jedes Host-Label ohne Punycode-Präfix xn-- (Plan B10). */
const HTTPS = /^https:\/\/(?:(?!xn--)[a-z0-9-]+\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#][^\s"'<>@]*)?$/i;
const INTERN = /^\/(?!\/)[a-z0-9/_-]*(?:#[a-z0-9_-]+)?$/;
const ANKER = /^#[a-z0-9_-]+$/;
const TEL = /^tel:\+?[0-9]{6,15}$/;

/** Ziel eines Links oder Knopfs: interner Pfad, Anker, Telefon oder externe https-Adresse. Änderungen stuft S4 über x-klasse ein. */
export const linkZiel = z.string().max(300)
  .refine((v) => INTERN.test(v) || ANKER.test(v) || TEL.test(v) || HTTPS.test(v), { message: 'Linkziel: /pfad, #anker, tel: oder https:// (ohne xn--)' })
  .meta({ 'x-klasse': 'link' });
