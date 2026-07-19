// Erzeugt src/katalog.js aus Übungskatalog.xlsx.
//
// Haengt als prebuild am Build: Du bearbeitest die Excel, committest sie, und
// die Action erzeugt den Katalog beim Deploy neu. Kein Terminal, kein zweiter
// Schritt, nichts zu vergessen.
//
// Bewusst ohne Zusatzpaket: Eine xlsx ist ein Zip mit XML darin, und beides
// kann Node selbst. Ein npm-Paket nur zum Einlesen einer einzigen Datei waere
// ein Abhaengigkeitsrisiko fuer den Deploy, das in keinem Verhaeltnis steht.
//
// Bricht bei kaputten Daten ab, statt einen halben Katalog auszuliefern: Eine
// Uebung ohne Comp/Iso taucht in keinem Slot auf – das faellt im Studio auf,
// nicht hier. Lieber schlaegt der Deploy fehl.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(WURZEL, 'src', 'katalog.js');

// Die 15 Muskelkonten. Alles, was die Excel sonst nennt, ist ein Tippfehler –
// ein neues Konto ist eine Entscheidung, die hier stehen muss, damit das
// Wochenkonto es kennt.
const KONTEN = [
  'Brust', 'Lat', 'Oberer Rücken',
  'Vordere Schulter', 'Seitliche Schulter', 'Hintere Schulter',
  'Bizeps', 'Trizeps', 'Unterarme',
  'Quads', 'Hams', 'Glutes', 'Adduktoren', 'Waden', 'Abs',
];

// Korrekturen an der Tabelle, abgesprochen mit Florian.
//
// Hier und nicht in der Excel, damit seine Datei unangetastet bleibt: Bessert
// er dieselbe Zelle spaeter selbst aus, ist der Eintrag hier einfach wirkungslos.
// Verschwindet der Name dagegen ganz, warnt der Generator – sonst wuerde eine
// Korrektur still ins Leere laufen.
const KORREKTUREN = {
  // Nebenspieler war '32' (verrutschte Eingabe), Comp/Iso fehlte.
  'KH Nubret Seitheben, liegend': { neben: [], typ: 'Iso' },
  // Hauptspieler stand jeweils nochmal als Nebenspieler – das gaebe im
  // Wochenkonto einen doppelten Punkt (1,0 + 0,5) fuer denselben Satz.
  'LH Shruggs': { neben: [] },
  'Multipresse Shruggs': { neben: [] },
  'KH Shruggs': { neben: [] },
  'Kabel Shruggs': { neben: [] },
  'PL Abduktionen': { haupt: 'Glutes', neben: [] },
  'Steck Abduktionen': { haupt: 'Glutes', neben: [] },
};

/* ---------------------------------------------------------------- zip */
// Minimaler Zip-Leser: zentrales Verzeichnis lesen, benoetigte Eintraege
// entpacken. Reicht fuer xlsx (Methode 0 = gespeichert, 8 = deflate).
function zipEintraege(buf) {
  // End-of-Central-Directory von hinten suchen (Kommentar am Ende ist erlaubt).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Kein gültiges Zip (xlsx beschädigt?)');

  const anzahl = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const raus = {};

  for (let i = 0; i < anzahl; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('Zip-Verzeichnis unlesbar');
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const kommLen = buf.readUInt16LE(off + 32);
    const lokal = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

    // Groesse und Methode aus dem lokalen Kopf: Bei gesetztem Datei-Flag stehen
    // sie im zentralen Verzeichnis, aber der lokale Kopf ist immer gueltig.
    const lNameLen = buf.readUInt16LE(lokal + 26);
    const lExtraLen = buf.readUInt16LE(lokal + 28);
    const methode = buf.readUInt16LE(lokal + 8);
    const start = lokal + 30 + lNameLen + lExtraLen;
    const compSize = buf.readUInt32LE(off + 20);
    const roh = buf.subarray(start, start + compSize);

    raus[name] = methode === 0 ? roh : zlib.inflateRawSync(roh);
    off += 46 + nameLen + extraLen + kommLen;
  }
  return raus;
}

/* ---------------------------------------------------------------- xml */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const entschluessle = (s) =>
  s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (ganz, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : ganz;
    }
    return ENTITIES[code] ?? ganz;
  });

const textVon = (xml) => {
  let t = '';
  for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += m[1];
  return entschluessle(t);
};

function leseTabelle(dateien) {
  const ssXml = dateien['xl/sharedStrings.xml'];
  const texte = [];
  if (ssXml) {
    for (const m of ssXml.toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)) texte.push(textVon(m[1]));
  }

  const blatt = dateien['xl/worksheets/sheet1.xml'];
  if (!blatt) throw new Error('sheet1.xml fehlt in der xlsx');
  const xml = blatt.toString('utf8');

  const zeilen = [];
  // Die Alternative fuer <row .../> ist noetig: Ohne sie wuerde eine leere,
  // selbstschliessende Zeile den Ausdruck bis zum naechsten </row> weiterlaufen
  // lassen und den Inhalt dazwischen verschlucken.
  for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const nr = Number((r[1].match(/\br="(\d+)"/) || [])[1]);
    const zellen = {};
    for (const c of (r[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1], inhalt = c[2] || '';
      const spalte = (attrs.match(/\br="([A-Z]+)\d+"/) || [])[1];
      if (!spalte) continue;
      const typ = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      let wert;
      if (typ === 'inlineStr') {
        wert = textVon(inhalt);
      } else {
        const v = (inhalt.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (v === undefined) continue;
        wert = typ === 's' ? texte[Number(v)] : entschluessle(v);
      }
      wert = String(wert ?? '').trim();
      if (wert) zellen[spalte] = wert;
    }
    zeilen.push({ nr, zellen });
  }
  return zeilen;
}

