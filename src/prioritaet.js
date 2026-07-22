import { TPL } from './template.js';
import { KATALOG, KONTEN } from './katalog.js';
import { targetSets, exOf } from './saetze.js';

// Muskel-Priorisierung ist eine PLANUNGSREGEL ueber dem Tages-Level:
// Auf jedem Level bekommt genau ein geeignetes Pumpfeld pro Zielmuskel einen
// Satz mehr. Bei einer Umverteilung werden Ziel- und Spenderfeld schon vor der
// Uebungswahl verbindlich reserviert. So bleibt die Bilanz immer +1/−1 und aus
// einer noch leeren Spender-Uebung wird nie still ein Volumenaufschlag.

const klein = (s) => String(s || '').trim().toLowerCase();
const slotKey = (tag, blockId, xi) => `${tag}|${blockId}|${xi}`;

export const istDeload = (woche) => Number(woche) >= 7;

export function tageDerWoche(payload, woche) {
  if (istDeload(woche)) return ['MRs', 'MRs-2', 'MRs-3'];
  const rot = ((payload && payload.rot) || {})[woche] || (Number(woche) % 2 === 1 ? 'A' : 'B');
  return ['OK-' + rot, 'UK-' + rot, 'MRs'];
}

export function tierVon(payload, tag, woche) {
  if (istDeload(woche)) return 0;
  const t = ((payload && payload.tier) || {})[tag + '|' + woche];
  return (t === 0 || t === 1 || t === 2) ? t : 1;
}

const volumenVon = (payload) => (payload && payload.volumen) || {};
export const prioritaetenVon = (payload) => volumenVon(payload).prioritaet || {};

function katalogIndex(katalog) {
  return new Map((katalog || KATALOG).map((e) => [klein(e.n), e]));
}

// Alle in dieser Woche tatsaechlich gewaehlten, regulaeren Pumpfelder.
// Pump-Ausnahmen innerhalb des Cluster-Tags bleiben absichtlich draussen:
// eine Priorisierung soll normale Arbeit verschieben, keine weitere
// Cluster-Runde bzw. einen Sonderfall im Deload erzeugen.
export function pumpFelder(payload, woche, katalog = KATALOG) {
  const idx = katalogIndex(katalog);
  const data = (payload && payload.data) || {};
  const felder = [];

  tageDerWoche(payload, woche).forEach((tag) => {
    const tpl = TPL[tag];
    if (!tpl) return;
    const tier = tierVon(payload, tag, woche);
    const zelle = ((data[tag] || {})[woche]) || {};

    tpl.blocks.forEach((blk) => {
      if (blk.type !== 'pump' || !targetSets(blk, tier)) return;
      const eintragBlock = zelle[blk.id] || {};
      const namen = eintragBlock.names || [];

      exOf(blk, tier).forEach((exDef, xi) => {
        const name = String(namen[xi] || '').trim();
        const eintrag = idx.get(klein(name));
        if (!eintrag) return;
        felder.push({
          key: slotKey(tag, blk.id, xi), tag, blockId: blk.id, xi,
          mus: blk.mus, name, konto: eintrag.haupt, neben: eintrag.neben || [],
          tier, anzahl: targetSets(blk, tier),
          erlaubt: exDef.konten || blk.konten || [],
        });
      });
    });
  });
  return felder;
}

// Schon vor der Uebungswahl ist damit bekannt, an welchem Tag und in welchem
// leeren Feld ein Muskel einen regulaeren Pumpplatz haben kann.
export function pumpMoeglichkeiten(payload, woche, konto) {
  const treffer = [];
  tageDerWoche(payload, woche).forEach((tag) => {
    const tpl = TPL[tag];
    if (!tpl) return;
    const tier = tierVon(payload, tag, woche);
    tpl.blocks.forEach((blk) => {
      if (blk.type !== 'pump' || !targetSets(blk, tier)) return;
      exOf(blk, tier).forEach((exDef, xi) => {
        const erlaubt = exDef.konten || blk.konten || [];
        if (erlaubt.includes(konto)) treffer.push({
          key: slotKey(tag, blk.id, xi), tag, blockId: blk.id, xi,
          mus: blk.mus, tier, anzahl: targetSets(blk, tier), erlaubt,
        });
      });
    });
  });
  return treffer;
}

const gueltigePrio = (cfg) => cfg && (cfg.modus === 'plus' || cfg.modus === 'tausch');

