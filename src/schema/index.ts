// Subpath @bondwerk/site-kit/schema — kein node:*-Import, auch nicht transitiv (Spec #435 §4.2).
export { URL_ODER_SCHEME, EMAIL_ADRESSE, sichererText, sichererTextFuer } from './text.js';
export { contentBildPfad, plz, chTelefon, kontaktEmail } from './bild-kontakt.js';
export { normalwerte, bildpositionNormal } from './gestaltung.js';
export { abschnittSchema, seiteSchema, type KitAbschnitt, type KitVariante } from './abschnitte.js';
