// Kennung für x-gestaltung (Spec #435 §8.1, Plan B3). KIT_VERSION muss package.json.version gleichen (Test).
export const KIT_VERSION = '0.1.1';
/** Patch-Versionen ändern den Schema-Vertrag nicht (Spec §4.4); S4 vergleicht Major.Minor. */
export const GESTALTUNG_KENNUNG = KIT_VERSION.split('.').slice(0, 2).join('.');