function bestesFeld(felder) {
  return [...felder].sort((a, b) => b.anzahl - a.anzahl || a.key.localeCompare(b.key))[0] || null;
}

/**
 * Abgeleitete Satzverschiebungen fuer die aktuelle Woche.
 * @returns {{ delta: Record<string, number>, ergebnisse: Record<string, object> }}
 */
export function prioritaetsAnpassungen(payload, woche, katalog = KATALOG) {
  const felder = pumpFelder(payload, woche, katalog);
  const prioritaet = prioritaetenVon(payload);
  const delta = {};
  const ergebnisse = {};
  const belegteFelder = new Set(felder.map((f) => f.key));
  const reservierteZiele = new Set();
  const reservierteSpender = new Set();

  KONTEN.forEach((ziel) => {
    const cfg = prioritaet[ziel];
    if (!gueltigePrio(cfg)) return;
    const echtesZiel = bestesFeld(felder.filter((f) => f.konto === ziel));
    const freiesZiel = bestesFeld(pumpMoeglichkeiten(payload, woche, ziel).filter((f) =>
      !belegteFelder.has(f.key) && !reservierteZiele.has(f.key)));
    const zielFeld = echtesZiel || freiesZiel;
    if (!zielFeld) {
      ergebnisse[ziel] = { status: 'ziel-fehlt', modus: cfg.modus };
      return;
    }
    reservierteZiele.add(zielFeld.key);
    const vorgemerkt = !echtesZiel;

    if (cfg.modus === 'plus') {
      delta[zielFeld.key] = (delta[zielFeld.key] || 0) + 1;
      ergebnisse[ziel] = { status: 'aktiv', modus: 'plus', zielFeld, vorgemerkt };
      return;
    }

    const spender = cfg.spender;
    // Ein priorisierter Muskel darf nicht gleichzeitig still als Spender
    // dienen. Die Konfiguration bleibt sichtbar, wirkt aber nicht halb.
    if (!spender || gueltigePrio(prioritaet[spender])) {
      ergebnisse[ziel] = { status: 'spender-fehlt', modus: 'tausch', zielFeld, spender };
      return;
    }
    // Eine freie Wahl speichert den konkreten Pumpplatz. Dadurch bleibt z. B.
    // "Rücken" derselbe Spender, egal ob dort später Lat oder oberer Rücken
    // als konkrete Übung gewählt wird.
    const festBelegt = cfg.spenderFeld ? bestesFeld(felder.filter((f) =>
      f.key === cfg.spenderFeld && f.tag === zielFeld.tag && f.key !== zielFeld.key &&
      f.anzahl + (delta[f.key] || 0) > 0)) : null;
    const festLeer = cfg.spenderFeld && !festBelegt ? bestesFeld(pumpMoeglichkeiten(payload, woche, spender).filter((f) =>
      f.key === cfg.spenderFeld && f.tag === zielFeld.tag && f.key !== zielFeld.key &&
      !belegteFelder.has(f.key) && !reservierteZiele.has(f.key) && !reservierteSpender.has(f.key) &&
      f.anzahl + (delta[f.key] || 0) > 0)) : null;
    const echterSpender = festBelegt || bestesFeld(felder.filter((f) =>
      f.tag === zielFeld.tag && f.konto === spender && f.key !== zielFeld.key &&
      f.anzahl + (delta[f.key] || 0) > 0));
    const freierSpender = festLeer || bestesFeld(pumpMoeglichkeiten(payload, woche, spender).filter((f) =>
      f.tag === zielFeld.tag && f.key !== zielFeld.key && !belegteFelder.has(f.key) &&
      !reservierteZiele.has(f.key) && !reservierteSpender.has(f.key) &&
      f.anzahl + (delta[f.key] || 0) > 0));
    const spenderFeld = echterSpender || freierSpender;
    if (!spenderFeld) {
      ergebnisse[ziel] = { status: 'spender-fehlt', modus: 'tausch', zielFeld, spender };
      return;
    }
    reservierteSpender.add(spenderFeld.key);

    delta[zielFeld.key] = (delta[zielFeld.key] || 0) + 1;
    delta[spenderFeld.key] = (delta[spenderFeld.key] || 0) - 1;
    ergebnisse[ziel] = {
      status: 'aktiv', modus: 'tausch', zielFeld, spenderFeld, spender,
      spenderName: cfg.spenderName || spender,
      vorgemerkt: vorgemerkt || !felder.includes(spenderFeld),
    };
  });

  return { delta, ergebnisse };
}

