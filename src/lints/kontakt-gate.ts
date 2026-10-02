export type KontaktGateBefund = 'unveraendert' | 'geaendert';

/** Hat ein Diff eine der Kontakt-Dateien berührt? Die CI der Site macht daraus Exit 3. */
export function kontaktGateBefund(geaenderteDateien: readonly string[], kontaktDateien: readonly string[]): KontaktGateBefund {
  const menge = new Set(geaenderteDateien.map((p) => p.trim()));
  return kontaktDateien.some((k) => menge.has(k)) ? 'geaendert' : 'unveraendert';
}
