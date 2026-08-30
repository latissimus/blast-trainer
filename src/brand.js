// Der LOGMAN-Schriftzug als SVG.
//
// Warum SVG und nicht CSS: Gekruemmter Text laesst sich in CSS nicht setzen.
// Kontur, harter Schatten und die halbgrossen Sterne sind massstabsgetreu
// aus der CSS-Vorlage uebernommen (bei 26px Schrift: Kontur 2.5px, Sterne halb
// so gross mit 1.5px Kontur, Schatten 2px versetzt) und auf die SVG-Schriftgroesse
// 54 hochgerechnet.
//
// DX_L/DX_R/LIFT sind von Hand eingestellt, nicht gerechnet: Die Sterne sind
// kursiv UND angehoben, dadurch wandert ihre Tinte nach rechts. Messen hilft
// hier nicht weiter, nur hinsehen. Werte am Schieberegler abgestimmt (LOGMAN:
// DX_L 8, DX_R 7 – Sterne sitzen gleich weit von L und N).
const CURVE = 22;    // Anstieg der Bogenmitte
const LIFT = 3;      // wie hoch die Sterne ueber der Grundlinie sitzen
const DX_L = 8;      // Luecke linker Stern -> L
const DX_R = 7;      // Luecke N -> rechter Stern

let seq = 0;

export function brandSvg() {
  const id = 'brandpath' + (++seq);   // mehrere Logos gleichzeitig moeglich
  const y0 = 96;
  const d = `M 26,${y0} Q 175,${y0 - 2 * CURVE} 324,${y0}`;
  const txt =
    `<tspan font-size="27" stroke-width="3.1" dy="-${LIFT}">★</tspan>` +
    `<tspan dx="${DX_L}" dy="${LIFT}">LOGMAN</tspan>` +
    `<tspan font-size="27" stroke-width="3.1" dx="${DX_R}" dy="-${LIFT}">★</tspan>`;
  const path = `<textPath href="#${id}" startOffset="50%">${txt}</textPath>`;
  // viewBox eng am Inhalt (1:1 ausgemessen: x 19.5–334.7, y 21–102.6 inkl.
  // Schatten), damit der Bogen keine Luft verschenkt.
  // Farben ueber CSS-Variablen statt fest verdrahtet: So zieht das Logo beim
  // Theme-Wechsel mit. Kontur und Schatten haengen an --brand-outline – im
  // Dunkelmodus darf das nicht das gedeckte Navy bleiben, sonst verschwindet
  // die Kontur im Hintergrund und das pinke LOGMAN schwebt konturlos.
  return `<svg class="brand-svg" viewBox="18 19 318 85" role="img" aria-label="LOGMAN">
  <defs><path id="${id}" d="${d}" fill="none"/></defs>
  <g font-family="'Work Sans'" font-style="italic" font-weight="700"
     font-size="54" letter-spacing="-1.62" text-anchor="middle"
     stroke="var(--brand-outline)" stroke-width="5.2" stroke-linejoin="round">
    <text transform="translate(4.2,4.2)" fill="var(--brand-outline)">${path}</text>
    <text fill="var(--pink)" paint-order="stroke fill">${path}</text>
  </g>
</svg>`;
}

// Kurzer Aktionsschriftzug fuer die Vollbildanimationen. Dieselbe Schrift,
// Kruemmung, Kontur und derselbe harte Versatz wie beim Logo – nur ohne Sterne,
// damit kurze Aussagen auch auf einem schmalen iPhone ruhig bleiben.
//
// GEFUNDENER FEHLER, nicht nur Geschmack: "PLAN EINRICHTEN" erschien als
// "AN EINRICHT". SVG-textPath streckt einen zu langen Text nicht und bricht
// ihn nicht um – Zeichen, die ueber das Pfadende hinausfallen, werden
// ERSATZLOS NICHT GEZEICHNET. Der Pfad unten ist rund 331 Einheiten lang;
// bei fester Schriftgroesse 57 braucht "PLAN EINRICHTEN" rund 500 Einheiten
// Vorschubbreite – die aeusseren Buchstaben fielen beidseitig weg, ohne
// Fehler, ohne Warnung.
//
// Deshalb wird VOR dem Bauen der eigentlichen Grafik echt im DOM gemessen
// (Canvas-Textmessung kennt kein SVG letter-spacing und waere nur eine
// Naeherung) und die Schrift bei Bedarf verkleinert – nie vergroessert, kurze
// Woerter behalten ihre volle Praesenz.
const AKTION_PFAD = 'M 18,91 Q 180,33 342,91';
const AKTION_SCHRIFT = 57, AKTION_KONTUR = 5.2, AKTION_SPERRUNG = -1.7;
let aktionPfadlaenge = null;   // einmal berechnet, danach wiederverwendet

function textVorschub(text, fontSize) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'position:absolute;left:-9999px;top:-9999px');
  svg.innerHTML = `<text font-family="'Work Sans'"
    font-style="italic" font-weight="700" font-size="${fontSize}"
    letter-spacing="${AKTION_SPERRUNG}">${text}</text>`;
  document.body.appendChild(svg);
  const breite = svg.querySelector('text').getBBox().width;
  document.body.removeChild(svg);
  return breite;
}

export function actionTitleSvg(text) {
  const id = 'actionpath' + (++seq);
  let fontSize = AKTION_SCHRIFT, strokeWidth = AKTION_KONTUR, spacing = AKTION_SPERRUNG;
  try {
    if (aktionPfadlaenge == null) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', AKTION_PFAD);
      aktionPfadlaenge = p.getTotalLength();
    }
    // 20 Einheiten Sicherheitsabstand: Kontur und Schlagschatten brauchen an
    // den Enden noch etwas Luft, sonst wirkt der letzte Buchstabe abgeschnitten.
    const ziel = aktionPfadlaenge - 20;
    const vorschub = textVorschub(text, AKTION_SCHRIFT);
    if (vorschub > ziel) {
      const faktor = ziel / vorschub;
      fontSize = +(AKTION_SCHRIFT * faktor).toFixed(1);
      strokeWidth = +(AKTION_KONTUR * faktor).toFixed(2);
      spacing = +(AKTION_SPERRUNG * faktor).toFixed(2);
    }
  } catch (e) { /* Messung optional – ungemessen bleibt es bei der Standardgroesse */ }
  const path = `<textPath href="#${id}" startOffset="50%">${text}</textPath>`;
  return `<svg class="action-title-svg" viewBox="0 0 360 112" role="img" aria-label="${text}">
    <defs><path id="${id}" d="${AKTION_PFAD}" fill="none"/></defs>
    <g font-family="'Work Sans'" font-style="italic"
       font-weight="700" font-size="${fontSize}" letter-spacing="${spacing}" text-anchor="middle"
       stroke="var(--navy)" stroke-width="${strokeWidth}" stroke-linejoin="round">
      <text transform="translate(4,4)" fill="var(--navy)">${path}</text>
      <text fill="var(--pink)" paint-order="stroke fill">${path}</text>
    </g>
  </svg>`;
}
