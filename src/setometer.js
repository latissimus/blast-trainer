import { TPL } from './template.js';
import { KATALOG, KONTEN } from './katalog.js';
import { targetSets, setsForExercise, effTypeOf, exOf } from './saetze.js';
import { istDeload, tageDerWoche, tierVon, prioritaetsAnpassungen, slotKey } from './prioritaet.js';

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
// bereits die Umrechnung: Im Balken wird beides zusammengefuehrt. Der
// Planungseditor zeigt direkt/indirekt zusaetzlich getrennt, damit ein
// Spendervorschlag nachvollziehbar bleibt.
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

export { istDeload, tageDerWoche };

// GEZAEHLT WIRD DER PLAN, nicht das Eingetragene.
//
// Sobald eine Uebung gewaehlt ist, zaehlen die Saetze, die Level und Vorlage
// dafuer vorsehen. Das macht aus dem Set-O-Meter ein Werkzeug fuer VORHER: Man
// sieht, was die Heavy-Wahl liefert, und waehlt Pump und Cluster danach.
//
// Vorher wurden nur ausgefuellte Saetze gezaehlt. Dann stand das Bild erst am
// Ende der Woche – zu einem Zeitpunkt, an dem man nichts mehr steuern kann.
//
// Ein Feld ohne gewaehlte Uebung zaehlt nicht: Es ist noch keine Entscheidung.
export function zaehleWoche(payload, woche, katalog = KATALOG) {
  const idx = new Map(katalog.map((e) => [klein(e.n), e]));
  const konten = {};
  const direkt = {};
  const indirekt = {};
  KONTEN.forEach((k) => { konten[k] = 0; direkt[k] = 0; indirekt[k] = 0; });
  const prio = prioritaetsAnpassungen(payload, woche, katalog);

  let ohneZuordnung = 0;
  const unbekannte = new Set();
  const data = (payload && payload.data) || {};
  const exAlle = (payload && payload.ex) || {};

  tageDerWoche(payload, woche).forEach((tag) => {
    const tpl = TPL[tag];
    if (!tpl) return;
    const tier = tierVon(payload, tag, woche);
    const zelle = ((data[tag] || {})[woche]) || {};

    tpl.blocks.forEach((blk) => {
      if (!targetSets(blk, tier)) return;      // Block bei diesem Level nicht dabei
      const eintragBlock = zelle[blk.id] || {};
      const frei = blk.type !== 'load';
      // Heavy haelt seine Namen tagweit (payload.ex) – deshalb steht die
      // Heavy-Verteilung schon, bevor man den Tag ueberhaupt geoeffnet hat.
      // Pump und Cluster werden je Woche neu gewaehlt und liegen im Block.
      const namen = eintragBlock.names || ((exAlle[tag] || {})[blk.id]) || [];

      exOf(blk, tier).forEach((_, xi) => {
        const name = (namen[xi] || '').trim();
        if (!name) return;                      // noch nicht gewaehlt

        // Zusatzsaetze gibt es nur bei Pump – wie im Log.
        const extra = effTypeOf(blk, tier) === 'pump'
          ? ((eintragBlock.extra || [])[xi] || 0) : 0;
        const anzahl = Math.max(0,
          (frei ? targetSets(blk, tier) : setsForExercise(blk, tier, xi)) + extra +
          (prio.delta[slotKey(tag, blk.id, xi)] || 0));
        if (!anzahl) return;

        const eintrag = idx.get(klein(name));
        if (!eintrag) {
          // Uebung nicht im Katalog: Die Saetze sind eingeplant, aber wir wissen
          // nicht, wohin damit. Verschweigen waere schlimmer als melden.
          ohneZuordnung += anzahl;
          unbekannte.add(name);
          return;
        }
        konten[eintrag.haupt] += anzahl;
        direkt[eintrag.haupt] += anzahl;
        eintrag.neben.forEach((nb) => {
          if (konten[nb] !== undefined) {
            konten[nb] += anzahl * 0.5;
            indirekt[nb] += anzahl * 0.5;
          }
        });
      });
    });
  });

  const gesamt = KONTEN.reduce((s, k) => s + konten[k], 0) + ohneZuordnung;
  return { konten, direkt, indirekt, ohneZuordnung, unbekannte: [...unbekannte], gesamt, prioritaet: prio.ergebnisse };
}

// Absteigend sortiert – die Reihenfolge IST die Aussage. Bei Gleichstand
// entscheidet die Reihenfolge der Konten, damit das Bild nicht bei jedem
// Neuzeichnen springt.
export function sortiert(konten) {
  return KONTEN
    .map((k) => ({ konto: k, wert: konten[k] || 0 }))
    .sort((a, b) => b.wert - a.wert || KONTEN.indexOf(a.konto) - KONTEN.indexOf(b.konto));
}
