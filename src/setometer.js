import { TPL } from './template.js';
import { KATALOG, KONTEN } from './katalog.js';

// Set-O-Meter: Wie viele Sätze hat in dieser Woche welcher Muskel abbekommen?
//
// Ohne Zustand und ohne DOM, damit es prüfbar ist – ein Fehler bliebe hier sonst
// stumm. Eine Zahl, die um zwei danebenliegt, sieht aus wie eine richtige Zahl.
//
// GEZÄHLT WIRD PRO SATZ, nicht pro Übung:
//   Hauptspieler  1,0
//   Nebenspieler  0,5
// Die halbe Wertung indirekter Arbeit folgt Pelland et al. (2025): Ein Satz
// Rudern baut Bizeps auf, aber nicht so viel wie ein Satz Curls.
//
// Ein Cluster (6×4) zählt als EIN Satz – so wie ihn die App auch sonst zählt.
// Sechs zu zählen würde den Cluster-Tag dreifach aufblasen.
//
// Ein Satz zählt nur, wenn Gewicht oder Wiederholungen drinstehen. Die App legt
// beim blossen Ansehen eines Tages leere Satzzeilen an; die dürfen nicht
// mitzählen, sonst füllt sich das Konto vom Hinsehen.

// Zielwerte je Konto, Sätze pro Woche.
//
// ACHTUNG, das sind Startwerte und keine Wissenschaft. Die Grundlage ist die
// Empfehlung "ab etwa 10 harte Sätze pro Muskel und Woche" (ACSM 2026); darunter
// liegen die Konten, die sich im Programm strukturell wenige Slots teilen – die
// drei Schulterköpfe teilen sich dieselben Blöcke, Unterarme und Adduktoren
// bekommen ohnehin nur Beiwerk. Ein Ziel, das nie erreichbar ist, würde jede
// Woche Alarm schlagen und wäre nach zwei Wochen Tapete.
//
// Diese Tabelle ist bewusst die einzige Stelle, an der man sie ändert.
export const ZIELE = {
  'Brust': 10,
  'Lat': 10,
  'Oberer Rücken': 10,
  'Quads': 10,
  'Hams': 10,
  'Glutes': 8,
  'Vordere Schulter': 8,
  'Seitliche Schulter': 8,
  'Hintere Schulter': 8,
  'Bizeps': 8,
  'Trizeps': 8,
  'Waden': 6,
  'Abs': 6,
  'Unterarme': 4,
  'Adduktoren': 4,
};

// Kurzformen nur fuer die Anzeige: "Vordere Schulter" passt neben Balken und
// Zahl auf einem Telefon nicht in die Zeile und wurde abgeschnitten. Gerechnet
// wird weiter mit den vollen Namen aus dem Katalog.
export const KURZ = {
  'Vordere Schulter': 'Vord. Schulter',
  'Seitliche Schulter': 'Seitl. Schulter',
  'Hintere Schulter': 'Hint. Schulter',
  'Oberer Rücken': 'Ob. Rücken',
};
export const zeigName = (k) => KURZ[k] || k;

const klein = (s) => String(s || '').trim().toLowerCase();

// Gemacht heisst: Es steht etwas drin. Ein Satz ohne Gewicht UND ohne
// Wiederholungen ist ein leeres Geruest, kein Training.
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

      // Heavy hält seine Namen tagweit (payload.ex), Pump und Cluster je Woche
      // im Block selbst (entry.names).
      const namen = eintragBlock.names || ((exAlle[tag] || {})[bid]) || [];

      (eintragBlock.sets || []).forEach((satzListe, xi) => {
        const anzahl = (satzListe || []).filter(gemacht).length;
        if (!anzahl) return;

        const name = (namen[xi] || '').trim();
        const eintrag = idx.get(klein(name));
        if (!eintrag) {
          // Alte oder aus der Excel entfernte Übungen: Die Sätze sind gemacht,
          // aber wir wissen nicht, wohin damit. Verschweigen wäre schlimmer als
          // melden – sonst wirkt das Konto niedriger als es ist.
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

  // gesamt: Ist ueberhaupt schon etwas eingetragen? Ohne das meldete eine noch
  // leere Woche "15 Konten unter Ziel" – formal richtig und trotzdem ein
  // Fehlalarm, denn am Montag hat man selbstverstaendlich noch nichts gemacht.
  // Ein Warnsignal, das immer leuchtet, liest nach zwei Wochen niemand mehr.
  const gesamt = KONTEN.reduce((s, k) => s + konten[k], 0) + ohneZuordnung;

  return { konten, ohneZuordnung, unbekannte: [...unbekannte], gesamt };
}

export const istDeload = (woche) => Number(woche) >= 7;

// Welche Konten liegen unter ihrem Ziel?
//
// Im Deload keine: Dort ist wenig Volumen der Zweck, nicht ein Versäumnis.
export function defizite(konten, woche, ziele = ZIELE) {
  if (istDeload(woche)) return [];
  return KONTEN.filter((k) => (konten[k] || 0) < (ziele[k] ?? Infinity));
}

// Halbe Sätze sind rechnerisch echt, aber "6,5 Sätze" täuscht eine Genauigkeit
// vor, die die Datenlage nicht hergibt. Angezeigt wird darum gerundet – gerechnet
// wird weiter mit der halben Wertung.
export const zeigZahl = (n) => String(Math.round(n * 2) / 2).replace('.', ',');
