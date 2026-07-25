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

// Gruende, aus denen die Statusleiste gerade dunkel sein muss (Tutorial,
// Uebungswaehler, …). Steht hier oben, weil applyTheme() sie schon kennen
// muss – Details bei dunkleStatusleiste() weiter unten.
const dunkelGruende = new Set();

export function getTheme() {
  try { return gueltig(localStorage.getItem(KEY)); } catch (e) { return 'retro'; }
}

export function applyTheme(t) {
  const theme = gueltig(t);
  document.documentElement.setAttribute('data-theme', theme);
  // Faerbt auf dem iPhone die Statusleiste ueber der App – sonst bliebe oben
  // ein hellblauer Streifen ueber dem dunklen Log stehen.
  //
  // ABER NICHT, solange etwas den Bildschirm abdunkelt: render() ruft diese
  // Funktion bei jedem Seitenaufbau, setTheme() beim Umschalten im Profil.
  // Ohne die Sperre haette jeder dieser Aufrufe die dunkle Statusleiste eines
  // offenen Uebungswaehlers oder des Tutorials wieder aufgehellt – und zwar
  // lautlos, weil dunkleStatusleiste() davon nichts mitbekommt.
  if (dunkelGruende.size > 0) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', FARBE[theme]);
}

export function setTheme(t) {
  const theme = gueltig(t);
  try { localStorage.setItem(KEY, theme); } catch (e) { /* privater Modus: gilt nur fuer diese Sitzung */ }
  applyTheme(theme);
  return theme;
}

// Dunkle Statusleiste fuer alles, was den Bildschirm abdunkelt: Tutorial,
// das "LOGMAN einrichten"-Vorspiel und der Uebungswaehler.
//
// WICHTIG zum Verstaendnis, warum das so schwer zu fassen war: index.html
// setzt apple-mobile-web-app-status-bar-style auf "black-translucent". Das
// bedeutet: Es gibt auf dem installierten iPhone gar keine separate, vom
// System eingefaerbte Statusleiste – der Bereich ist durchsichtig und zeigt
// exakt das, was die Seite an dieser Stelle selbst zeichnet. Dafuer sorgt
// html.statusleiste-dunkel (Canvas-Hintergrund) plus der feste Riegel
// (body::before in styles.css, Abschnitt "Seitenmuster").
// Das theme-color-Meta wird mitgesetzt, weil es im Safari-Tab greift – und
// weil iOS daran die Farbe von Uhrzeit und Akku festmacht: dunkles Meta
// bedeutet weisse Systemelemente. Genau das macht sie ueber dem Dimmer lesbar.
//
// MEHRERE GRUENDE GLEICHZEITIG: Im Tutorial wird auch der Uebungswaehler
// geoeffnet. Wuerde jeder Aufrufer die Leiste einfach umschalten, haette das
// Schliessen des Waehlers sie mitten im Tutorial wieder aufgehellt. Deshalb
// werden die Gruende gezaehlt – dunkel bleibt es, solange noch einer offen ist.
export function dunkleStatusleiste(aktiv, grund = 'tutorial') {
  if (aktiv) dunkelGruende.add(grund);
  else dunkelGruende.delete(grund);
  const an = dunkelGruende.size > 0;
  document.documentElement.classList.toggle('statusleiste-dunkel', an);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  if (an) {
    const dunkel = getComputedStyle(document.documentElement).getPropertyValue('--tutorial-dim').trim();
    meta.setAttribute('content', dunkel || '#354859');
  } else {
    meta.setAttribute('content', FARBE[getTheme()]);
  }
}
