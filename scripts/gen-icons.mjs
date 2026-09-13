// Erzeugt die Homescreen-Icons aus der Vorlage LOGMANSYMBOL.svg im Repo-Root.
// Die SVG-Datei ist die einzige Quelle; die drei PNGs werden bei jedem Aufruf
// daraus reproduzierbar gerendert und in public/ abgelegt.
//   Aufruf:  node scripts/gen-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('LOGMANSYMBOL.svg', 'utf8');

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
