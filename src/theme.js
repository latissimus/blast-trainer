// Theme-Wahl: "retro" (hellblau, Standard) oder "dark".
//
// Bewusst lokal gespeichert und nicht im Profil: Das ist eine Geraete-Vorliebe.
// Abends am Handy dunkel, tagsueber am Rechner hell – das waere kaputt, wenn die
// Wahl am Konto haengt. Ausserdem greift sie so ohne Netz und ohne Wartezeit.
const KEY = 'blast:theme';

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

// EINE Regel fuer die Systemleiste oben: Sie traegt immer die Farbe der Seite,
// auf der man gerade ist. Progression flieder, FAQ gelb, Log hellblau.
//
// Bewusst OHNE Sonderfaelle. Frueher schaltete das Tutorial die Leiste auf
// einen dunklen Ton um – und weil das an Scroll- und Resize-Ereignissen hing,
// sprang sie beim Scrollen sichtbar um. Genau das soll nicht passieren:
// Dunkelt sich der Seiteninhalt ab, endet die Abdunkelung eben an der Kante
// zum geschuetzten Bereich. Die Leiste bleibt ruhig.
//
// --bg statt einer eigenen Liste: Die Farbe steht ohnehin schon in styles.css
// (:root[data-seite=…]). Eine zweite Liste in JS lief in der Vergangenheit
// zuverlaessig hinterher – genau daher kam der veraltete Ton #AEDCF6.
export function statusleisteAnSeite() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) metaFarbeSetzen(bg);
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