/* ---------------------------------------------------------------- lauf */
// Der Dateiname enthaelt ein Ü. macOS legt Umlaute zerlegt ab (U + Trema),
// Linux nimmt die Bytes wie sie kommen – ein fest verdrahteter Name findet die
// Datei auf dem CI-Rechner sonst nicht. Darum wird das Verzeichnis durchsucht
// und normalisiert verglichen.
function findeExcel() {
  const treffer = fs.readdirSync(WURZEL)
    .filter((f) => /bungskatalog\.xlsx$/i.test(f.normalize('NFC')));
  if (!treffer.length) {
    throw new Error(`Übungskatalog.xlsx nicht gefunden in ${WURZEL}`);
  }
  if (treffer.length > 1) {
    throw new Error(`Mehrere Katalog-Dateien gefunden: ${treffer.join(', ')}`);
  }
  return path.join(WURZEL, treffer[0]);
}

const quelle = findeExcel();
const zeilen = leseTabelle(zipEintraege(fs.readFileSync(quelle)));

const fehler = [];
const eintraege = [];
const gesehen = new Map();

for (const { nr, zellen } of zeilen) {
  const name = zellen.A;
  if (!name || nr === 1) continue;          // Kopfzeile
  if (name.startsWith('■')) continue;        // Abschnitts-Trenner

  const korr = KORREKTUREN[name] || {};
  const haupt = korr.haupt ?? zellen.B ?? '';
  const typ = korr.typ ?? zellen.D ?? '';
  const neben = korr.neben ?? String(zellen.C || '')
    .split(',').map((s) => s.trim())
    .filter((s) => s && s !== '—');

  const melde = (was) => fehler.push(`  Zeile ${nr} · ${name}: ${was}`);

  if (!haupt) melde('kein Hauptspieler');
  else if (!KONTEN.includes(haupt)) melde(`Hauptspieler "${haupt}" ist kein bekanntes Muskelkonto`);

  if (!typ) melde('kein Comp/Iso');
  else if (typ !== 'Comp' && typ !== 'Iso') melde(`Comp/Iso ist "${typ}" (erlaubt: Comp, Iso)`);

  neben.forEach((n) => {
    if (!KONTEN.includes(n)) melde(`Nebenspieler "${n}" ist kein bekanntes Muskelkonto`);
    // Doppelte Punkte im Wochenkonto: derselbe Satz zaehlte 1,0 + 0,5.
    else if (n === haupt) melde(`"${n}" steht als Haupt- und als Nebenspieler`);
  });

  const schluessel = name.toLowerCase();
  if (gesehen.has(schluessel)) melde(`Name schon in Zeile ${gesehen.get(schluessel)}`);
  else gesehen.set(schluessel, nr);

  eintraege.push({ n: name, haupt, neben, typ });
}

// Eine Korrektur, deren Uebung es nicht mehr gibt, laeuft still ins Leere.
Object.keys(KORREKTUREN).forEach((name) => {
  if (!gesehen.has(name.toLowerCase())) {
    console.warn(`  Warnung: Korrektur für "${name}" greift nicht – Übung steht nicht mehr in der Excel.`);
  }
});

if (!eintraege.length) fehler.push('  Keine einzige Übung gefunden – stimmt das Tabellenblatt?');

if (fehler.length) {
  console.error(`\nKatalog nicht erzeugt. ${fehler.length} Problem(e) in ${path.basename(quelle)}:\n`);
  console.error(fehler.join('\n'));
  console.error('\nBitte in der Excel korrigieren und neu bauen.\n');
  process.exit(1);
}

const zeile = (e) =>
  `  { n: ${JSON.stringify(e.n)}, haupt: ${JSON.stringify(e.haupt)}, ` +
  `neben: [${e.neben.map((x) => JSON.stringify(x)).join(', ')}], typ: ${JSON.stringify(e.typ)} },`;

const inhalt = `// GENERIERT von scripts/gen-katalog.mjs – nicht von Hand ändern.
// Quelle: ${path.basename(quelle)}. Änderungen gehören in die Excel; der Build
// erzeugt diese Datei daraus neu (prebuild).
//
// haupt = Hauptspieler (zählt im Wochenkonto voll), neben = Nebenspieler
// (zählt halb), typ = Comp/Iso (entscheidet, in welchem Slot die Übung steht).

export const KONTEN = [
${KONTEN.map((k) => `  ${JSON.stringify(k)},`).join('\n')}
];

export const KATALOG = [
${eintraege.map(zeile).join('\n')}
];
`;

fs.writeFileSync(ZIEL, inhalt);

const proKonto = {};
eintraege.forEach((e) => { proKonto[e.haupt] = (proKonto[e.haupt] || 0) + 1; });
const comp = eintraege.filter((e) => e.typ === 'Comp').length;
console.log(`Katalog erzeugt: ${eintraege.length} Übungen (${comp} Comp / ${eintraege.length - comp} Iso) → src/katalog.js`);
console.log(KONTEN.map((k) => `  ${k}: ${proKonto[k] || 0}`).join('\n'));
KONTEN.filter((k) => !proKonto[k]).forEach((k) => console.warn(`  Warnung: kein einziger Eintrag für "${k}"`));
