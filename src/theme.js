// Theme-Wahl: "retro" (hellblau, Standard) oder "dark".
//
// Bewusst lokal gespeichert und nicht im Profil: Das ist eine Geraete-Vorliebe.
// Abends am Handy dunkel, tagsueber am Rechner hell – das waere kaputt, wenn die
// Wahl am Konto haengt. Ausserdem greift sie so ohne Netz und ohne Wartezeit.
const KEY = 'blast:theme';
const LOG_BG = '#B1E7FF';
const overlayQuellen = new Set();
let overlayScrollY = 0;

export const gueltig = (t) => (t === 'dark' ? 'dark' : 'retro');

export function getTheme() {
  try { return gueltig(localStorage.getItem(KEY)); } catch (e) { return 'retro'; }
}

// iOS Safari liest theme-color nicht zuverlaessig neu, wenn nur das ATTRIBUT
// geaendert wird. Der Knoten wird deshalb ersetzt, das erzwingt die
// Neubewertung. Auf Android ist das unnoetig, aber harmlos.
function metaFarbeSetzen(farbe) {
  const alt = document.querySelector('meta[name="theme-color"]');
  if (!alt || alt.getAttribute('content') === farbe) return;
  const neu = document.createElement('meta');
  neu.setAttribute('name', 'theme-color');
  neu.setAttribute('content', farbe);
  alt.replaceWith(neu);
}

// Eine einzige Quelle steuert die geschuetzte iOS-Leiste. Die App-Hülle bleibt
// über Unterseiten hinweg gleich; Tutorial und Einstieg setzen denselben
// LOGMAN-Grundton ausdrücklich fest.
// Ein Set statt eines Booleans hält auch verschachtelte Marken-/Tutorial-
// Zustände sauber zusammen.
export function statusleisteAnSeite() {
  const root = document.documentElement;
  const overlayBg = root.style.getPropertyValue('--statusbar-bg').trim();
  const styles = getComputedStyle(root);
  // Die native iOS-Leiste gehört optisch zur dauerhaft hellblauen bzw.
  // dunkelblauen App-Hülle, nicht zum wechselnden Unterseitenhintergrund.
  // Dadurch muss WebKit den oberen Displaybereich beim Routenwechsel nicht
  // jedes Mal mit einer neuen theme-color neu aufbauen.
  const bg = overlayBg ||
    styles.getPropertyValue('--chrome-bg').trim() ||
    styles.getPropertyValue('--bg').trim();
  if (bg) metaFarbeSetzen(bg);
}

export function setStatusleistenOverlay(quelle, offen) {
  if (!quelle) return;
  const warOffen = overlayQuellen.size > 0;
  if (offen) overlayQuellen.add(quelle);
  else overlayQuellen.delete(quelle);
  const istOffen = overlayQuellen.size > 0;
  const root = document.documentElement;
  root.classList.toggle('statusleiste-overlay', istOffen);
  if (istOffen && (overlayQuellen.has('tutorial') || overlayQuellen.has('einstieg'))) {
    root.style.setProperty('--statusbar-bg', LOG_BG);
  } else {
    root.style.removeProperty('--statusbar-bg');
  }

  // In der installierten iOS-App liegt die Statusleiste transparent ueber der
  // Seite. Scrollt das Browserfenster, bewertet WebKit die Flaeche darunter
  // neu – beim Tutorial war das die weisse sticky Karte. Solange ein Overlay
  // offen ist, bleibt das Fenster deshalb bei 0; stattdessen scrollt nur #view
  // innerhalb der feststehenden App. Verschachtelte Overlays teilen sich
  // diesen Zustand ueber overlayQuellen.
  if (!warOffen && istOffen) {
    overlayScrollY = window.scrollY;
    root.classList.add('overlay-scroll-gesperrt');
    const scroller = document.querySelector('#view');
    if (scroller) scroller.scrollTop = overlayScrollY;
    window.scrollTo(0, 0);
  } else if (warOffen && !istOffen) {
    const scroller = document.querySelector('#view');
    overlayScrollY = scroller?.scrollTop || 0;
    root.classList.remove('overlay-scroll-gesperrt');
    if (scroller) scroller.scrollTop = 0;
    window.scrollTo(0, overlayScrollY);
  }
  statusleisteAnSeite();
}

export function applyTheme(t) {
  const theme = gueltig(t);
  document.documentElement.setAttribute('data-theme', theme);
  // Nach dem Themewechsel steht ein anderes --bg an derselben Seite.
  statusleisteAnSeite();
}

export function setTheme(t) {
  const theme = gueltig(t);
  try { localStorage.setItem(KEY, theme); } catch (e) { /* privater Modus: gilt nur fuer diese Sitzung */ }
  applyTheme(theme);
  return theme;
}
