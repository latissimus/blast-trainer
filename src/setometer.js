import { TPL } from './template.js';
import { KATALOG, KONTEN } from './katalog.js';

// Set-O-Meter: Wie viele Arbeitssätze hat in dieser Woche welcher Muskel
// abbekommen?
//
// Das Ding urteilt nicht. Es gibt keinen Zielwert und keine Warnung – nur das
// Bild der Verteilung. Wer sieht, dass die Waden einen längeren Balken haben
// als die Brust, kann nachsteuern; ob er will, ist seine Sache.
//
// Hier stand vorher eine Zieltabelle mit Sollwerten je Muskel. Die ist raus.
// Sie berief sich auf die Empfehlung "10-20 harte Sätze pro Muskel und Woche",
// aber die stammt aus Studien, in denen die Sätze überwiegend NICHT bis zum
// Versagen gingen. Heavy auf 0-2 RIR, Pump bis zum metabolischen Versagen und
// Cluster sind damit nicht vergleichbar – aus dieser Zahl einen Sollwert für
// dieses Training abzuleiten, sah nach Rechnung aus, war aber keine.
//
// GEZÄHLT WIRD PRO SATZ:
//   Hauptspieler  1,0
//   Nebenspieler  0,5
// Die halbe Wertung indirekter Arbeit folgt Pelland et al. (2025). Sie ist
// bereits die Umrechnung – deshalb wird direkt und indirekt NICHT getrennt
// ausgewiesen. Zwei indirekte Belastungen sind ein Satz, fertig.
//
// Ein Cluster (6×4) zählt als EIN Satz, so wie ihn die App auch sonst zählt.

// Kurzformen nur für die Anzeige: Die vollen Namen passen neben dem Balken
// auf einem Telefon nicht in die Zeile.
export const KURZ = {
  'Vordere Schulter': 'Vord. Schulter',
  'Seitliche Schulter': 'Seitl. Schulter',
  'Hintere Schulter': 'Hint. Schulter',
  'Oberer Rücken': 'Ob. Rücken',
};
export const zeigName = (k) => KURZ[k] || k;

const klein = (s) => String(s || '').trim().toLowerCase();

// Gemacht heisst: Es steht etwas drin. Die App legt beim blossen Ansehen eines
// Tages leere Satzzeilen an – zaehlten die mit, fuellte sich das Bild vom
// Hinsehen.
const gemacht = (s) => !!(s && (String(s.w || '').trim() || String(s.r || '').trim()));

export function zaehleWoche(payload, woche, katalog = KATALOG) {
  const idx = new Map(katalog.map((e) => [klein(e.n), e]));
  const konten = {};
  KONTEN.forEach((k) => { konten[k] = 0; });

  let ohneZuordnung = 0;
  const unbekannte = new Set();
  const data = (payload && payload.data) || {};
  const exAlle = (payload && payload.ex) || {};

  Object.keys(data).forEach((tag) => {
    const tpl = TPL[tag];
    if (!tpl) return;
    const zelle = (data[tag] || {})[woche];
    if (!zelle) return;

    Object.keys(zelle).forEach((bid) => {
      const blk = tpl.blocks.find((b) => b.id === bid);
      const eintragBlock = zelle[bid];
      if (!blk || !eintragBlock) return;

      // Heavy haelt seine Namen tagweit (payload.ex), Pump und Cluster je Woche
      // im Block selbst (entry.names).
      const namen = eintragBlock.names || ((exAlle[tag] || {})[bid]) || [];

      (eintragBlock.sets || []).forEach((satzListe, xi) => {
        const anzahl = (satzListe || []).filter(gemacht).length;
        if (!anzahl) return;

        const name = (namen[xi] || '').trim();
        const eintrag = idx.get(klein(name));
        if (!eintrag) {
          // Alte oder aus der Excel entfernte Uebungen: Die Saetze sind gemacht,
          // aber wir wissen nicht, wohin damit. Verschweigen waere schlimmer als
          // melden – sonst zeigt das Bild weniger Arbeit, als stattgefunden hat.
          ohneZuordnung += anzahl;
          if (name) unbekannte.add(name);
          return;
        }
        konten[eintrag.haupt] += anzahl;
        eintrag.neben.forEach((nb) => {
          if (konten[nb] !== undefined) konten[nb] += anzahl * 0.5;
        });
      });
    });
  });

  const gesamt = KONTEN.reduce((s, k) => s + konten[k], 0) + ohneZuordnung;
  return { konten, ohneZuordnung, unbekannte: [...unbekannte], gesamt };
}

// Absteigend sortiert – die Reihenfolge IST die Aussage. Bei Gleichstand
// entscheidet die Reihenfolge der Konten, damit das Bild nicht bei jedem
// Neuzeichnen springt.
export function sortiert(konten) {
  return KONTEN
    .map((k) => ({ konto: k, wert: konten[k] || 0 }))
    .sort((a, b) => b.wert - a.wert || KONTEN.indexOf(a.konto) - KONTEN.indexOf(b.konto));
}
