const GEFAEHRLICHE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const GEFAEHRLICHER_KEY_MUSTER = /"(__proto__|constructor|prototype)"\s*:/;

/** Text-Vorprüfung der rohen JSON-Quelle, auch für verschachtelte Objekte. */
export function enthaeltGefaehrlicheKeys(rohJson: string): boolean {
  return GEFAEHRLICHER_KEY_MUSTER.test(rohJson);
}

/** JSON.parse, das gefährliche Keys beim Aufbau überspringt. */
export function safeJsonParse(rohJson: string): unknown {
  return JSON.parse(rohJson, (key, value) => (GEFAEHRLICHE_KEYS.has(key) ? undefined : value));
}
