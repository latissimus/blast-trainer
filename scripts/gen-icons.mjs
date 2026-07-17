// Erzeugt die Homescreen-Icons aus einer SVG-Vorlage: pinkes "L" im RetroMuscle-
// Stil (Navy-Kontur, harter Schatten) auf Hellblau – dasselbe Motiv wie das Logo.
//
// Warum als Skript und nicht von Hand gemalt: So sind die drei PNGs reproduzierbar
// und ziehen mit, falls sich Farbe oder Form aendern.  Aufruf:  node scripts/gen-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#AEDCF6"/>
  <g font-family="Helvetica Neue, Arial, sans-serif" font-style="italic" font-weight="900" font-size="360" text-anchor="middle" stroke="#0B1B44" stroke-width="34" stroke-linejoin="round">
    <text x="256" y="384" fill="#0B1B44" transform="translate(14,14)">L</text>
    <text x="256" y="384" fill="#F48FB8" paint-order="stroke">L</text>
  </g>
</svg>`;

const targets = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
];

for (const [path, size] of targets) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' },
  });
  writeFileSync(path, r.render().asPng());
  console.log('geschrieben:', path, size + 'px');
}