// Vorschlaege sind keine automatische Entscheidung. Viel bereits geplante
// direkte+indirekte Arbeit steht oben; danach direkte Arbeit und Feldgroesse.
// Die UI zeigt die Gruende, der Nutzer bestaetigt den Spender selbst.
export function spenderKandidaten(payload, woche, ziel, wochenwerte = {}, katalog = KATALOG) {
  const felder = pumpFelder(payload, woche, katalog);
  // Eine Prioritaet darf vor der Uebungswahl entstehen. Ist noch kein echtes
  // Zielfeld befuellt, reicht der vorgesehene Pumpplatz, um dieselbe Einheit
  // fuer die Spendervorschlaege zu bestimmen.
  const zielFeld = bestesFeld(felder.filter((f) => f.konto === ziel)) ||
    bestesFeld(pumpMoeglichkeiten(payload, woche, ziel));
  if (!zielFeld) return [];

  const prios = prioritaetenVon(payload);
  // Beim Aendern einer vorhandenen Umverteilung ihren bisherigen Abzug zuerst
  // herausnehmen, sonst saehe derselbe Spender kuenstlich knapper aus.
  const ohneZiel = Object.assign({}, prios);
  delete ohneZiel[ziel];
  const probePayload = Object.assign({}, payload, {
    volumen: Object.assign({}, volumenVon(payload), { prioritaet: ohneZiel }),
  });
  const bestehend = prioritaetsAnpassungen(probePayload, woche, katalog).delta;

  const konten = wochenwerte.konten || {};
  const direkt = wochenwerte.direkt || {};
  const indirekt = wochenwerte.indirekt || {};
  const proFeld = new Map();
  KONTEN.forEach((konto) => {
    if (konto === ziel || gueltigePrio(prios[konto])) return;
    const echt = bestesFeld(felder.filter((f) => f.tag === zielFeld.tag && f.konto === konto && f.key !== zielFeld.key));
    const frei = bestesFeld(pumpMoeglichkeiten(payload, woche, konto).filter((f) =>
      f.tag === zielFeld.tag && f.key !== zielFeld.key && !felder.some((belegt) => belegt.key === f.key)));
    const f = echt || frei;
    if (!f) return;
    const verfuegbar = f.anzahl + (bestehend[f.key] || 0);
    if (verfuegbar <= 0) return;
    const kandidat = {
      ...f, konto, name: f.name || 'Pumpfeld noch leer', verfuegbar,
      wert: konten[konto] || 0, direkt: direkt[konto] || 0, indirekt: indirekt[konto] || 0,
    };
    const alt = proFeld.get(f.key);
    if (!alt || kandidat.wert > alt.wert ||
      (kandidat.wert === alt.wert && kandidat.direkt > alt.direkt)) proFeld.set(f.key, kandidat);
  });

  const blockName = (f) => {
    if (f.name !== 'Pumpfeld noch leer') return f.konto;
    const erlaubt = f.erlaubt || [];
    if (erlaubt.length === 2 && erlaubt.includes('Lat') && erlaubt.includes('Oberer Rücken')) return 'Rücken';
    if (erlaubt.length === 1) return erlaubt[0];
    return f.mus;
  };
  const liste = [...proFeld.values()].map((f) => ({
    konto: f.konto, tag: f.tag, mus: f.mus, name: f.name,
    key: f.key, label: blockName(f), verfuegbar: f.verfuegbar,
    wert: f.wert, direkt: f.direkt, indirekt: f.indirekt,
  }));
  const sortierteListe = liste.sort((a, b) =>
    b.wert - a.wert || b.direkt - a.direkt || b.verfuegbar - a.verfuegbar ||
    KONTEN.indexOf(a.konto) - KONTEN.indexOf(b.konto));
  const max = Math.max(0, ...sortierteListe.map((e) => e.wert));
  sortierteListe.forEach((e, index) => {
    e.viel = max > 0 && e.wert >= max * 0.75;
    e.gruende = [
      'Pump · gleiche Einheit',
      ...(index === 0 && max > 0 ? ['höchste Wochenarbeit'] : e.viel ? ['viel Wochenarbeit'] : []),
      ...(e.name === 'Pumpfeld noch leer' ? ['Block noch frei'] : []),
    ];
  });
  return sortierteListe;
}

export { slotKey };
