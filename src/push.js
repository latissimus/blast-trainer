// Service-Worker-Registrierung.
//
// Der Worker liefert die App im Funkloch aus (Offline Stufe 2) und bringt die
// Push-Behandlung mit. Registriert wird er beim App-Start aus main.js, bewusst
// unabhaengig von jeder Oberflaeche: Frueher haing das am Diagnose-Knopf im
// Profil, und mit dessen Wegfall waere die Offline-Faehigkeit still gestorben.
//
// Das Anmelden fuer Push (subscribe + VAPID) ist hier bewusst NICHT mehr drin.
// Es diente der einen Frage, ob Web Push in der EU auf iOS funktioniert – die
// ist mit Ja beantwortet und geprueft. BLAST verschickt derzeit nichts; wenn es
// das mal soll, kommt es an der Stelle wieder rein, an der es gebraucht wird.
// Der oeffentliche VAPID-Schluessel und das Sende-Skript liegen weiterhin unter
// ~/Projects/blast-trainer-backups/.

export async function registriereSW() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker werden hier nicht unterstützt.');
  // Relativ zur Seite: Unter GitHub Pages liegt die App in einem Unterordner,
  // ein absoluter Pfad wuerde am falschen Ort suchen.
  return navigator.serviceWorker.register('./sw.js');
}
