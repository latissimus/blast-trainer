// ===== VORUEBERGEHENDE DATEI – nach der Fehlersuche komplett loeschen! =====
//
// Grenzt das kurze Flackern im Logobereich beim Seitenwechsel ein. In der
// Kopfzeile liegen drei deckende Schichten uebereinander, die alle var(--bg)
// tragen und beim Wechsel gleichzeitig die Farbe wechseln; das Logo sitzt
// obendrauf. Jede Sonde schaltet genau einen Verdaechtigen ab – siehe die
// Regeln in styles.css, Abschnitt "VORUEBERGEHENDE SONDEN".
//
// Warum localStorage und nicht nur ?sonde=… in der URL: Das Flackern tritt
// ausschliesslich in der installierten Web-App auf, und dort gibt es keine
// Adresszeile. Der Schalter sitzt deshalb im Profil. Der URL-Parameter bleibt
// zusaetzlich erhalten – im Browser ist er der schnellere Weg.

const KEY = 'blast:sonde';
export const SONDEN = ['a', 'b', 'c', 'd', 'm'];

export function sondeLesen() {
  let aus = '';
  try { aus = localStorage.getItem(KEY) || ''; } catch (e) { /* privater Modus */ }
  try {
    const ausUrl = new URLSearchParams(location.search).get('sonde');
    if (SONDEN.includes(ausUrl)) aus = ausUrl;
  } catch (e) { /* egal */ }
  return SONDEN.includes(aus) ? aus : '';
}

export function sondeSetzen(wert) {
  try {
    if (SONDEN.includes(wert)) localStorage.setItem(KEY, wert);
    else localStorage.removeItem(KEY);
  } catch (e) { /* privater Modus: gilt nur fuer diese Sitzung */ }
  sondeAnwenden();
}

// Setzt das Attribut auf <html> (daran haengen die CSS-Regeln) und zeigt unten
// links eine rote Marke. Die Marke ist wichtig: Ohne sie waere nach einem
// Wechsel nicht sicher, ob die neue Fassung ueberhaupt geladen ist.
export function sondeAnwenden() {
  const aktiv = sondeLesen();
  const root = document.documentElement;
  if (aktiv) root.dataset.sonde = aktiv;
  else delete root.dataset.sonde;

  let marke = document.querySelector('.sondenmarke');
  if (!aktiv) { marke?.remove(); return; }
  if (!marke) {
    marke = document.createElement('div');
    marke.className = 'sondenmarke';
    document.body.appendChild(marke);
  }
  marke.textContent = aktiv === 'm' ? 'MESSUNG' : `SONDE ${aktiv.toUpperCase()}`;
  if (aktiv === 'm') messungStarten();
}

// ---- Sonde M: Messung statt Vermutung -------------------------------------
//
// Vier Sonden haben nichts gebracht, also wird jetzt aufgezeichnet, was beim
// Seitenwechsel wirklich passiert. Ein Flackern hat genau zwei moegliche
// Ursachen, und die lassen sich an den Bildabstaenden unterscheiden:
//
//   lange Bilder (>32ms)  -> der Hauptthread war blockiert, also JavaScript
//   alle Bilder kurz      -> reines Zeichen-/Kompositionsproblem, also CSS
//
// Long-Task- und Layout-Shift-Messung gibt es in Safari nicht; Bildabstaende
// ueber requestAnimationFrame dagegen schon. Gemessen wird ab jedem
// Adresswechsel fuer 1,5 Sekunden, das Ergebnis steht unten links.
let messungLaeuft = false;
function messungStarten() {
  if (messungLaeuft) return;
  messungLaeuft = true;
  const anzeigen = (text) => {
    const marke = document.querySelector('.sondenmarke');
    if (marke) marke.textContent = text;
  };
  const aufzeichnen = () => {
    const start = performance.now();
    let vorher = start;
    let laengste = 0, lang = 0, bilder = 0;
    const schritt = (jetzt) => {
      const abstand = jetzt - vorher;
      vorher = jetzt;
      bilder++;
      if (abstand > laengste) laengste = abstand;
      if (abstand > 32) lang++;
      if (jetzt - start < 1500) requestAnimationFrame(schritt);
      else anzeigen(`MESSUNG · längstes Bild ${laengste.toFixed(0)}ms · ${lang} lange von ${bilder}`);
    };
    anzeigen('MESSUNG · läuft…');
    requestAnimationFrame(schritt);
  };
  window.addEventListener('hashchange', aufzeichnen);
  aufzeichnen();
}
