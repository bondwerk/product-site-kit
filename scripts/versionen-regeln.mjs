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

/** Index nach dem Ende der Zeichenkette, die bei text[i] (" oder ') beginnt; Backslash maskiert das nächste Zeichen. */
function stringEnde(text, i) {
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') j++;
    else if (text[j] === text[i]) return j + 1;
  }
  throw new Error('cssRegeln: Zeichenkette nicht geschlossen');
}
/** Teilt an zeichen ausserhalb von Zeichenketten, Klammern und Escapes. */
function teileAn(text, zeichen) {
  const teile = [];
  let start = 0; let tiefe = 0;
  for (let i = 0; i < text.length; i++) {
    const z = text[i];
    if (z === '"' || z === "'") i = stringEnde(text, i) - 1;
    else if (z === '\\') i++;
    else if (z === '(') tiefe++;
    else if (z === ')' && tiefe > 0) tiefe--;
    else if (z === zeichen && tiefe === 0) { teile.push(text.slice(start, i)); start = i + 1; }
  }
  teile.push(text.slice(start));
  return teile;
}

/**
 * Regeln eines Stylesheets in normalisierter Form; verschachtelte @-Regeln tragen ihren Kopf mit.
 * Kommentare fallen weg; {, } und ; in Zeichenketten, in Klammern (url(data:…;base64,…)) und nach einem Backslash gliedern nichts.
 * Eine nicht geschlossene Zeichenkette, Klammer oder ein nicht geschlossener Kommentar wirft.
 */
export function cssRegeln(css) {
  const regeln = [];
  const kette = [];
  let puffer = ''; let tiefe = 0;
  // Leerraum kollabiert nur ausserhalb von Zeichenketten.
  const norm = (t) => t.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\s+/gs, (_m, str) => str ?? ' ').trim();
  for (let i = 0; i < css.length; i++) {
    const z = css[i];
    if (z === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2);
      if (e < 0) throw new Error('cssRegeln: Kommentar nicht geschlossen');
      i = e + 1;
    } else if (z === '"' || z === "'") { const e = stringEnde(css, i); puffer += css.slice(i, e); i = e - 1; }
    else if (z === '\\') { puffer += css.slice(i, i + 2); i++; }
    else if (z === '(') { tiefe++; puffer += z; }
    else if (z === ')') { if (tiefe > 0) tiefe--; puffer += z; }
    else if (tiefe === 0 && z === '{') { kette.push(norm(teileAn(puffer, ';').at(-1))); puffer = ''; }
    else if (tiefe === 0 && z === '}') {
      const kopf = kette.pop();
      if (puffer.trim() || !/^@/.test(kopf ?? '')) {
        const dekl = teileAn(puffer, ';').map((d) => d.trim()).filter(Boolean).map((d) => {
          const i = d.indexOf(':');   // der Name steht vor jeder Zeichenkette
          return i < 0 ? norm(d) : `${norm(d.slice(0, i))}: ${norm(d.slice(i + 1))}`;
        });
        regeln.push([...kette, kopf].reduceRight((innen, k) => `${k} { ${innen} }`, dekl.join('; ')));
      }
      puffer = '';
    } else puffer += z;
  }
  if (tiefe > 0) throw new Error('cssRegeln: Klammer nicht geschlossen');
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

/** Issue #4 Punkt 4: jedes Stylesheet des Kits (kit.css, palette.vorlage.css) gegen die Basis; paare: Dateiname -> [alt, neu]. */
export function cssVergleiche(paare, ausnahmen, basis) {
  return Object.entries(paare).flatMap(([name, [alt, neu]]) => cssBefunde(alt, neu, ausnahmen, basis).map((b) => `${name}: ${b}`));
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

/**
 * Issue #4 Punkt 5: eine Ausnahme, die im Lauf keine Abweichung deckt, ist ein Befund (sonst bleibt sie als Freibrief stehen).
 * wirksam = ohne diese Ausnahme gäbe es genau für diese Regel («Regel fehlt», «Regel ausser Reihenfolge») bzw. Seite
 * («Seite fehlt», «HTML weicht ab») einen Befund. Eine Ausnahme für eine andere Basisversion wirkt nie.
 * Kaputte Einträge (weder regel noch seite, kein x.y.z) meldet ausnahmenBefunde; hier werden sie übersprungen.
 * css: alle verglichenen Stylesheets als [alt, neu]; html: [alt, neu] der Seiten.
 */
export function unwirksameAusnahmen(ausnahmen, basis, { css, html }) {
  const cssRoh = new Set(css.flatMap(([alt, neu]) => cssBefunde(alt, neu, [], basis)));
  const htmlRoh = new Set(htmlBefunde(html[0], html[1], [], basis));
  const wirkt = {
    regel: (r) => cssRoh.has(`Regel fehlt: ${r}`) || cssRoh.has(`Regel ausser Reihenfolge: ${r}`),
    seite: (s) => htmlRoh.has(`Seite fehlt: ${s}`) || htmlRoh.has(`HTML weicht ab: ${s}`),
  };
  return (Array.isArray(ausnahmen) ? ausnahmen : []).flatMap((a, i) => {
    if (!VERSION.test(a?.basis ?? '') || (typeof a.regel === 'string') === (typeof a.seite === 'string')) return [];
    const kopf = `versions-ausnahmen[${i}]`;
    if (a.basis !== basis) return [`${kopf}: gilt für Basis ${a.basis}, die aktuelle Basis ist ${basis}`];
    const art = typeof a.regel === 'string' ? 'regel' : 'seite';
    return wirkt[art](a[art]) ? [] : [`${kopf}: ${art === 'regel' ? 'Regel' : 'Seite'} ohne Wirkung, deckt keine Abweichung: ${a[art]}`];
  });
}
