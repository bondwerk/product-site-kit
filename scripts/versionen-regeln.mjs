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

// Teil 2 (Spec #435 Phase 2 §8, S5): CSS-Obermenge, normalisiertes HTML, versionierte Ausnahmen.
const VERSION = /^\d+\.\d+\.\d+$/;

/** Regeln eines Stylesheets in normalisierter Form; verschachtelte @-Regeln tragen ihren Kopf mit. */
export function cssRegeln(css) {
  const regeln = [];
  const kette = [];
  let puffer = '';
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  for (const z of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (z === '{') { kette.push(norm(puffer.split(';').at(-1))); puffer = ''; }
    else if (z === '}') {
      const kopf = kette.pop();
      if (puffer.trim() || !/^@/.test(kopf ?? '')) {
        const dekl = puffer.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
          const i = d.indexOf(':');
          return i < 0 ? norm(d) : `${norm(d.slice(0, i))}: ${norm(d.slice(i + 1))}`;
        });
        regeln.push([...kette, kopf].reduceRight((innen, k) => `${k} { ${innen} }`, dekl.join('; ')));
      }
      puffer = '';
    } else puffer += z;
  }
  return regeln;
}
const gilt = (ausnahmen, basis) => ausnahmen.filter((a) => a.basis === basis);

/** Alte Regeln müssen als Teilfolge in gleicher Ordnung im neuen CSS stehen (Kaskade); neue Regeln dazwischen sind erlaubt. */
export function cssBefunde(altCss, neuCss, ausnahmen, basis) {
  const alt = cssRegeln(altCss);
  if (!alt.length) return ['Basis ohne Regeln: Vergleich leer'];
  const neu = cssRegeln(neuCss);
  const erlaubt = new Set(gilt(ausnahmen, basis).map((a) => a.regel).filter(Boolean));
  const out = [];
  let pos = 0;
  for (const r of alt) {
    if (erlaubt.has(r)) continue;
    const i = neu.indexOf(r, pos);
    if (i >= 0) pos = i + 1;
    else out.push(neu.includes(r) ? `Regel ausser Reihenfolge: ${r}` : `Regel fehlt: ${r}`);
  }
  return out;
}

/** Astro hängt Assets einen Hash von 8 Zeichen an; der hängt am Inhalt, nicht am Markup. */
export function normalisiereHtml(html) {
  return html.replace(/(\/_astro\/[^"'\s()]*?)\.[A-Za-z0-9_-]{8}\.([a-z0-9]+)(?=["'\s)])/g, '$1.$2');
}

export function htmlBefunde(alt, neu, ausnahmen, basis) {
  const erlaubt = new Set(gilt(ausnahmen, basis).map((a) => a.seite).filter(Boolean));
  if (!Object.keys(alt).length) return ['Basis ohne Seiten: Vergleich leer'];
  const out = [];
  for (const seite of Object.keys(alt)) {
    if (erlaubt.has(seite)) continue;
    if (!(seite in neu)) out.push(`Seite fehlt: ${seite}`);
    else if (normalisiereHtml(alt[seite]) !== normalisiereHtml(neu[seite])) out.push(`HTML weicht ab: ${seite}`);
  }
  return out;
}

export function ausnahmenBefunde(liste) {
  if (!Array.isArray(liste)) return ['versions-ausnahmen: muss eine Liste sein'];
  return liste.flatMap((a, i) => {
    const out = [];
    if (!VERSION.test(a?.basis ?? '')) out.push(`versions-ausnahmen[${i}]: basis muss x.y.z sein`);
    if (typeof a?.begruendung !== 'string' || !a.begruendung.trim()) out.push(`versions-ausnahmen[${i}]: begruendung fehlt`);
    if ((typeof a?.regel === 'string') === (typeof a?.seite === 'string')) out.push(`versions-ausnahmen[${i}]: genau eines von regel oder seite`);
    return out;
  });
}
