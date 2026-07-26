// Theme-Wahl: "retro" (hellblau, Standard) oder "dark".
//
// Bewusst lokal gespeichert und nicht im Profil: Das ist eine Geraete-Vorliebe.
// Abends am Handy dunkel, tagsueber am Rechner hell – das waere kaputt, wenn die
// Wahl am Konto haengt. Ausserdem greift sie so ohne Netz und ohne Wartezeit.
const KEY = 'blast:theme';
const overlayQuellen = new Set();

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

// Eine einzige Quelle steuert die geschuetzte iOS-Leiste. Ist ein Overlay offen,
// traegt sie denselben dunklen Ton wie dessen Abdunklung; sonst die Seitenfarbe.
// Ein Set statt eines Booleans ist wichtig: Der Uebungskatalog kann innerhalb
// des Tutorials aufgehen. Schliesst er, muss das Tutorial die Leiste weiterhin
// dunkel halten.
export function statusleisteAnSeite() {
  const variable = overlayQuellen.size ? '--tutorial-dim' : '--bg';
  const bg = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (bg) metaFarbeSetzen(bg);
}

export function setStatusleistenOverlay(quelle, offen) {
  if (!quelle) return;
  if (offen) overlayQuellen.add(quelle);
  else overlayQuellen.delete(quelle);
  document.documentElement.classList.toggle('statusleiste-overlay', overlayQuellen.size > 0);
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
