import { TPL } from './template.js';

// Uebungs-Pool und Gedaechtnis fuer die frei rotierenden Uebungen (Pump & Cluster).
//
// Eigenes Modul, weil hier ein Fehler stumm bleibt: Es erscheint dann einfach
// kein Vorschlag oder ein falsches "zuletzt", ohne dass irgendwo etwas bricht.
// Genau das ist in dieser App schon einmal passiert. Ohne Zustand, damit
// pruefbar – data und mem kommen als Argumente herein.

export const memKey = (name, kind) => {
  const k = (name || '').trim().toLowerCase();
  return k ? kind + '|' + k : null;
};
export const numOf = (v) => parseFloat(String(v).replace(',', '.'));

export function harvestMem(data) {
  const out = {};
  Object.keys(data || {}).forEach((day) => {
    const tplDay = TPL[day]; if (!tplDay) return;
    Object.keys(data[day] || {}).forEach((wkStr) => {
      const wk = Number(wkStr);
      const cell = data[day][wkStr] || {};
      Object.keys(cell).forEach((bid) => {
        const blk = tplDay.blocks.find((b) => b.id === bid);
        if (!blk || (blk.type !== 'pump' && blk.type !== 'mr')) return;
        const e = cell[bid]; if (!e) return;
        const nms = e.names || (e.name != null ? [e.name] : []);
        nms.forEach((nm, xi) => {
          const key = memKey(nm, blk.type); if (!key) return;
          ((e.sets && e.sets[xi]) || []).forEach((s) => {
            const w = numOf(s && s.w); if (!w) return;
            const old = out[key];
            const ow = old ? numOf(old.w) : -1;
            // n = Originalschreibweise (der Schluessel ist kleingeschrieben,
            // damit der Abgleich tolerant bleibt – im Vorschlag will man aber
            // "Latzug Maschine" lesen).
            // b = Block, in dem sie zuletzt lief. Nur fuer die Vorschlaege:
            // Bei "Ruecken Dicke" sollen keine Wadenuebungen stehen. Das
            // Gedaechtnis selbst bleibt blockunabhaengig – ein Gewicht ist
            // ein Gewicht, egal wo die Uebung eingetragen wurde.
            if (!old || wk > old.week || (wk === old.week && w > ow)) out[key] = { w: s.w, r: s.r, week: wk, n: String(nm).trim(), b: bid };
          });
        });
      });
    });
  });
  return out;
}

// Zuletzt benutzte Uebungen fuer GENAU DIESEN Block, neueste zuerst.
// Bewusst streng: Bei "Ruecken Dicke" gehoeren nur Ruecken-Dicke-Uebungen hin.
// Das haelt die Liste von selbst kurz – niemand hat 30 davon – und macht sie
// als Anregung erst brauchbar.
//
// Ueber Rotationen und Deload-Slots hinweg sammelt sich die Historie
// automatisch, weil die Block-IDs geteilt sind: m_bkth ist in MRs, MRs-2 und
// MRs-3 derselbe Block, p_quad in OK-A und OK-B.
export function recentNames(kind, blockId, data, mem) {
  const seen = new Map();
  const add = (nm, wk) => {
    const t = String(nm || '').trim(); if (!t) return;
    const k = t.toLowerCase();
    const cur = seen.get(k);
    if (!cur || wk > cur.week) seen.set(k, { n: t, week: wk });
  };
  Object.keys(data).forEach((day) => {
    const tplDay = TPL[day]; if (!tplDay) return;
    const blk = tplDay.blocks.find((b) => b.id === blockId);
    if (!blk || blk.type !== kind) return;
    Object.keys(data[day] || {}).forEach((wkStr) => {
      const entry = (data[day][wkStr] || {})[blockId];
      if (entry) (entry.names || []).forEach((nm) => add(nm, Number(wkStr)));
    });
  });
  // Pool aus frueheren Phasen ans Ende – Wochennummern starten je Phase neu.
  // Alt-Eintraege ohne b kennen ihren Block nicht und bleiben aussen vor;
  // fuer die Gewichts-Anzeige zaehlen sie weiterhin.
  Object.keys(mem).forEach((key) => {
    const i = key.indexOf('|');
    if (i < 0 || key.slice(0, i) !== kind) return;
    const e = mem[key];
    if (!e || e.b !== blockId) return;
    const k = key.slice(i + 1);
    if (!seen.has(k)) seen.set(k, { n: e.n || k, week: -1 });
  });
  return [...seen.values()].sort((a, b) => b.week - a.week || a.n.localeCompare(b.n, 'de'));
}
