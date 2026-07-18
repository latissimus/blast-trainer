// Kleine Verlaufskurve als SVG.
//
// Von Hand statt Bibliothek: Zwei Diagramme rechtfertigen keine 50 kB im Bundle,
// die dann auch noch der Service Worker mitcachen muesste.
//
// viewBox statt fester Groesse – so skaliert sie mit der Karte, ohne dass wir
// auf Groessenaenderungen lauschen muessen.

const B = { links: 34, rechts: 8, oben: 10, unten: 18 };   // Rand fuer Beschriftung

const pfad = (punkte) => punkte.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/**
 * @param reihen [{ werte: [{datum, wert}], klasse: 'roh'|'trend', punkte?: bool }]
 * Mehrere Reihen teilen sich dieselbe Skala – sonst luegen die Kurven
 * uebereinander.
 */
export function kurveSvg(reihen, { hoehe = 130, einheit = '', xText = null } = {}) {
  const alle = reihen.flatMap((r) => r.werte);
  // Die laengste EINZELNE Reihe entscheidet, nicht die Summe aller: Beim Gewicht
  // liefern Rohwert und Trend denselben Tag doppelt – sonst zeichneten wir aus
  // einem einzigen Messtag ein leeres Achsenkreuz.
  const laengste = Math.max(0, ...reihen.map((r) => r.werte.length));
  if (laengste < 2) {
    return `<div class="kurve-leer">Noch zu wenig Daten für einen Verlauf.<br>
      <span>Ab der zweiten Messung erscheint hier die Kurve.</span></div>`;
  }

  const B_ = 300;
  // Die X-Achse kann Daten ODER blanke Zahlen tragen (Gewicht laeuft ueber
  // Kalendertage, die Heavy-Progression ueber Wochennummern). Ein Punkt mit
  // eigenem x gewinnt; sonst wird das Datum in Millisekunden umgerechnet.
  const zeit = (p) => (p.x != null ? p.x : new Date(p.datum + 'T12:00:00').getTime());
  const t0 = Math.min(...alle.map(zeit));
  const t1 = Math.max(...alle.map(zeit));
  let min = Math.min(...alle.map((p) => p.wert));
  let max = Math.max(...alle.map((p) => p.wert));
  // Etwas Luft, damit die Linie nicht am Rand klebt. Bei konstanten Werten
  // (alles gleich) waere die Spanne 0 -> Division durch null.
  const spanne = max - min || Math.max(1, max * 0.02);
  min -= spanne * 0.15; max += spanne * 0.15;

  const x = (p) => B.links + (t1 === t0 ? (B_ - B.links - B.rechts) / 2
    : ((zeit(p) - t0) / (t1 - t0)) * (B_ - B.links - B.rechts));
  const y = (w) => B.oben + (1 - (w - min) / (max - min)) * (hoehe - B.oben - B.unten);

  const linien = reihen.filter((r) => r.werte.length >= 2).map((r) => {
    const pts = r.werte.map((p) => ({ x: x(p), y: y(p.wert) }));
    const kreise = r.punkte ? pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" class="k-pt ${r.klasse}"/>`).join('') : '';
    return `<path d="${pfad(pts)}" class="k-linie ${r.klasse}"/>${kreise}`;
  }).join('');

  const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  // Beschriftung passend zur Achsenart: Datum oder das, was xText liefert.
  const dat = (t) => (xText ? xText(t) : new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));

  return `<svg class="kurve" viewBox="0 0 ${B_} ${hoehe}" preserveAspectRatio="none" role="img"
    aria-label="Verlauf von ${fmt(alle[0].wert)} bis ${fmt(alle[alle.length - 1].wert)} ${einheit}">
    <line x1="${B.links}" y1="${y(max)}" x2="${B_ - B.rechts}" y2="${y(max)}" class="k-raster"/>
    <line x1="${B.links}" y1="${y(min)}" x2="${B_ - B.rechts}" y2="${y(min)}" class="k-raster"/>
    <text x="${B.links - 4}" y="${y(max) + 3}" class="k-achse" text-anchor="end">${fmt(max)}</text>
    <text x="${B.links - 4}" y="${y(min) + 3}" class="k-achse" text-anchor="end">${fmt(min)}</text>
    <text x="${B.links}" y="${hoehe - 5}" class="k-achse">${dat(t0)}</text>
    <text x="${B_ - B.rechts}" y="${hoehe - 5}" class="k-achse" text-anchor="end">${dat(t1)}</text>
    ${linien}
  </svg>`;
}
