import { KATALOG } from './katalog.js';

// Welche Übungen ein Feld anbieten darf.
//
// Eigenes Modul und ohne Zustand, weil ein Fehler hier stumm bleibt: Es steht
// dann einfach eine Übung zu viel oder zu wenig in der Liste, ohne dass etwas
// sichtbar bricht. Genau die Sorte Fehler, die man erst Wochen später am
// Wochenkonto merkt.
//
// Zwei Bedingungen, beide hart:
//   konten – die Muskelkonten des Blocks (aus template.js)
//   rolle  – 'Comp' oder 'Iso' bei Heavy-Feldern, null bei Pump und Cluster
//
// Gruppiert wird nach Muskelkonto, weil die gefilterte Liste trotzdem lang
// werden kann (Brust + Rücken im Pump-Block sind über 60 Übungen). Ein <select>
// mit <optgroup> zeigt das auf iOS als ordentliche Auswahl – deshalb hier
// Gruppen statt einer flachen Liste.

const klein = (s) => String(s || '').trim().toLowerCase();

export function passende(konten, rolle, katalog = KATALOG) {
  const erlaubt = konten || [];
  return katalog.filter((e) => erlaubt.includes(e.haupt) && (!rolle || e.typ === rolle));
}

// zuletzt: Namen in der Reihenfolge "zuletzt benutzt zuerst" (aus pool.js).
// Sie stehen oben in einer eigenen Gruppe und werden aus ihrer Muskelgruppe
// entfernt – doppelt gelistet wäre dieselbe Übung zweimal derselbe Eintrag.
export function auswahlGruppen(konten, rolle, zuletzt = [], katalog = KATALOG) {
  const treffer = passende(konten, rolle, katalog);
  const rang = new Map((zuletzt || []).map((n, i) => [klein(n), i]));

  const oben = treffer
    .filter((e) => rang.has(klein(e.n)))
    .sort((a, b) => rang.get(klein(a.n)) - rang.get(klein(b.n)));

  const gruppen = [];
  if (oben.length) gruppen.push({ label: 'Zuletzt benutzt', eintraege: oben });

  // Reihenfolge der Konten aus der Vorlage übernehmen, nicht alphabetisch:
  // Bei "Brust + Rücken" soll Brust oben stehen, weil es so im Block steht.
  (konten || []).forEach((konto) => {
    const eintraege = treffer.filter((e) => e.haupt === konto && !rang.has(klein(e.n)));
    if (eintraege.length) gruppen.push({ label: konto, eintraege });
  });
  return gruppen;
}

// Filtert die bereits sinnvoll sortierten Gruppen fuer den Suchdialog. Dadurch
// bleiben "Zuletzt benutzt" und die Muskel-Reihenfolge auch waehrend der Suche
// erhalten. Umlaute/Schreibweise spielen keine Rolle.
export function sucheAuswahlGruppen(gruppen, suchtext) {
  const teile = klein(suchtext).split(/\s+/).filter(Boolean);
  if (!teile.length) return gruppen;
  return (gruppen || []).map((gruppe) => ({
    ...gruppe,
    eintraege: (gruppe.eintraege || []).filter((e) => {
      const name = klein(e.n);
      return teile.every((teil) => name.includes(teil));
    }),
  })).filter((gruppe) => gruppe.eintraege.length);
}

export const imKatalog = (name, katalog = KATALOG) =>
  !!klein(name) && katalog.some((e) => klein(e.n) === klein(name));

export const eintragVon = (name, katalog = KATALOG) =>
  katalog.find((e) => klein(e.n) === klein(name)) || null;
