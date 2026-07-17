import { supabase } from './supabase.js';
import { readLog, writeLog, mergePayload } from './localstore.js';
import { TPL, LEGACY, TIER_NAMES } from './template.js';

// Pause zwischen zwei Clustern (s). Kein fester Vorgabewert
// ("so viel wie nötig", Richtwert ein Cluster alle ~10 min) – hier bewusst gesetzt.
const MR_REST = 120;

// Anzeige-Labels der Set-Typen. Die internen Keys (load/pump/mr) bleiben, damit
// gespeicherte Logs gueltig bleiben – nur die Beschriftung wechselt.
const TYPE_LABEL = { load: 'HEAVY', pump: 'PUMP', mr: 'CLUSTER' };

/* ------------------------------------------------------------------
   Mount the BLAST log (v2: Level, A/B-Wochen, Rollen, Pausen-Timer)
   into `container`.
     userId    – whose training_logs row to load
     readOnly  – true for the admin viewing a customer (no editing/saving)
   Returns { destroy } to remove the sticky save bar / sheet on nav.
   ------------------------------------------------------------------ */
export async function mountLog(container, { userId, readOnly = false }) {
  // Local-first laden: Der Server ist die Sicherungskopie, nicht die Voraussetzung.
  // Nur wenn lokal ungespeicherte Aenderungen liegen, wird zusammengefuehrt –
  // sonst gewinnt der Server (sein Stand ist dann identisch mit dem lokalen).
  const local = readLog(userId);
  let server = null, serverOk = false;
  // Sagt das Geraet selbst, dass es offline ist, den Serverversuch ueberspringen.
  // Er laeuft sonst nur in einen Timeout, und solange starrt man auf den
  // Ladebildschirm – auf ein Scheitern, das schon feststeht. navigator.onLine
  // ist umgekehrt unzuverlaessig (WLAN ohne Internet meldet "online"), aber ein
  // klares "offline" stimmt: Dann gibt es keine Verbindung.
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from('training_logs')
        .select('payload')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      server = data?.payload || {};
      serverOk = true;
    } catch (e) {
      // Kein Netz und nichts lokal -> wie bisher scheitern. Sonst: offline weiter.
      if (!local) throw e;
    }
  } else if (!local) {
    throw new Error('Keine Verbindung – und auf diesem Gerät liegt noch kein Log. Bitte einmal mit Internet öffnen.');
  }

  let p, mergedOffline = false;
  if (serverOk && local && local.dirty) {
    // Nach einem Phasen-Reset ersetzt der lokale Stand den Server, statt sich mit
    // ihm zu vereinigen – sonst kaemen die bewusst geloeschten Wochen zurueck.
    p = local.replace ? local.payload : mergePayload(server, local.payload);
    mergedOffline = true;
  } else if (serverOk) p = server;
  else { p = local.payload; mergedOffline = true; }
  const state = {
    week: p.week || 1,
    day: TPL[p.day] ? p.day : 'OK-A',
    data: p.data || {},
    tier: p.tier || {},
    rot: p.rot || {},
    ex: p.ex || {},      // gemeinsame Übungsnamen pro Tag (über alle Wochen der Rotation)
    notes: p.notes || {}, // gemeinsame Notizen pro Tag/Übung
    mem: p.mem || {},    // Übungs-Pool: Name -> zuletzt geschaffte Last, ueberlebt den Phasen-Reset
  };
  migrateData();

  let saveTimer = null;
  let saveStateEl = null;
  let saveBar = null;
  let sheet = null;
  let timerId = null;

  // ---- persistence -------------------------------------------------
  // Dezenter Sync-Status als Icon: ✓ gespeichert · ↻ speichert · ⚠ Fehler
  const STATUS = {
    saved:   ['✓', 'ok',     'gespeichert'],
    saving:  ['↻', 'saving', 'speichert…'],
    pending: ['↻', 'saving', 'ungespeicherte Änderungen'],
    // Nicht hochgeladen heisst nicht mehr "verloren": lokal liegt es sicher.
    offline: ['↑', 'wait',   'auf diesem Gerät gesichert · wartet auf Verbindung'],
    error:   ['⚠', 'err',    'auf diesem Gerät gesichert · Upload fehlgeschlagen'],
  };
  function setStatus(kind) {
    if (!saveStateEl) return;
    const [icon, cls, title] = STATUS[kind] || STATUS.saved;
    saveStateEl.textContent = icon;
    saveStateEl.className = 'save-dot ' + cls;
    saveStateEl.title = title;
  }
  function payloadOut() {
    return { data: state.data, week: state.week, day: state.day, tier: state.tier, rot: state.rot, ex: state.ex, notes: state.notes, mem: state.mem, v: 3 };
  }
  // Lokal vormerken, ohne ein gesetztes replace-Kennzeichen zu verlieren:
  // Es darf erst fallen, wenn der Server den Stand wirklich hat.
  function markLocal(payload, dirty) {
    const cur = readLog(userId);
    writeLog(userId, payload, dirty, !!(cur && cur.replace));
  }

  async function persist() {
    if (readOnly) return true;
    const payload = payloadOut();
    markLocal(payload, true);                 // lokal zuerst – ueberlebt App-Kill
    setStatus('saving');
    const { error: e } = await supabase.from('training_logs').upsert(
      { user_id: userId, payload, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (e) {
      // Daten sind lokal sicher; nur der Upload fehlt. Wird automatisch nachgeholt.
      setStatus(navigator.onLine ? 'error' : 'offline');
      return false;
    }
    writeLog(userId, payload, false, false);  // sauber: Server hat denselben Stand
    setStatus('saved');
    return true;
  }
  function queuePersist() {
    if (readOnly) return;
    // Synchron und sofort, nicht erst nach der Debounce: Wenn iOS die App
    // dazwischen abraeumt, ist der Satz trotzdem da.
    markLocal(payloadOut(), true);
    setStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 700);
  }

  // Upload nachholen. 'online' feuert auf iOS nicht zuverlaessig, deshalb
  // zusaetzlich ein ruhiger Takt, der nur bei offenen Aenderungen etwas tut.
  function retrySync() {
    if (readOnly) return;
    const l = readLog(userId);
    if (l && l.dirty) persist();
  }
  let retryId = null;
  if (!readOnly) {
    window.addEventListener('online', retrySync);
    retryId = setInterval(retrySync, 20000);
  }

  // ---- migration: v1 index->id + Übungsnamen in gemeinsamen Tag-Speicher heben ----
  function migrateData() {
    const d = state.data;
    Object.keys(d).forEach((day) => {
      const map = LEGACY[day];
      Object.keys(d[day] || {}).sort((a, b) => Number(a) - Number(b)).forEach((wk) => {
        const cell = d[day][wk]; if (!cell) return;
        if (map) {
          Object.keys(cell).forEach((k) => {
            if (/^\d+$/.test(k)) {
              const id = map[Number(k)];
              if (id && !cell[id]) cell[id] = cell[k];
              delete cell[k];
            }
          });
        }
        // Übungsnamen aus der Zelle ziehen -> state.ex[day][blockId] (spätere Wochen mit Namen gewinnen)
        Object.keys(cell).forEach((bid) => {
          const entry = cell[bid];
          if (entry && entry.ex) {
            const hasName = entry.ex.some((n) => n && n.trim());
            state.ex[day] = state.ex[day] || {};
            if (!state.ex[day][bid] || hasName) state.ex[day][bid] = entry.ex.slice();
            delete entry.ex;
          }
        });
      });
    });
  }

  // Gemeinsame Übungsnamen für einen Tag/Block (über alle Wochen geteilt).
  // Start LEER — jeder Trainee trägt seine Übungen selbst ein.
  function dayNames(day, blk) {
    state.ex[day] = state.ex[day] || {};
    if (!state.ex[day][blk.id]) state.ex[day][blk.id] = blk.ex.map(() => '');
    return state.ex[day][blk.id];
  }

  // Gemeinsame Notizen pro Tag/Block/Übung (über alle Wochen geteilt)
  function dayNotes(day, blk) {
    state.notes[day] = state.notes[day] || {};
    if (!state.notes[day][blk.id]) state.notes[day][blk.id] = blk.ex.map(() => '');
    return state.notes[day][blk.id];
  }

  // ---- structure helpers -------------------------------------------
  const rotOf = (week) => state.rot[week] || (week % 2 === 1 ? 'A' : 'B');
  const isCruise = (week) => week >= 7;   // Wochen 7-8 = Deload: nur Clusters, Level I
  // Deload: 2-3 Einheiten pro Woche, alle nur Clusters -> drei
  // eigene Slots, damit jede Einheit getrennt geloggt wird. Der dritte ist optional.
  const daysOfWeek = (week) => {
    if (isCruise(week)) return ['MRs', 'MRs-2', 'MRs-3'];
    const r = rotOf(week); return ['OK-' + r, 'UK-' + r, 'MRs'];
  };
  const tierOf = (day, week) => {
    if (isCruise(week)) return 0;   // Deload fest auf Level I
    const t = state.tier[day + '|' + week]; return (t === 0 || t === 1 || t === 2) ? t : 2;
  };
  const setTier = (day, week, t) => { state.tier[day + '|' + week] = t; };
  function targetSets(blk, tier) {
    return blk.sets[tier];   // sets = [Level I, II, III], feste Werte
  }
  // Effektiver Set-Typ je Level (Cluster-Tag: Tris/Bis & Abs sind bei niedrigen Leveln Pump)
  function effTypeOf(blk, tier) {
    return (blk.typeByTier && blk.typeByTier[tier]) || blk.type;
  }
  // Übungsfelder je Tier (Quads+Hams-Pump hat bei Tier I nur ein Feld, sonst zwei)
  function exOf(blk, tier) {
    return (blk.exByTier && blk.exByTier[tier]) || blk.ex;
  }
  // Wechsel-Verteilung (nur Heavy-Blöcke): die N Gesamtsätze des Muskels auf Comp/Iso aufteilen.
  // 1. Übung (Comp) aufgerundet N/2, 2. Übung (Iso) abgerundet N/2. Eine Übung = alle N.
  function setsForExercise(blk, tier, xi) {
    const N = targetSets(blk, tier);
    const E = exOf(blk, tier).length || 1;
    return Math.floor(N / E) + (xi < (N % E) ? 1 : 0);
  }
  function ensureCell() {
    state.data[state.day] = state.data[state.day] || {};
    state.data[state.day][state.week] = state.data[state.day][state.week] || {};
    return state.data[state.day][state.week];
  }
  function cellHasData(cell) {
    if (!cell) return false;
    return Object.values(cell).some((b) => ((b && b.sets) || []).some((arr) => (arr || []).some((s) => s && (s.w || s.r))));
  }
  const dayHasData = (day, week) => cellHasData((state.data[day] || {})[week]);
  // Fortschritt einer Einheit fuer den Punkt auf dem Tab. Zaehlt wie die Volumen-Leiste,
  // damit Punkt und "X / Y ARBEITSSÄTZE" nie widersprechen.
  function dayProgress(day, week) {
    const tpl = TPL[day];
    const cell = (state.data[day] || {})[week];
    if (!tpl || !cell) return { any: false, met: false };
    const tier = tierOf(day, week);
    let done = 0, tgtTotal = 0;
    tpl.blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier); if (tgt === 0) return;
      tgtTotal += tgt;
      const entry = cell[blk.id]; if (!entry) return;
      (entry.sets || []).forEach((arr, xi) => {
        const cnt = setsForExercise(blk, tier, xi);
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) done++; });
      });
    });
    return { any: done > 0, met: tgtTotal > 0 && done >= tgtTotal };
  }
  function prevFilled(day, week) {
    const d = state.data[day] || {};
    const ws = Object.keys(d).map(Number).filter((w) => w < week && cellHasData(d[w])).sort((a, b) => b - a);
    return ws.length ? { week: ws[0], data: d[ws[0]] } : null;
  }
  const e1rm = (w, r) => { w = parseFloat(String(w).replace(',', '.')); r = parseFloat(r); if (!w || !r) return 0; return w * (1 + r / 30); };
  const bestE1 = (arr) => { let m = 0; (arr || []).forEach((s) => { if (s) { const e = e1rm(s.w, s.r); if (e > m) m = e; } }); return m; };
  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

  // ---- DOM scaffold ------------------------------------------------
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="blastbar">
      <div class="wk">
        <button id="lg-wkdn" aria-label="Woche zurück">←</button>
        <span class="num" id="lg-wknum">Wo 1</span>
        <button id="lg-wkup" aria-label="Woche vor">→</button>
      </div>
      <span class="rotchip" id="lg-rot">A-Woche</span>
      <button class="ibtn" id="lg-info" aria-label="FAQ">?</button>
      ${readOnly ? '' : '<span class="save-dot ok" id="lg-save" title="gespeichert">✓</span>'}
      <span class="cruise" id="lg-cruise" hidden>Deload</span>
    </div>
    <div class="tabs" id="lg-tabs"></div>
    <div class="tierbar">
      <span class="lbl">Level</span>
      <div class="seg" id="lg-tier">
        <button data-t="0">I</button><button data-t="1">II</button><button data-t="2">III</button>
      </div>
      <span class="tierhint" id="lg-tierhint"></span>
    </div>
    <div class="daymeta" id="lg-daymeta"></div>
    <div id="lg-content"></div>
    <div class="volbar" id="lg-vol"></div>
    <div id="lg-phasereset"></div>
    <div id="lg-pool" hidden></div>`;
  container.appendChild(wrap);

  saveStateEl = wrap.querySelector('#lg-save');
  const tabsEl = wrap.querySelector('#lg-tabs');
  const contentEl = wrap.querySelector('#lg-content');
  const volEl = wrap.querySelector('#lg-vol');
  const dayMetaEl = wrap.querySelector('#lg-daymeta');
  const wkNumEl = wrap.querySelector('#lg-wknum');
  const wkDownEl = wrap.querySelector('#lg-wkdn');
  const wkUpEl = wrap.querySelector('#lg-wkup');
  const rotEl = wrap.querySelector('#lg-rot');
  const cruiseEl = wrap.querySelector('#lg-cruise');
  const tierSeg = wrap.querySelector('#lg-tier');
  const tierHintEl = wrap.querySelector('#lg-tierhint');
  const phaseResetEl = wrap.querySelector('#lg-phasereset');

  wrap.querySelector('#lg-wkup').onclick = () => { if (state.week < 8) { state.week++; queuePersist(); renderAll(); } }; // SMASH 1-6 + Deload 7-8
  wrap.querySelector('#lg-wkdn').onclick = () => { if (state.week > 1) { state.week--; queuePersist(); renderAll(); } };
  // Das A/B-Feld ist nur Anzeige (folgt der Woche), nicht klickbar.
  tierSeg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { setTier(state.day, state.week, Number(b.dataset.t)); queuePersist(); renderAll(); };
  });
  wrap.querySelector('#lg-info').onclick = openSheet;

  // ---- render ------------------------------------------------------
  function renderHeader() {
    wkNumEl.textContent = 'Wo ' + state.week;
    // Pfeile an den Enden ausblenden. visibility statt hidden, damit "Wo 1"
    // nicht bei jedem Wochenwechsel seitlich springt.
    wkDownEl.style.visibility = state.week > 1 ? 'visible' : 'hidden';
    wkUpEl.style.visibility = state.week < 8 ? 'visible' : 'hidden';
    rotEl.textContent = rotOf(state.week) + '-Woche';
    // Deload-Chip nur in den Deload-Wochen (7-8)
    if (state.week >= 7) { cruiseEl.hidden = false; cruiseEl.textContent = 'Deload'; }
    else { cruiseEl.hidden = true; }

    tabsEl.innerHTML = '';
    const days = daysOfWeek(state.week);
    if (!days.includes(state.day)) state.day = days[0];
    const cruiseWk = isCruise(state.week);
    days.forEach((d, i) => {
      const tpl = TPL[d];
      const b = document.createElement('button');
      b.className = 'tab' + (d === state.day ? ' active' : '');
      // Tag-Nummer aus der Position: SMASH = Tag 1-3, Deload = drei Cluster-Einheiten,
      // die dritte optional (2-3x pro Woche).
      const opt = cruiseWk && i === 2 ? ' <span class="opt">(opt.)</span>' : '';
      b.innerHTML = `<span>Tag ${i + 1}${opt}</span><span class="t2">${tpl.short}</span>`;
      const pr = dayProgress(d, state.week);
      if (pr.any) {
        const dot = document.createElement('span');
        dot.className = 'dot' + (pr.met ? ' met' : '');
        dot.title = pr.met ? 'Soll-Sätze erreicht' : 'angefangen';
        b.appendChild(dot);
      }
      b.onclick = () => { state.day = d; queuePersist(); renderAll(); window.scrollTo({ top: 0, behavior: 'instant' }); };
      tabsEl.appendChild(b);
    });

    const cruise = isCruise(state.week);
    rotEl.style.display = cruise ? 'none' : '';   // A/B-Feld im Deload ausblenden
    const tier = tierOf(state.day, state.week);
    tierSeg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.t) === tier);
      b.disabled = cruise;                        // Level im Deload gesperrt (I)
    });
    tierHintEl.textContent = cruise ? 'nur Clusters · Level I fest'
      : tier === 0 ? 'wenig Volumen · schlechter Tag'
      : tier === 1 ? 'mittleres Volumen'
      : 'volles Volumen · guter Tag';
  }

  function renderPrev(node, prevSets, todaySets, pWeek) {
    if (!prevSets || !prevSets.some((s) => s && (s.w || s.r))) { node.innerHTML = '<b>letztes Mal: —</b>'; return; }
    const txt = prevSets.filter((s) => s && (s.w || s.r)).map((s) => `${s.w || '–'}×${s.r || '–'}`).join(', ');
    let chip = '';
    const pe = bestE1(prevSets), te = bestE1(todaySets);
    if (te > 0 && pe > 0) {
      const diff = te - pe;
      if (diff > 0.4) chip = `<span class="delta d-up">▲ gesteigert</span>`;
      else if (diff < -0.4) chip = `<span class="delta d-down">▼ gesunken</span>`;
      else chip = `<span class="delta d-hold">= gehalten</span>`;
    }
    node.innerHTML = `<b>Wo ${pWeek}: ${txt}</b>${chip}`;
  }

  function setRow(entry, xi, si, blk, prevLine, prevSets, prev, count) {
    const s = entry.sets[xi][si];
    const row = document.createElement('div'); row.className = 'setrow';
    const idx = document.createElement('span'); idx.className = 'sidx'; idx.textContent = si + 1; row.appendChild(idx);

    const wF = document.createElement('div'); wF.className = 'fld';
    const wIn = document.createElement('input'); wIn.type = 'text'; wIn.inputMode = 'decimal'; wIn.value = s.w || ''; wIn.placeholder = '–';
    wIn.disabled = readOnly; wF.appendChild(wIn);
    const wU = document.createElement('span'); wU.className = 'u'; wU.textContent = 'kg'; wF.appendChild(wU);
    row.appendChild(wF);

    const times = document.createElement('span'); times.className = 'times'; times.textContent = '×'; row.appendChild(times);

    const rF = document.createElement('div'); rF.className = 'fld';
    const rIn = document.createElement('input'); rIn.type = 'text'; rIn.inputMode = 'numeric'; rIn.value = s.r || '';
    rIn.placeholder = blk.type === 'mr' ? '4' : 'Wdh'; rIn.disabled = readOnly; rF.appendChild(rIn);
    row.appendChild(rF);

    if (blk.type === 'load') {
      const rirF = document.createElement('div'); rirF.className = 'fld rir';
      const rirIn = document.createElement('input'); rirIn.type = 'text'; rirIn.inputMode = 'numeric'; rirIn.value = s.rir || ''; rirIn.placeholder = 'RIR';
      rirIn.disabled = readOnly; rirF.appendChild(rirIn); row.appendChild(rirF);
      if (!readOnly) rirIn.oninput = () => { s.rir = rirIn.value; queuePersist(); };
    }

    if (!readOnly) {
      const upd = () => {
        s.w = wIn.value; s.r = rIn.value;
        renderPrev(prevLine, prevSets, entry.sets[xi].slice(0, count), prev ? prev.week : null);
        refreshVolume(); queuePersist();
      };
      wIn.oninput = upd; rIn.oninput = upd;
    }
    return row;
  }

  // ---- Gedächtnis für frei rotierende Übungen (Pump & Clusters) ----
  // Bei Pump/Cluster ist der Log kein Progressions-Werkzeug, sondern soll
  // zeigen, welche Last/Wdh man zuletzt bei dieser Übung genommen hat.
  // ---- Übungs-Pool (Pump/Cluster) ---------------------------------------
  // Pump- und Cluster-Übungen rotieren frei und haengen am Namen. Damit man in der
  // naechsten SMASH-Phase nachschauen kann, was man zuletzt geschafft hat, wird beim
  // Phasen-Reset aus den Wochendaten ein Pool geerntet, der bestehen bleibt.
  // Gelesen wird er nur als Rueckfalloption: solange die laufende Phase Daten
  // zur Übung hat, gewinnen die – das Verhalten innerhalb einer Phase bleibt
  // dadurch unveraendert.
  const memKey = (name, kind) => {
    const k = (name || '').trim().toLowerCase();
    return k ? kind + '|' + k : null;
  };
  const numOf = (v) => parseFloat(String(v).replace(',', '.'));

  function harvestMem(data) {
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
  function recentNames(kind, blockId) {
    const seen = new Map();
    const add = (nm, wk) => {
      const t = String(nm || '').trim(); if (!t) return;
      const k = t.toLowerCase();
      const cur = seen.get(k);
      if (!cur || wk > cur.week) seen.set(k, { n: t, week: wk });
    };
    Object.keys(state.data).forEach((day) => {
      const tplDay = TPL[day]; if (!tplDay) return;
      const blk = tplDay.blocks.find((b) => b.id === blockId);
      if (!blk || blk.type !== kind) return;
      Object.keys(state.data[day] || {}).forEach((wkStr) => {
        const entry = (state.data[day][wkStr] || {})[blockId];
        if (entry) (entry.names || []).forEach((nm) => add(nm, Number(wkStr)));
      });
    });
    // Pool aus frueheren Phasen ans Ende – Wochennummern starten je Phase neu.
    // Alt-Eintraege ohne b kennen ihren Block nicht und bleiben aussen vor;
    // fuer die Gewichts-Anzeige zaehlen sie weiterhin.
    Object.keys(state.mem).forEach((key) => {
      const i = key.indexOf('|');
      if (i < 0 || key.slice(0, i) !== kind) return;
      const e = state.mem[key];
      if (!e || e.b !== blockId) return;
      const k = key.slice(i + 1);
      if (!seen.has(k)) seen.set(k, { n: e.n || k, week: -1 });
    });
    return [...seen.values()].sort((a, b) => b.week - a.week || a.n.localeCompare(b.n, 'de'));
  }

  function lastLogFor(name, kind) {
    const k = (name || '').trim().toLowerCase(); if (!k) return null;
    let best = null;
    Object.keys(state.data).forEach((day) => {
      const tplDay = TPL[day]; if (!tplDay) return;
      Object.keys(state.data[day] || {}).forEach((wkStr) => {
        const wk = Number(wkStr);
        if (day === state.day && wk === state.week) return;   // aktuelle Einheit ausklammern
        const cell = state.data[day][wkStr] || {};
        Object.keys(cell).forEach((bid) => {
          const blk = tplDay.blocks.find((b) => b.id === bid);
          if (!blk || blk.type !== kind) return;
          const e = cell[bid]; if (!e) return;
          const nms = e.names || (e.name != null ? [e.name] : []);
          nms.forEach((nm, xi) => {
            if ((nm || '').trim().toLowerCase() !== k) return;
            ((e.sets && e.sets[xi]) || []).forEach((s) => {
              const w = parseFloat(String(s && s.w).replace(',', '.'));
              if (!w) return;
              const bw = best ? parseFloat(String(best.w).replace(',', '.')) : -1;
              if (!best || wk > best.week || (wk === best.week && w > bw)) best = { w: s.w, r: s.r, week: wk };
            });
          });
        });
      });
    });
    if (best) return best;
    // Nichts in der laufenden Phase -> Pool aus frueheren Phasen.
    const pooled = state.mem[memKey(name, kind)];
    return pooled ? { w: pooled.w, r: pooled.r, week: pooled.week, pool: true } : null;
  }
  function renderMem(node, name, kind) {
    const m = lastLogFor(name, kind);
    if (!m) { node.innerHTML = (name && name.trim()) ? '<b>zuletzt: — (neue Übung)</b>' : '<b>zuletzt: —</b>'; return; }
    const hasR = m.r != null && m.r !== '';
    const txt = kind === 'mr'
      ? `zuletzt: ${m.w} kg${hasR ? ` · ${m.r} Wdh. im letzten Cluster` : ''}`
      : `zuletzt: ${m.w} kg${hasR ? ` × ${m.r} Wdh` : ''}`;
    // Wochennummern starten pro Phase neu – Pool-Treffer stammen aus einer
    // frueheren Phase und werden deshalb nicht als "Wo N" ausgewiesen.
    node.innerHTML = `<b>${txt}</b><span class="delta d-hold">${m.pool ? 'Pool' : 'Wo ' + m.week}</span>`;
  }
  // Ein Cluster = 6×4 Minisätze. Kompakt: Gewicht + Wdh im letzten (6.) Satz.
  function mrRow(entry, xi, si, blk, memNode) {
    const s = entry.sets[xi][si];
    const row = document.createElement('div'); row.className = 'setrow mrrow';
    const idx = document.createElement('span'); idx.className = 'sidx'; idx.textContent = si + 1; row.appendChild(idx);

    const wF = document.createElement('div'); wF.className = 'fld';
    const wIn = document.createElement('input'); wIn.type = 'text'; wIn.inputMode = 'decimal'; wIn.value = s.w || ''; wIn.placeholder = '–';
    wIn.disabled = readOnly; wF.appendChild(wIn);
    const wU = document.createElement('span'); wU.className = 'u'; wU.textContent = 'kg'; wF.appendChild(wU);
    row.appendChild(wF);

    const clu = document.createElement('span'); clu.className = 'mrclu'; clu.textContent = '6×4'; row.appendChild(clu);

    const rF = document.createElement('div'); rF.className = 'fld mrlast';
    const rIn = document.createElement('input'); rIn.type = 'text'; rIn.inputMode = 'numeric'; rIn.value = s.r || ''; rIn.placeholder = '4';
    rIn.disabled = readOnly; rF.appendChild(rIn);
    const rU = document.createElement('span'); rU.className = 'u'; rU.textContent = '6.Satz'; rF.appendChild(rU);
    row.appendChild(rF);

    if (!readOnly) {
      const upd = () => { s.w = wIn.value; s.r = rIn.value; renderMem(memNode, entry.names[xi], 'mr'); refreshVolume(); queuePersist(); };
      wIn.oninput = upd; rIn.oninput = upd;
    }
    return row;
  }

  // Freier Satz (Pump-Block oder Pump-Ausnahme im Cluster-Block): kg × Wdh + Gedächtnis
  function pumpMrRow(entry, xi, si, memNode, kind) {
    const s = entry.sets[xi][si];
    const row = document.createElement('div'); row.className = 'setrow';
    const idx = document.createElement('span'); idx.className = 'sidx'; idx.textContent = si + 1; row.appendChild(idx);

    const wF = document.createElement('div'); wF.className = 'fld';
    const wIn = document.createElement('input'); wIn.type = 'text'; wIn.inputMode = 'decimal'; wIn.value = s.w || ''; wIn.placeholder = '–';
    wIn.disabled = readOnly; wF.appendChild(wIn);
    const wU = document.createElement('span'); wU.className = 'u'; wU.textContent = 'kg'; wF.appendChild(wU);
    row.appendChild(wF);

    const times = document.createElement('span'); times.className = 'times'; times.textContent = '×'; row.appendChild(times);

    const rF = document.createElement('div'); rF.className = 'fld';
    const rIn = document.createElement('input'); rIn.type = 'text'; rIn.inputMode = 'numeric'; rIn.value = s.r || ''; rIn.placeholder = 'Wdh';
    rIn.disabled = readOnly; rF.appendChild(rIn);
    row.appendChild(rF);

    if (!readOnly) {
      const upd = () => { s.w = wIn.value; s.r = rIn.value; renderMem(memNode, entry.names[xi], kind); refreshVolume(); queuePersist(); };
      wIn.oninput = upd; rIn.oninput = upd;
    }
    return row;
  }

  function renderDay() {
    const tpl = TPL[state.day];
    const tier = tierOf(state.day, state.week);
    dayMetaEl.textContent = tpl.sub;

    const cell = ensureCell();
    const prev = prevFilled(state.day, state.week);
    contentEl.innerHTML = '';

    // Je Block eine datalist – sonst widerspraeche die Tipp-Hilfe am Rechner den
    // Chips darunter. Auf iOS zeigt Safari sie ohnehin nicht an; dort sind die
    // Chips der eigentliche Weg.
    const poolEl = wrap.querySelector('#lg-pool');
    poolEl.innerHTML = '';
    tpl.blocks.forEach((blk) => {
      if (blk.type === 'load') return;
      const dl = document.createElement('datalist');
      dl.id = 'lg-pool-' + blk.id;
      recentNames(blk.type === 'mr' ? 'mr' : 'pump', blk.id).forEach((r) => {
        const o = document.createElement('option'); o.value = r.n; dl.appendChild(o);
      });
      poolEl.appendChild(dl);
    });

    tpl.blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier);
      if (tgt === 0) return;   // Block bei diesem Tier nicht dabei (z.B. optionale MRs bei Tier I)
      if (!cell[blk.id]) {
        cell[blk.id] = { sets: blk.ex.map(() => []) };
      }
      const entry = cell[blk.id];
      const baseMR = blk.type === 'mr';
      const freeEx = blk.type !== 'load';                // Pump & Cluster rotieren frei
      const effType = effTypeOf(blk, tier);              // Typ je Tier (Pump-Ausnahme bei MR)
      if (freeEx) entry.names = entry.names || (entry.name != null ? [entry.name] : []);  // frei pro Woche/Feld
      const names = freeEx ? null : dayNames(state.day, blk);
      const effRest = effType === 'mr' ? MR_REST : (effType === 'pump' ? 60 : blk.rest);
      const effReps = effType === 'mr' ? '6×4' : (baseMR ? '15–25' : blk.reps);

      const el = document.createElement('div'); el.className = 'block';
      const cues = [];
      if (effType === 'load') cues.push('<span class="chip">' + effReps + ' · 0–2 RIR</span>', '<span class="chip">Versagen nur letzter Comp</span>');
      if (effType === 'pump') cues.push('<span class="chip">' + effReps + ' · leicht</span>', '<span class="chip">bis metab. Versagen + Lengthened Partials</span>');
      if (effType === 'mr') cues.push('<span class="chip">6×4 · ~15RM</span>', '<span class="chip">Versagen nur letzter Minisatz</span>');
      cues.push('<button class="chip rest"' + (readOnly ? ' disabled' : '') + ' data-rest="' + effRest + '">⏱ ' + (effRest >= 60 ? (effRest / 60) + ' min' : effRest + ' s') + '</button>');

      el.innerHTML = `
        <div class="bhead">
          <span class="mus">${blk.mus}</span>
          <span class="badge b-${effType}">${TYPE_LABEL[effType] || effType}</span>
          <span class="target" data-tgt="${blk.id}">Sätze <b>${tgt}</b></span>
        </div>
        <div class="cue">${cues.join('')}</div>`;
      // Muskelname mitgeben: Die Mitteilung soll sagen, wovon die Pause war.
      if (!readOnly) el.querySelectorAll('.chip.rest').forEach((b) => (b.onclick = () => startTimer(Number(b.dataset.rest), blk.mus)));

      exOf(blk, tier).forEach((exDef, xi) => {
        const exDiv = document.createElement('div'); exDiv.className = 'ex';

        const hd = document.createElement('div'); hd.className = 'exhead';
        if (exDef.r) { const rl = document.createElement('span'); rl.className = 'role' + (exDef.r === 'Comp' ? ' comp' : ''); rl.textContent = exDef.r; hd.appendChild(rl); }
        const nameIn = document.createElement('input');
        nameIn.className = 'exname'; nameIn.value = (freeEx ? entry.names[xi] : names[xi]) || ''; nameIn.placeholder = blk.free ? 'Übung wählen…' : 'Übung';
        nameIn.disabled = readOnly;
        // Frei rotierende Uebungen aus dem eigenen Bestand vorschlagen: Das
        // Gedaechtnis haengt am Namen, gleiche Schreibweise ist also Bedingung.
        if (freeEx && !readOnly) nameIn.setAttribute('list', 'lg-pool-' + blk.id);
        hd.appendChild(nameIn); exDiv.appendChild(hd);

        // Antippbare Vorschlaege aus dem eigenen Bestand dieses Blocks. Nur bei
        // leerem Feld – ist die Uebung gewaehlt, waeren sie nur noch Rauschen.
        let syncSug = () => {};
        if (freeEx && !readOnly) {
          const all = recentNames(baseMR ? 'mr' : 'pump', blk.id);
          if (all.length) {
            const sugBar = document.createElement('div'); sugBar.className = 'exsug';
            const chip = (r) => {
              const b = document.createElement('button');
              b.type = 'button'; b.className = 'sug'; b.textContent = r.n;
              b.onclick = () => {
                nameIn.value = r.n;
                nameIn.dispatchEvent(new Event('input', { bubbles: true }));
              };
              return b;
            };
            const SHOWN = 5;
            all.slice(0, SHOWN).forEach((r) => sugBar.appendChild(chip(r)));
            const rest = all.slice(SHOWN);
            if (rest.length) {
              // Rest hinter einem "+N", damit die Bloecke nicht in die Hoehe wachsen.
              const more = document.createElement('button');
              more.type = 'button'; more.className = 'sug more';
              more.textContent = '+' + rest.length;
              more.onclick = () => {
                more.remove();
                rest.forEach((r) => sugBar.appendChild(chip(r)));
              };
              sugBar.appendChild(more);
            }
            syncSug = () => { sugBar.hidden = !!nameIn.value.trim(); };
            syncSug();
            exDiv.appendChild(sugBar);
          }
        }

        const prevLine = document.createElement('div'); prevLine.className = 'prev';
        // Anzahl Sätze: Pump-Paare sind Supersets und Cluster-Felder eigenständig -> jede Übung
        // bekommt die volle Zahl. Nur Heavy wird im Wechsel auf Comp/Iso aufgeteilt.
        const count = freeEx ? targetSets(blk, tier) : setsForExercise(blk, tier, xi);
        entry.sets[xi] = entry.sets[xi] || [];
        while (entry.sets[xi].length < count) entry.sets[xi].push({ w: '', r: '', rir: '' });

        const memKind = baseMR ? 'mr' : 'pump';
        if (!readOnly) nameIn.oninput = () => {
          if (freeEx) { entry.names[xi] = nameIn.value; renderMem(prevLine, entry.names[xi], memKind); }
          else { names[xi] = nameIn.value; }
          syncSug();
          queuePersist();
        };

        if (freeEx) {
          renderMem(prevLine, entry.names[xi], memKind);
          exDiv.appendChild(prevLine);
          for (let si = 0; si < count; si++) exDiv.appendChild(effType === 'mr' ? mrRow(entry, xi, si, blk, prevLine) : pumpMrRow(entry, xi, si, prevLine, memKind));
        } else {
          const prevSets = (prev && prev.data[blk.id] && prev.data[blk.id].sets && prev.data[blk.id].sets[xi]) ? prev.data[blk.id].sets[xi] : null;
          renderPrev(prevLine, prevSets, entry.sets[xi].slice(0, count), prev ? prev.week : null);
          exDiv.appendChild(prevLine);
          for (let si = 0; si < count; si++) exDiv.appendChild(setRow(entry, xi, si, blk, prevLine, prevSets, prev, count));
        }

        // Notizen-Feld (gestrichelt) – pro Tag/Übung geteilt
        const notes = dayNotes(state.day, blk);
        const noteWrap = document.createElement('div'); noteWrap.className = 'notewrap';
        const showNote = () => {
          const ta = document.createElement('textarea');
          ta.className = 'exnote'; ta.value = notes[xi] || ''; ta.placeholder = 'Notiz zur Übung…'; ta.rows = 2;
          ta.disabled = readOnly;
          if (!readOnly) ta.oninput = () => { notes[xi] = ta.value; queuePersist(); };
          noteWrap.innerHTML = ''; noteWrap.appendChild(ta);
        };
        if (notes[xi]) {
          showNote();
        } else if (!readOnly) {
          const nb = document.createElement('button'); nb.className = 'addnote'; nb.textContent = '+ Notizen';
          nb.onclick = () => { showNote(); noteWrap.querySelector('textarea').focus(); };
          noteWrap.appendChild(nb);
        }
        exDiv.appendChild(noteWrap);

        el.appendChild(exDiv);
      });
      contentEl.appendChild(el);
    });
    renderVolume(cell, tpl, tier);

    // Reset-Button nur in der letzten Woche (Phase-Ende) – mittig, ganz unten
    phaseResetEl.innerHTML = '';
    if (!readOnly && state.week === 8) {
      const rb = document.createElement('button');
      rb.className = 'phase-reset';
      rb.textContent = '🔄 Neue Phase starten – alle Daten löschen';
      rb.onclick = resetAllData;
      phaseResetEl.appendChild(rb);
    }
  }

  async function resetAllData() {
    if (!confirm('ALLE eingetragenen Daten löschen (Übungen, Gewichte, Wdh, RIR, Notizen)?\n\nDanach startest du mit komplett leeren Feldern in eine neue Phase.\n\nDein Pump- und Cluster-Übungspool bleibt erhalten: Trägst du eine Übung wieder ein, siehst du weiterhin, was du zuletzt geschafft hast.')) return;
    // Pool retten, bevor die Wochendaten fallen. Neuere Werte gewinnen.
    state.mem = Object.assign({}, state.mem, harvestMem(state.data));
    state.data = {}; state.ex = {}; state.notes = {}; state.tier = {}; state.rot = {};
    state.week = 1; state.day = 'OK-A';
    clearTimeout(saveTimer);
    // Leeren ist eine Absicht: Dieser Stand ersetzt den Server, auch wenn der
    // Upload erst spaeter gelingt. Sonst holt der Abgleich alles wieder zurueck.
    writeLog(userId, payloadOut(), true, true);
    await persist();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'instant' });
    toast('Neue Phase – alles zurückgesetzt');
  }

  function renderVolume(cell, tpl, tier) {
    let total = 0, tgtTotal = 0;
    const rows = tpl.blocks.map((blk) => {
      const tgt = targetSets(blk, tier);
      if (tgt === 0) return null;
      const entry = cell[blk.id]; if (!entry) return null;
      let sets = 0;
      (entry.sets || []).forEach((arr, xi) => {
        const cnt = setsForExercise(blk, tier, xi);
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) sets++; });
      });
      total += sets; tgtTotal += tgt;
      return { mus: blk.mus, sets, tgt };
    }).filter(Boolean);

    volEl.innerHTML = '<h3>Volumen · Tier ' + TIER_NAMES[tier] + '</h3>' +
      '<div class="voltot">' + total + ' <span>/ ' + tgtTotal + ' ARBEITSSÄTZE</span></div>' +
      rows.map((r) => {
        const pct = r.tgt ? Math.min(100, Math.round(r.sets / r.tgt * 100)) : (r.sets ? 100 : 0);
        const met = r.tgt > 0 && r.sets >= r.tgt;
        return `<div class="volrow"><span class="m">${r.mus}</span>
          <span class="track"><span class="fill${met ? ' met' : ''}" style="width:${pct}%"></span></span>
          <span class="v"><b>${r.sets}</b>/${r.tgt}</span></div>`;
      }).join('');

    contentEl.querySelectorAll('.target[data-tgt]').forEach((el) => {
      const blk = tpl.blocks.find((b) => b.id === el.dataset.tgt); if (!blk) return;
      const entry = cell[blk.id]; let sets = 0;
      const tgt = targetSets(blk, tier);
      ((entry && entry.sets) || []).forEach((arr, xi) => {
        const cnt = setsForExercise(blk, tier, xi);
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) sets++; });
      });
      el.classList.toggle('met', tgt > 0 && sets >= tgt);
      el.innerHTML = 'Sätze <b>' + tgt + '</b>';
    });
  }
  function refreshVolume() { renderVolume(ensureCell(), TPL[state.day], tierOf(state.day, state.week)); }

  function renderAll() { renderHeader(); renderDay(); }
  renderAll();

  // ---- pause timer (editable only) ---------------------------------
  let tEnd = 0;
  // Signal am Ende der Pause.
  //
  // Vibration gibt es auf iOS nicht – WebKit hat navigator.vibrate nie
  // ausgeliefert. Der Aufruf bleibt fuer Android drin und ist auf dem iPhone
  // folgenlos. Traegt dort also der Ton.
  //
  // iOS gibt Audio nur nach einer Nutzeraktion frei, darum wird der Context
  // beim Antippen des Timers geweckt und offen gehalten. Liegt das Handy mit
  // dunklem Display in der Tasche, friert iOS das JavaScript ein – dann kommt
  // weder Ton noch sonst etwas. Das ist die Grenze einer Web-App.
  let audioCtx = null;
  function primeAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* kein Audio – der Timer laeuft trotzdem */ }
  }
  function alertDone() {
    try { navigator.vibrate?.([180, 90, 180]); } catch (e) { /* egal */ }
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
      // Zwei kurze Toene: hoerbar, aber kein Alarm.
      [0, 0.22].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t0 = audioCtx.currentTime + offset;
        osc.frequency.setValueAtTime(880, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0); osc.stop(t0 + 0.2);
      });
    } catch (e) { /* egal */ }
  }

  // Pausenende per Push bestellen.
  //
  // Der Ton unten erreicht dich nur, solange die App vorne ist – bist du bei
  // YouTube, friert iOS das JavaScript ein. Lokal geplante Mitteilungen gibt es
  // auf iOS nicht, also muss die Erinnerung von aussen kommen. Die Edge Function
  // schlaeft die Pause ab und schickt dann.
  //
  // Fehler hier bleiben still: Der Timer auf dem Bildschirm laeuft ohnehin, der
  // Push ist die Zugabe.
  function pushTimer(aktion, sec, label) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!navigator.onLine) return;
    supabase.functions
      .invoke('pausentimer', { body: { aktion, sekunden: sec, label } })
      .catch(() => {});
  }

  function startTimer(sec, label) {
    if (!saveBar) return;
    primeAudio();
    pushTimer('start', sec, label);
    clearInterval(timerId);
    tEnd = Date.now() + sec * 1000;
    const box = saveBar.querySelector('#lg-timer'); box.hidden = false; box.classList.remove('done');
    tick();
    timerId = setInterval(tick, 250);
  }
  function tick() {
    const box = saveBar && saveBar.querySelector('#lg-timer'); if (!box) return;
    const left = Math.max(0, Math.round((tEnd - Date.now()) / 1000));
    box.querySelector('#lg-timertxt').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    if (left <= 0) {
      clearInterval(timerId);
      box.classList.add('done');
      alertDone();
      setTimeout(() => { box.hidden = true; }, 4000);
    }
  }

  // ---- principles sheet --------------------------------------------
  function openSheet() { if (sheet) sheet.hidden = false; }
  function buildSheet() {
    sheet = document.createElement('div');
    sheet.className = 'sheet'; sheet.hidden = true;
    sheet.innerHTML = `
      <div class="sheet-in">
        <div class="sheet-hd"><h2>FAQ</h2><button class="sp-x" id="lg-sheetx" aria-label="schließen">×</button></div>
        <details class="faq"><summary>Worauf kommt es beim Training an?</summary>
          <div class="faq-a">
            <p><b>1. Progressive Überlastung</b> — mehr Last oder mehr Wdh. gegenüber dem letzten Mal. Steht als Delta über jeder Übung.</p>
            <p><b>2. Nähe zum Versagen</b> — 0–3 RIR. Der Reizauslöser pro Satz.</p>
            <p><b>3. Erholung</b> — Schlaf, Protein, Stress. Das Fundament.</p>
            <p>Volumen ist der Dosis-Regler (~10–20 Sätze/Muskel/Woche). Frequenz verteilt nur — 2–3×/Muskel. Kater ist kein Maß.</p>
          </div>
        </details>
        <details class="faq"><summary>Wie trainiere ich die Heavy-Sätze?</summary>
          <div class="faq-a"><p>6–12 Wdh., 0–2 RIR. Im Wechsel: <b>Comp → Iso → Comp → Iso</b>. Versagen nur im <b>letzten Comp-Satz</b>; Iso-Sätze dürfen ans Versagen. Pause: Oberkörper 90 s, Unterkörper 120 s, Waden 60 s.</p></div>
        </details>
        <details class="faq"><summary>Wie trainiere ich die Pump-Sätze?</summary>
          <div class="faq-a">
            <p>15–25 Wdh., leichte Last (~50 % 1RM), Pause 60 s, im Supersatz gekoppelt. Bis zum <b>metabolischen Versagen</b>, dann <b>Lengthened Partials</b>. Übungen frei rotieren.</p>
            <p><b>Lengthened Partials</b> sind Teilwiederholungen <b>nur im gedehnten Bereich</b> — du kommst nicht mehr in die volle Kontraktion, sondern arbeitest weiter dort, wo der Muskel am längsten ist. Genau diese Position treibt das Wachstum überproportional; Teilwdh. dort erzielen ähnliche Anpassungen wie volle Wiederholungen.</p>
            <p>Das funktioniert nur, wo unten auch Spannung anliegt: Fly-Maschine, Latzug, Beinstrecker, sitzender Beinbeuger, Schrägbank-Curl. Bei KH-Seitheben oder stehenden KH-Curls hängt der Arm unten spannungslos — dort bringt es nichts.</p>
            <p>Nicht zu verwechseln mit der <b>1¼-Wdh.</b> („1/4 Wdh. unten"): volle Wiederholung <i>plus</i> ein Viertel unten, bei jeder Wdh. Verwandtes Prinzip, aber ohne eigene Studienlage.</p>
          </div>
        </details>
        <details class="faq"><summary>Wie funktionieren die Clusters?</summary>
          <div class="faq-a"><p>6 Minisätze à 4 Wdh., ~10 s Pause, 5–10 min pro Round. Gewicht ≈ 15RM. <b>Nur ein Versagenspunkt</b>, im letzten Minisatz.</p></div>
        </details>
        <details class="faq"><summary>Was bedeuten die Level (I/II/III)?</summary>
          <div class="faq-a"><p><b>Level I</b> = wenig Sätze, schlechter Tag. <b>Level III</b> = volles Volumen, guter Tag. Nach Tagesform wählen, nicht nach Ehrgeiz.</p></div>
        </details>
        <details class="faq"><summary>Wie steigere ich mich (Progression)?</summary>
          <div class="faq-a"><p>Doppelte Progression: erst Wdh. ans obere Ende, dann Last hoch (2,5–5 kg), Wdh. zurück. <b>2 Einheiten ohne Fortschritt</b> → Übung tauschen.</p></div>
        </details>
        <details class="faq"><summary>Was ist SMASH und Deload?</summary>
          <div class="faq-a"><p>SMASH = 6 Wochen progressiv (Level steigend). Danach Deload (2 Wochen): Volumen und Frequenz runter, nur Clusters — zum Erholen, bevor die nächste Phase startet.</p></div>
        </details>
        <details class="faq"><summary>Wie merkt sich die App meine Übungen und Gewichte?</summary>
          <div class="faq-a">
            <p><b>Heavy-Übungen</b> gehören fest zum Tag: einmal eingetragen, stehen sie in jeder Woche derselben A/B-Woche wieder da. Darunter siehst du <i>„Wo 3: 80×8, 80×7"</i> — die Werte vom letzten Mal, plus <b>▲ gesteigert</b> / <b>= gehalten</b> / <b>▼ gesunken</b>, sobald du heute etwas einträgst.</p>
            <p><b>Pump- und Cluster-Übungen</b> rotierst du frei. Sie hängen deshalb nicht am Tag, sondern <b>am Namen</b>: Trägst du dieselbe Übung irgendwann wieder ein — egal an welchem Tag oder in welcher Woche — erscheint automatisch <i>„zuletzt: 30 kg × 18 Wdh · Wo 3"</i> bzw. beim Cluster <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>.</p>
            <p>Der Name muss dafür gleich geschrieben sein — Groß-/Kleinschreibung und Leerzeichen am Rand sind egal, aber <i>„Beinstrecker"</i> und <i>„Beinstrecker Maschine"</i> gelten als zwei verschiedene Übungen.</p>
            <p>Bei Pump und Cluster gibt es bewusst <b>kein</b> ▲/▼-Delta: Diese Sätze sind nicht zum Progressions-Tracking gedacht — der Wert dient nur als Anhaltspunkt fürs Einstellen.</p>
          </div>
        </details>
        <details class="faq"><summary>Was bedeutet die A/B-Woche?</summary>
          <div class="faq-a"><p>Die Heavy-Tage wechseln wöchentlich zwischen zwei Übungs-Gruppierungen: <b>A</b> in ungeraden, <b>B</b> in geraden Wochen. So kommt jede Übung alle zwei Wochen wieder — oft genug, um Fortschritt sauber zu vergleichen. Pump und Cluster sind davon nicht betroffen, die wählst du jedes Mal frei.</p></div>
        </details>
        <details class="faq"><summary>Wie kommen die Satzzahlen zustande?</summary>
          <div class="faq-a">
            <p>Die Zahl hinter <b>Sätze</b> ist fest in der App hinterlegt und hängt am gewählten Level — du musst nichts selbst rechnen.</p>
            <p><b>Heavy:</b> die Sätze des Muskels werden im Wechsel auf Comp und Iso verteilt. Rücken Level III = 4 → 2 Comp + 2 Iso. Level I = 1 → nur der Comp-Satz, das Iso-Feld bleibt leer.</p>
            <p><b>Pump und Cluster:</b> gekoppelte Übungen sind Supersätze, die Zahl gilt <b>je Übung</b>. Brust/Rücken Level III = 2 heißt also 2 Sätze Brust <i>und</i> 2 Sätze Rücken.</p>
          </div>
        </details>
        <details class="faq"><summary>Was bedeutet der Punkt auf den Tag-Feldern?</summary>
          <div class="faq-a">
            <p>Er zeigt, wie weit die Einheit in dieser Woche ist:</p>
            <p><b>Offener Ring</b> — angefangen, aber die Soll-Sätze fehlen noch.<br>
            <b>Gefüllt (grün)</b> — alle Soll-Sätze des Tages sind eingetragen.<br>
            <b>Kein Punkt</b> — hier steht noch nichts.</p>
            <p>Gezählt wird gegen dasselbe Ziel wie unten in der Volumen-Leiste („X / Y Arbeitssätze") — die beiden können sich also nicht widersprechen. Maßgeblich ist das Level, das du für den Tag gewählt hast.</p>
          </div>
        </details>
        <details class="faq"><summary>Was heißt das Zeichen oben rechts?</summary>
          <div class="faq-a"><p>Rechts neben dem <b>?</b> steht der Sync-Status: <b>✓</b> gespeichert · <b>↻</b> speichert gerade oder noch nicht gesichert · <b>⚠</b> Fehler, nicht gespeichert. Die App speichert nach jeder Eingabe von selbst — „Einheit speichern" unten ist nur da, wenn du sofort sichern willst.</p></div>
        </details>
        <details class="faq"><summary>Wofür ist das Notizfeld?</summary>
          <div class="faq-a"><p>„+ Notiz" gehört zur Übung und gilt für <b>alle</b> Wochen — gedacht für Einstellungen und Cues, die gleich bleiben: Sitzhöhe, Griffbreite, Fußposition.</p></div>
        </details>
        <details class="faq"><summary>Was macht der Button in Woche 8?</summary>
          <div class="faq-a">
            <p>„🔄 Neue Phase starten" leert alle eingetragenen Daten und setzt dich zurück auf Woche 1: Übungen, Gewichte, Wdh., RIR und Notizen. Gedacht für den Start einer komplett neuen SMASH-Phase.</p>
            <p><b>Dein Pump- und Cluster-Übungspool bleibt aber erhalten</b> — siehe unten.</p>
          </div>
        </details>
        <details class="faq"><summary>Was ist der Übungs-Pool?</summary>
          <div class="faq-a">
            <p>Deine Pump- und Cluster-Übungen sammeln sich dauerhaft an — über Phasen hinweg. Wählst du in der nächsten SMASH-Phase wieder eine Übung, die du früher schon mal gemacht hast, siehst du sofort, was du damals geschafft hast: <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>, markiert mit <b>Pool</b>.</p>
            <p>Der Pool überlebt „Neue Phase starten" bewusst — genau dafür ist er da. Gelöscht wird er nie.</p>
            <p>Solange die <b>laufende</b> Phase schon Werte zu der Übung hat, gewinnen die: dann steht dort <b>Wo 3</b> statt <b>Pool</b>. Die Wochennummer wäre bei Pool-Werten auch irreführend, weil sie mit jeder Phase wieder bei 1 startet.</p>
          </div>
        </details>
        <details class="faq"><summary>Soll ich stretchen?</summary>
          <div class="faq-a">
            <p><b>1. Kein Verletzungsschutz.</b> Krafttraining senkt Verletzungen um rund zwei Drittel, Dehnen zeigt keinen günstigen Effekt — die Daten stützen einen Schutzeffekt schlicht nicht.</p>
            <p><b>2. Als Wachstumsreiz zu klein.</b> Aktuelle Meta-Analysen finden triviale bis kleine Effekte (d = 0,12–0,20) — und das nur bei 30–60 Minuten Dehnen pro Tag und Muskel. Neben deinem Heavy-, Pump- und Cluster-Volumen fällt das nicht ins Gewicht.</p>
            <p><b>3. Die Begründung ist überholt.</b> Die alte Begründung fürs Dehnen stützt sich auf GH-Ausschüttung und „metabolischen Stress". Die Hormon-Hypothese gilt seit rund 2010 als widerlegt, metabolischer Stress als eigenständiger Treiber wurde stark zurückgestuft. Heute gilt mechanische Spannung als Haupttreiber.</p>
            <p><b>4. Der gute Kern lebt woanders.</b> Was wirkt, ist Belastung bei <b>langer Muskellänge</b> — über Übungsauswahl und volle ROM in den Arbeitssätzen, nicht über einen 60–90-Sekunden-Halt danach.</p>
            <p><b>5. Beweglichkeit kommt ohnehin.</b> Krafttraining über volle ROM verbessert die Beweglichkeit genauso stark wie dediziertes Dehnen.</p>
            <p><b>Wann Dehnen trotzdem sinnvoll ist:</b> gezielt gegen eine konkrete Einschränkung, die deine Technik verschlechtert — verkürzte Hüftbeuger oder Brust vom Sitzen etwa. Das ist ein Technik-Argument, kein Gelenk-Argument, und es ist das stärkste Argument fürs Dehnen. Vor dem Heben kurz und dynamisch halten; langes statisches Dehnen (über 60 s) senkt die Kraft kurzfristig.</p>
          </div>
        </details>
        <p class="src">Evidenz: Pelland et al. 2025 · Baz-Valle et al. 2022 · Schoenfeld et al. 2021 · Wolf/Schoenfeld 2025.</p>
      </div>`;
    document.body.appendChild(sheet);
    sheet.querySelector('#lg-sheetx').onclick = () => { sheet.hidden = true; };
    sheet.onclick = (e) => { if (e.target === sheet) sheet.hidden = true; };
  }
  buildSheet();

  if (mergedOffline && !readOnly) {
    // Offline geladen oder zusammengefuehrt: Der lokale Stand ist jetzt der
    // gueltige und muss noch hoch. Markieren und (falls Netz da ist) senden.
    writeLog(userId, payloadOut(), true);
    setStatus('offline');
    if (navigator.onLine) persist();
  } else if (serverOk && !readOnly) {
    // Frisch vom Server geladen: Spiegel sofort anlegen, sauber (nichts offen).
    //
    // Ohne das entstand der Spiegel erst beim ersten Tippen – wer die App nur
    // oeffnete und schaute, hatte offline nichts und bekam einen Fehler. Jeder
    // Besuch mit Netz macht die App jetzt fuer das naechste Funkloch bereit.
    writeLog(userId, payloadOut(), false, false);
  }

  // ---- sticky save bar (editable only) -----------------------------
  if (!readOnly) {
    saveBar = document.createElement('div');
    saveBar.className = 'savebar';
    saveBar.innerHTML = `
      <div class="inner">
        <button class="btn btn-primary" id="lg-savebtn">Einheit speichern</button>
        <div class="timer" id="lg-timer" hidden><span id="lg-timertxt">0:00</span><button class="x" id="lg-timerx" aria-label="Timer abbrechen">×</button></div>
      </div>`;
    document.body.appendChild(saveBar);
    saveBar.querySelector('#lg-savebtn').onclick = async (e) => {
      // Kurz gelb aufleuchten und zurueck ins Pink faden: sichtbare Bestaetigung,
      // dass der Tipp angekommen ist. Bewusst unabhaengig vom Upload – der ist
      // mal nach 90ms durch, mal nach einer Sekunde; die Rueckmeldung soll immer
      // gleich aussehen. Was tatsaechlich passiert ist, sagen Toast und Sync-Zeichen.
      const btn = e.currentTarget;
      btn.classList.remove('flash');
      void btn.offsetWidth;              // Reflow: laesst schnelles Nachtippen erneut aufleuchten
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 200);

      clearTimeout(saveTimer);
      const ok = await persist();
      if (ok) toast('Wo ' + state.week + ' · ' + state.day + ' gespeichert');
    };
    saveBar.querySelector('#lg-timerx').onclick = () => {
      clearInterval(timerId);
      saveBar.querySelector('#lg-timer').hidden = true;
      // Auch den schlafenden Auftrag abbestellen, sonst meldet er sich spaeter
      // fuer eine Pause, die du abgebrochen hast.
      pushTimer('stop');
    };
  }

  return {
    destroy() {
      clearTimeout(saveTimer);
      clearInterval(timerId);
      clearInterval(retryId);
      window.removeEventListener('online', retrySync);
      if (saveBar) saveBar.remove();
      if (sheet) sheet.remove();
    },
  };
}

// ---- toast (shared) ------------------------------------------------
let toastEl = null, toastTimer = null;
export function toast(t) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = t;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1700);
}
