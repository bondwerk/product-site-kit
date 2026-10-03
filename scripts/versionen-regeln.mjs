// Reine Regeln des Versions-Tests (Spec #435 §4.4, Plan B12). Nicht im Paket.
export function fehlendeExporte(alt, neu) {
  return Object.entries(alt).flatMap(([sub, namen]) => namen.filter((n) => !(neu[sub] ?? []).includes(n)).map((n) => `${sub}: ${n}`));
}
export function basisBefunde(b) {
  const out = [];
  if (!/^\d+\.\d+\.\d+$/.test(b?.version ?? '')) out.push('versions-basis: version muss x.y.z sein');
  if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(b?.integrity ?? '')) out.push('versions-basis: integrity muss sha512- mit 88 Zeichen Base64 sein');
  return out;
}
export function integritaetAusLock(lock) {
  const e = lock.packages?.['node_modules/@bondwerk/site-kit'];
  if (!e?.integrity) throw new Error('versions-test: @bondwerk/site-kit fehlt im Lockfile der Basis');
  return e.integrity;
}
