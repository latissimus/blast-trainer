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
export const SONDEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r'];

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
    // NOTAUSGANG: Ein Tipp auf die Marke schaltet jede Sonde ab, egal in
    // welchem Zustand die App steckt. Sonde P hatte sich selbst eingesperrt –
    // sie verhinderte den Seitenwechsel ins Profil, wo ihr Schalter sitzt.
    // Dieser Ausweg haengt an nichts als der Marke selbst.
    marke.addEventListener('click', () => {
      try { localStorage.removeItem(KEY); } catch (e) { /* egal */ }
      location.reload();
    });
    document.body.appendChild(marke);
  }
  marke.textContent = (aktiv === 'm' ? 'MESSUNG'
    : aktiv === 'n' ? 'NACHWEIS' : `SONDE ${aktiv.toUpperCase()}`) + '  ✕';
  if (aktiv === 'm') messungStarten();
  if (aktiv === 'n') nachweisStarten();
}

// ---- Sonde N: Was passiert mit der Kopfzeile beim Wechsel? -----------------
//
// Neun Sonden haben nichts gebracht, also wird wieder gemessen statt geraten.
// Beobachtet werden die 30 Bilder nach einem Seitenwechsel, und zwar drei
// Dinge, die sich gegenseitig ausschliessen:
//
//   Knoten ERSETZT      -> die Kopfzeile wird neu gebaut, nicht nur neu gemalt
//   top wird negativ    -> sie rutscht aus dem Bild (Klebe-Position verliert sich)
//   top bleibt 0, gleich-> Layout und DOM sind in Ordnung; es fehlt allein die
//                          Zeichenebene. Dann hilft nur, ihr eine eigene, feste
//                          Ebene zu geben – ganz andere Baustelle als bisher.
//
// Zusaetzlich wird geprueft, ob sie fuer ein Bild unsichtbar geschaltet wird
// (opacity/visibility), was bisher niemand ausgeschlossen hat.
let nachweisLaeuft = false;
function nachweisStarten() {
  if (nachweisLaeuft) return;
  nachweisLaeuft = true;
  const anzeigen = (text) => {
    const marke = document.querySelector('.sondenmarke');
    if (marke) marke.textContent = text;
  };
  const beobachte = () => {
    const vorher = document.querySelector('.topbar');
    let minTop = Infinity, maxTop = -Infinity;
    let ersetzt = false, verschwunden = false, unsichtbar = false;
    let n = 0;
    const schritt = () => {
      const tb = document.querySelector('.topbar');
      if (!tb) { verschwunden = true; }
      else {
        if (tb !== vorher) ersetzt = true;
        const cs = getComputedStyle(tb);
        if (cs.visibility !== 'visible' || Number(cs.opacity) < 1) unsichtbar = true;
        const t = tb.getBoundingClientRect().top;
        if (t < minTop) minTop = t;
        if (t > maxTop) maxTop = t;
      }
      if (++n < 30) requestAnimationFrame(schritt);
      else anzeigen(`N · top ${Math.round(minTop)}…${Math.round(maxTop)}`
        + ` · Knoten ${ersetzt ? 'ERSETZT' : 'gleich'}`
        + (verschwunden ? ' · ZEITWEISE WEG' : '')
        + (unsichtbar ? ' · UNSICHTBAR GESCHALTET' : ''));
    };
    anzeigen('N · messe…');
    requestAnimationFrame(schritt);
  };
  window.addEventListener('hashchange', beobachte);
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
