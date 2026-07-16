// Lokaler Spiegel (Stufe 1 "offline").
//
// Grundgedanke wie bei Apple Notes: Was du eintippst, liegt sofort auf dem Geraet.
// Der Server ist die Sicherungskopie, nicht die Voraussetzung. Faellt das Netz aus,
// wird lokal weitergearbeitet und der Upload nachgeholt.
//
// localStorage ist bewusst gewaehlt (nicht IndexedDB): Das Payload ist wenige KB,
// und synchrones Schreiben heisst, dass nichts verloren geht, wenn iOS die App
// mitten in der Einheit aus dem Speicher wirft.

const LOG_KEY = (uid) => 'blast:log:' + uid;
const PROFILE_KEY = (uid) => 'blast:profile:' + uid;

// Jeder Zugriff gekapselt: Im privaten Modus oder bei vollem Speicher wirft
// localStorage. Das darf die App nie zum Absturz bringen – im schlimmsten Fall
// verhaelt sie sich wie vorher (nur Server).
function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) {
    return false;
  }
}

export const readLog = (uid) => safeGet(LOG_KEY(uid));
// dirty   = es gibt Aenderungen, die der Server noch nicht hat.
// replace = dieser Stand ersetzt den Server vollstaendig, statt mit ihm
//           zusammengefuehrt zu werden. Noetig nach "Neue Phase starten":
//           Leeren ist eine Absicht, keine fehlende Information – sonst
//           wuerde der Abgleich die geloeschten Wochen wieder herholen.
export const writeLog = (uid, payload, dirty, replace = false) =>
  safeSet(LOG_KEY(uid), { payload, dirty, replace, at: Date.now() });

export const readProfile = (uid) => safeGet(PROFILE_KEY(uid));
export const writeProfile = (uid, profile) => safeSet(PROFILE_KEY(uid), profile);

// ---- Zusammenfuehren -------------------------------------------------------
// Nur noetig, wenn lokal ungespeicherte Aenderungen liegen UND der Server
// zwischenzeitlich etwas anderes hat (z.B. am Rechner eingetragen).
//
// Zusammengefuehrt wird pro Block (Tag -> Woche -> Block), nicht als Ganzes.
// Das ist die Ebene, auf der CloudKit einzelne Notizen abgleicht.

// Achtung, entscheidendes Detail: Die App legt beim blossen Ansehen eines Tages
// leere Bloecke an (sets voller Leerstrings). Wuerde "lokal gewinnt" blind gelten,
// wuerde so ein leeres Geruest echte Server-Daten ueberschreiben. Darum gewinnt
// lokal nur, wenn dort tatsaechlich etwas steht.
const blockHasData = (b) =>
  ((b && b.sets) || []).some((arr) => (arr || []).some((s) => s && (s.w || s.r))) ||
  ((b && b.names) || []).some((n) => n && String(n).trim());

const pickBlock = (srv, loc) => (blockHasData(loc) ? loc : (srv || loc));

// Flache Namens-/Notiz-Speicher: Tag -> BlockId -> Array. Gleiche Logik.
const listHasData = (a) => (a || []).some((n) => n && String(n).trim());
const pickList = (srv, loc) => (listHasData(loc) ? loc : (srv || loc));

function mergeData(srv, loc) {
  const out = {};
  const days = new Set([...Object.keys(srv || {}), ...Object.keys(loc || {})]);
  days.forEach((day) => {
    const sD = (srv || {})[day] || {}, lD = (loc || {})[day] || {};
    out[day] = {};
    const weeks = new Set([...Object.keys(sD), ...Object.keys(lD)]);
    weeks.forEach((wk) => {
      const sW = sD[wk] || {}, lW = lD[wk] || {};
      out[day][wk] = {};
      const blocks = new Set([...Object.keys(sW), ...Object.keys(lW)]);
      blocks.forEach((bid) => { out[day][wk][bid] = pickBlock(sW[bid], lW[bid]); });
    });
  });
  return out;
}

function mergeNested(srv, loc, pick) {
  const out = {};
  const days = new Set([...Object.keys(srv || {}), ...Object.keys(loc || {})]);
  days.forEach((day) => {
    const sD = (srv || {})[day] || {}, lD = (loc || {})[day] || {};
    out[day] = {};
    const ids = new Set([...Object.keys(sD), ...Object.keys(lD)]);
    ids.forEach((id) => { out[day][id] = pick(sD[id], lD[id]); });
  });
  return out;
}

export function mergePayload(srv, loc) {
  srv = srv || {}; loc = loc || {};
  return {
    // Ansichtszustand: das Geraet, an dem zuletzt gearbeitet wurde, gewinnt.
    week: loc.week || srv.week || 1,
    day: loc.day || srv.day || 'OK-A',
    data: mergeData(srv.data, loc.data),
    ex: mergeNested(srv.ex, loc.ex, pickList),
    notes: mergeNested(srv.notes, loc.notes, pickList),
    // Tier/Rotation sind bewusste Entscheidungen -> lokal gewinnt pro Schluessel.
    tier: Object.assign({}, srv.tier, loc.tier),
    rot: Object.assign({}, srv.rot, loc.rot),
    // Uebungs-Pool: Vereinigung, nichts wird verworfen.
    mem: Object.assign({}, srv.mem, loc.mem),
    v: 3,
  };
}
