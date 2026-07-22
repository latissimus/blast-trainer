import { TPL } from './template.js';
import { KATALOG, KONTEN } from './katalog.js';
import { targetSets, exOf } from './saetze.js';

// Muskel-Priorisierung ist eine PLANUNGSREGEL ueber dem Tages-Level:
// Level I bleibt ein reduzierter Tag, ab Level II bekommt genau ein geeignetes
// Pumpfeld pro Zielmuskel einen Satz mehr. Bei einer Umverteilung wird der Satz
// nur dann vergeben, wenn in derselben Einheit auch ein gewaehltes Pumpfeld den
// Satz abgeben kann. So wird aus einer fehlenden Spender-Uebung nie still ein
// Volumenaufschlag.

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
  return (t === 0 || t === 1 || t === 2) ? t : 2;
}

const volumenVon = (payload) => (payload && payload.volumen) || {};
export const prioritaetenVon = (payload) => volumenVon(payload).prioritaet || {};
export const erhaltVon = (payload) => volumenVon(payload).erhalt || {};

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
        const extra = ((eintragBlock.extra || [])[xi] || 0);
        felder.push({
          key: slotKey(tag, blk.id, xi), tag, blockId: blk.id, xi,
          mus: blk.mus, name, konto: eintrag.haupt, neben: eintrag.neben || [],
          tier, anzahl: targetSets(blk, tier) + extra,
          erlaubt: exDef.konten || blk.konten || [],
        });
      });
    });
  });
  return felder;
}

// Schon vor der Uebungswahl ist damit bekannt, an welchem Tag ein Muskel einen
// regulaeren Pumpplatz haben kann. Die UI nutzt das fuer die Level-I-Sperre.
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
        if (erlaubt.includes(konto)) treffer.push({ tag, blockId: blk.id, xi, mus: blk.mus, tier });
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

  KONTEN.forEach((ziel) => {
    const cfg = prioritaet[ziel];
    if (!gueltigePrio(cfg)) return;
    const zielFeld = bestesFeld(felder.filter((f) => f.konto === ziel));
    if (!zielFeld) {
      ergebnisse[ziel] = { status: 'ziel-fehlt', modus: cfg.modus };
      return;
    }
    if (zielFeld.tier < 1) {
      ergebnisse[ziel] = { status: 'level-i', modus: cfg.modus, zielFeld };
      return;
    }

    if (cfg.modus === 'plus') {
      delta[zielFeld.key] = (delta[zielFeld.key] || 0) + 1;
      ergebnisse[ziel] = { status: 'aktiv', modus: 'plus', zielFeld };
      return;
    }

    const spender = cfg.spender;
    // Ein priorisierter Muskel darf nicht gleichzeitig still als Spender
    // dienen. Die Konfiguration bleibt sichtbar, wirkt aber nicht halb.
    if (!spender || gueltigePrio(prioritaet[spender])) {
      ergebnisse[ziel] = { status: 'spender-fehlt', modus: 'tausch', zielFeld, spender };
      return;
    }
    const spenderFeld = bestesFeld(felder.filter((f) =>
      f.tag === zielFeld.tag && f.konto === spender && f.key !== zielFeld.key &&
      f.anzahl + (delta[f.key] || 0) > 0));
    if (!spenderFeld) {
      ergebnisse[ziel] = { status: 'spender-fehlt', modus: 'tausch', zielFeld, spender };
      return;
    }

    delta[zielFeld.key] = (delta[zielFeld.key] || 0) + 1;
    delta[spenderFeld.key] = (delta[spenderFeld.key] || 0) - 1;
    ergebnisse[ziel] = { status: 'aktiv', modus: 'tausch', zielFeld, spenderFeld, spender };
  });

  return { delta, ergebnisse };
}

// Vorschlaege sind keine automatische Entscheidung. Erst "Erhalt", dann viel
// bereits geplante direkte+indirekte Arbeit; bei Gleichstand das groessere
// Pumpfeld. Die UI zeigt die Gruende, der Nutzer bestaetigt den Spender selbst.
export function spenderKandidaten(payload, woche, ziel, wochenwerte = {}, katalog = KATALOG) {
  const felder = pumpFelder(payload, woche, katalog);
  const zielFeld = bestesFeld(felder.filter((f) => f.konto === ziel && f.tier >= 1));
  if (!zielFeld) return [];

  const prios = prioritaetenVon(payload);
  const erhalt = erhaltVon(payload);
  // Beim Aendern einer vorhandenen Umverteilung ihren bisherigen Abzug zuerst
  // herausnehmen, sonst saehe derselbe Spender kuenstlich knapper aus.
  const ohneZiel = Object.assign({}, prios);
  delete ohneZiel[ziel];
  const probePayload = Object.assign({}, payload, {
    volumen: Object.assign({}, volumenVon(payload), { prioritaet: ohneZiel }),
  });
  const bestehend = prioritaetsAnpassungen(probePayload, woche, katalog).delta;

  const proKonto = new Map();
  felder.forEach((f) => {
    if (f.tag !== zielFeld.tag || f.konto === ziel || gueltigePrio(prios[f.konto])) return;
    const verfuegbar = f.anzahl + (bestehend[f.key] || 0);
    if (verfuegbar <= 0) return;
    const alt = proKonto.get(f.konto);
    if (!alt || verfuegbar > alt.verfuegbar) proKonto.set(f.konto, { ...f, verfuegbar });
  });

  const konten = wochenwerte.konten || {};
  const direkt = wochenwerte.direkt || {};
  const indirekt = wochenwerte.indirekt || {};
  const liste = [...proKonto.values()].map((f) => ({
    konto: f.konto, tag: f.tag, mus: f.mus, name: f.name,
    verfuegbar: f.verfuegbar,
    wert: konten[f.konto] || 0,
    direkt: direkt[f.konto] || 0,
    indirekt: indirekt[f.konto] || 0,
    erhalt: !!erhalt[f.konto],
  }));
  const max = Math.max(0, ...liste.map((e) => e.wert));
  liste.forEach((e) => {
    e.viel = max > 0 && e.wert >= max * 0.75;
    e.gruende = [
      'Pump · gleiche Einheit',
      ...(e.erhalt ? ['Erhalt'] : []),
      ...(e.viel ? ['viel Wochenvolumen'] : []),
    ];
  });
  return liste.sort((a, b) =>
    Number(b.erhalt) - Number(a.erhalt) || b.wert - a.wert ||
    b.verfuegbar - a.verfuegbar || KONTEN.indexOf(a.konto) - KONTEN.indexOf(b.konto));
}

export { slotKey };
