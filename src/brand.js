// Der BLAST-Schriftzug als SVG.
//
// Warum SVG und nicht CSS: Gekruemmter Text laesst sich in CSS nicht setzen.
// Kontur, harter Schatten und die halbgrossen Sterne sind hier massstabsgetreu
// aus der frueheren CSS-Vorlage uebernommen (bei 26px Schrift: Kontur 2.5px,
// Sterne halb so gross mit 1.5px Kontur, Schatten 2px versetzt) und auf die
// SVG-Schriftgroesse 54 hochgerechnet.
//
// dxL/dxR/lift sind von Hand eingestellt, nicht gerechnet: Die Sterne sind
// kursiv UND angehoben, dadurch wandert ihre Tinte nach rechts – der linke
// rueckt ans B, der rechte vom T weg. Die Vorschub-Boxen bleiben dabei
// symmetrisch, die Optik nicht. Messen hilft hier also nicht weiter, nur
// hinsehen. Werte am Bildschirm abgestimmt.
const CURVE = 22;    // Anstieg der Bogenmitte
const LIFT = 3;      // wie hoch die Sterne ueber der Grundlinie sitzen
const DX_L = 10.5;   // Luecke linker Stern -> B
const DX_R = 0;      // Luecke T -> rechter Stern

let seq = 0;

export function brandSvg() {
  const id = 'brandpath' + (++seq);   // mehrere Logos gleichzeitig moeglich
  const y0 = 96;
  const d = `M 26,${y0} Q 175,${y0 - 2 * CURVE} 324,${y0}`;
  const txt =
    `<tspan font-size="27" stroke-width="3.1" dy="-${LIFT}">★</tspan>` +
    `<tspan dx="${DX_L}" dy="${LIFT}">BLAST</tspan>` +
    `<tspan font-size="27" stroke-width="3.1" dx="${DX_R}" dy="-${LIFT}">★</tspan>`;
  const path = `<textPath href="#${id}" startOffset="50%">${txt}</textPath>`;
  // viewBox eng am Inhalt (gemessen), damit der Bogen keine Luft verschenkt.
  // Farben ueber CSS-Variablen statt fest verdrahtet: So zieht das Logo beim
  // Theme-Wechsel mit. Kontur und Schatten haengen an --brand-outline – im
  // Dunkelmodus darf das nicht das gedeckte Navy bleiben, sonst verschwindet
  // die Kontur im Hintergrund und das pinke BLAST schwebt konturlos.
  return `<svg class="brand-svg" viewBox="53 18 252 83" role="img" aria-label="BLAST">
  <defs><path id="${id}" d="${d}" fill="none"/></defs>
  <g font-family="'Helvetica Neue',Arial,system-ui,sans-serif" font-style="italic" font-weight="900"
     font-size="54" letter-spacing="-1.62" text-anchor="middle"
     stroke="var(--brand-outline)" stroke-width="5.2" stroke-linejoin="round">
    <text transform="translate(4.2,4.2)" fill="var(--brand-outline)">${path}</text>
    <text fill="var(--pink)" paint-order="stroke fill">${path}</text>
  </g>
</svg>`;
}
