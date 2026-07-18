// Erfolgskontrolle: Rechenlogik fuer Hautfalten und Gewicht.
//
// Bewusst OHNE Datenbank-Client: Das hier ist die Stelle, an der ein Fehler
// still bleibt (eine falsche Summe sieht aus wie eine Zahl). Sie muss ohne
// Browser und ohne Netz testbar sein – der Zugriff liegt in erfolg.js.
//
// Bewusst NUR die Summe der Falten, keine Deutung einzelner Stellen und keine
// Umrechnung in Koerperfett-Prozent:
//
// - Die Zuordnung einzelner Falten zu Hormonen (BioSignature/YPSI-Linie) hat der
//   Ueberpruefung nie standgehalten. Aus "Hueftfalte hoch" laesst sich keine
//   Ernaehrungsstrategie ableiten.
// - Die Umrechnung in Prozent addiert nur Fehler und erzeugt Scheingenauigkeit.
//   "112 mm -> 104 mm" ist ehrlicher und fuer den Verlauf genauso brauchbar.
//
// Die Summe misst, was sie misst. Mehr behauptet sie nicht.

// Reihenfolge = Messreihenfolge am Koerper, nicht alphabetisch.
export const FALTEN = [
  ['kinn', 'Kinn'], ['wange', 'Wange'], ['brust', 'Brust'], ['ruecken', 'Rücken'],
  ['rippe', 'Rippe'], ['huefte', 'Hüfte'], ['bauch', 'Bauch'], ['trizeps', 'Trizeps'],
  ['bizeps', 'Bizeps'], ['wade', 'Wade'], ['quadrizeps', 'Quadrizeps'], ['beinbizeps', 'Beinbizeps'],
];

export const zahl = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Summe nur ueber vollstaendige Messungen. Fehlt eine Falte, ist die Summe nicht
// mit frueheren vergleichbar – dann lieber nichts zeigen als etwas Falsches.
export function summe(falten) {
  const werte = FALTEN.map(([k]) => zahl(falten?.[k]));
  if (werte.some((v) => v === null)) return null;
  return Math.round(werte.reduce((s, v) => s + v, 0) * 10) / 10;
}

export const heute = () => new Date().toISOString().slice(0, 10);

export const datumKurz = (iso) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

// ---- Trend -----------------------------------------------------------------

// Gleitender 7-Tage-Durchschnitt.
//
// Der Grund: Tageswerte schwanken durch Wasser, Salz und Darminhalt um mehr als
// der Fortschritt einer ganzen Woche ausmacht. Eine rohe Tageskurve zeigt vor
// allem Rauschen – und man liest Erfolg oder Rueckschlag in Zacken hinein, die
// keine sind. Der Schnitt ist das Signal, der Tageswert der Krach.
//
// Gemittelt wird ueber das Kalenderfenster der letzten 7 Tage, nicht ueber die
// letzten 7 Eintraege: Wer drei Tage nicht wiegt, soll keinen Schnitt aus alten
// Werten bekommen.
export function schnitt7(punkte) {
    const tage = (iso) => Math.floor(new Date(iso + 'T12:00:00').getTime() / 86400000);
  return punkte.map((p, i) => {
    const bis = tage(p.datum);
    const fenster = punkte.slice(0, i + 1).filter((q) => bis - tage(q.datum) < 7);
    return { datum: p.datum, kg: fenster.reduce((s, q) => s + q.kg, 0) / fenster.length };
  });
}
