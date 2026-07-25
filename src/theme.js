// Theme-Wahl: "retro" (hellblau, Standard) oder "dark".
//
// Bewusst lokal gespeichert und nicht im Profil: Das ist eine Geraete-Vorliebe.
// Abends am Handy dunkel, tagsueber am Rechner hell – das waere kaputt, wenn die
// Wahl am Konto haengt. Ausserdem greift sie so ohne Netz und ohne Wartezeit.
const KEY = 'blast:theme';
// War #AEDCF6/#12141A – die alten --bg-Werte von vor der Farbabstimmung auf
// retromuscle.net. Seitdem lief diese Liste der Wahrheit in styles.css
// hinterher: Beim Umschalten des Themes im Profil bekam die iOS-Statusleiste
// einen Farbton, den keine Flaeche der App mehr tatsaechlich zeigt.
const FARBE = { retro: '#B1E7FF', dark: '#0B0D12' };

export const gueltig = (t) => (t === 'dark' ? 'dark' : 'retro');

export function getTheme() {
  try { return gueltig(localStorage.getItem(KEY)); } catch (e) { return 'retro'; }
}

export function applyTheme(t) {
  const theme = gueltig(t);
  document.documentElement.setAttribute('data-theme', theme);
  // Faerbt auf dem iPhone die Statusleiste ueber der App – sonst bliebe oben
  // ein hellblauer Streifen ueber dem dunklen Log stehen.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', FARBE[theme]);
}

export function setTheme(t) {
  const theme = gueltig(t);
  try { localStorage.setItem(KEY, theme); } catch (e) { /* privater Modus: gilt nur fuer diese Sitzung */ }
  applyTheme(theme);
  return theme;
}

// Dunkle Statusleiste fuer Tutorial UND das "LOGMAN einrichten"-Vorspiel.
//
// WICHTIG zum Verstaendnis, warum das so schwer zu fassen war: index.html
// setzt apple-mobile-web-app-status-bar-style auf "black-translucent". Das
// bedeutet: Es gibt auf dem installierten iPhone gar keine separate, vom
// System eingefaerbte Statusleiste – der Bereich ist durchsichtig und zeigt
// exakt das, was die Seite an dieser Stelle selbst zeichnet. Das
// theme-color-Meta hilft dort kaum; es wirkt zuverlaessig nur in Safaris
// eigener Adressleiste (Tab-Modus), nicht in der installierten App. Der
// einzig verlaessliche Hebel ist echte Farbe im DOM an dieser Stelle – dafuer
// sorgt html.tutorial-laeuft (Canvas-Hintergrund) plus der feste Riegel
// ueber der Karte (body::before in styles.css, Abschnitt "Seitenmuster").
// Das Meta wird trotzdem mitgesetzt, weil es in einem normalen Safari-Tab
// (z.B. beim Testen ohne Installation) tatsaechlich greift.
export function dunkleStatusleiste(aktiv) {
  document.documentElement.classList.toggle('tutorial-laeuft', aktiv);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  if (aktiv) {
    const dunkel = getComputedStyle(document.documentElement).getPropertyValue('--tutorial-dim').trim();
    meta.setAttribute('content', dunkel || '#354859');
  } else {
    meta.setAttribute('content', FARBE[getTheme()]);
  }
}
