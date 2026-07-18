import { TPL } from './template.js';

// Auswertung der Heavy-Progression aus den Wochendaten.
//
// Warum e1RM und nicht einfach das Gewicht: 80 kg × 8 und 85 kg × 6 sind beide
// ein Fortschritt, aber ueber die reine Last nicht vergleichbar. Das geschaetzte
// Einer-Maximum (Epley) bringt Last und Wiederholungen auf eine Zahl – so bleibt
// eine Steigerung sichtbar, egal ob sie ueber Gewicht oder Wdh. kam.
//
// Reines Modul ohne DOM: Eine falsche Kurve sieht aus wie eine richtige.

export const e1rm = (w, r) => {
  const last = parseFloat(String(w).replace(',', '.'));
  const wdh = parseFloat(r);
  if (!last || !wdh) return 0;
  return last * (1 + wdh / 30);
};

// Bester Satz einer Uebung an einem Tag.
export const bestE1 = (saetze) =>
  (saetze || []).reduce((m, s) => (s ? Math.max(m, e1rm(s.w, s.r)) : m), 0);

/**
 * Reihen je Heavy-Uebung aus dem gespeicherten Payload.
 * @returns [{ name, punkte: [{ week, e1 }] }] – nur Uebungen mit mind. zwei
 *          Wochen, laengste Reihe zuerst (die ist am aussagekraeftigsten).
 */
export function heavyReihen(payload) {
  const data = (payload && payload.data) || {};
  const namenAll = (payload && payload.ex) || {};
  const proUebung = new Map();

  Object.keys(data).forEach((tag) => {
    const tplTag = TPL[tag];
    if (!tplTag) return;
    Object.keys(data[tag] || {}).forEach((wkStr) => {
      const woche = Number(wkStr);
      const zelle = data[tag][wkStr] || {};
      Object.keys(zelle).forEach((bid) => {
        const blk = tplTag.blocks.find((b) => b.id === bid);
        // Nur Heavy: Pump und Cluster sind laut Konzept keine Progressions-Marker.
        if (!blk || blk.type !== 'load') return;
        const namen = (namenAll[tag] || {})[bid] || [];
        (((zelle[bid] || {}).sets) || []).forEach((saetze, xi) => {
          const name = String(namen[xi] || '').trim();
          if (!name) return;
          const best = bestE1(saetze);
          if (!best) return;
          // Schluessel kleingeschrieben, damit dieselbe Uebung nicht an der
          // Schreibweise zerfaellt – angezeigt wird die Originalform.
          const key = name.toLowerCase();
          if (!proUebung.has(key)) proUebung.set(key, { name, wochen: new Map() });
          const eintrag = proUebung.get(key);
          if (best > (eintrag.wochen.get(woche) || 0)) eintrag.wochen.set(woche, best);
        });
      });
    });
  });

  return [...proUebung.values()]
    .map((e) => ({
      name: e.name,
      punkte: [...e.wochen.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([week, wert]) => ({ week, e1: Math.round(wert * 10) / 10 })),
    }))
    .filter((e) => e.punkte.length >= 2)
    .sort((a, b) => b.punkte.length - a.punkte.length || a.name.localeCompare(b.name, 'de'));
}

// Veraenderung vom ersten zum letzten Punkt, in kg und Prozent.
export function verlauf(punkte) {
  if (!punkte || punkte.length < 2) return null;
  const erst = punkte[0].e1;
  const letzt = punkte[punkte.length - 1].e1;
  return {
    erst,
    letzt,
    kg: Math.round((letzt - erst) * 10) / 10,
    prozent: Math.round(((letzt - erst) / erst) * 1000) / 10,
  };
}
