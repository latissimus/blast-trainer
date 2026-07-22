import { supabase } from './supabase.js';
import { readLog, writeLog, mergePayload } from './localstore.js';
import { TPL, LEGACY, TIER_NAMES } from './template.js';
import { targetSets, effTypeOf, exOf, setsForExercise } from './saetze.js';
import { memKey, harvestMem, recentNames as poolNames } from './pool.js';
import { auswahlGruppen, imKatalog } from './auswahl.js';
import { prioritaetsAnpassungen, slotKey } from './prioritaet.js';

// Pause zwischen zwei Clustern (s). Kein fester Vorgabewert
// ("so viel wie nötig", Richtwert ein Cluster alle ~10 min) – hier bewusst gesetzt.
const MR_REST = 120;

// Anzeige-Labels der Set-Typen. Die internen Keys (load/pump/mr) bleiben, damit
// gespeicherte Logs gueltig bleiben – nur die Beschriftung wechselt.
const TYPE_LABEL = { load: 'HEAVY', pump: 'PUMP', mr: 'CLUSTER' };

/* ------------------------------------------------------------------
   Mount the LOGMAN log (v2: Level, A/B-Wochen, Rollen, Pausen-Timer)
   into `container`.
     userId    – whose training_logs row to load
     readOnly  – true for the admin viewing a customer (no editing/saving)
   Returns { destroy } to remove the sticky save bar on nav.
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
    // Seit dem einwoechigen Deload endet eine Phase mit Woche 7. Alte
    // Speicherstaende aus der frueheren Woche 8 landen sicher im Deload.
    week: Math.min(7, Math.max(1, Number(p.week) || 1)),
    day: TPL[p.day] ? p.day : 'OK-A',
    data: p.data || {},
    tier: p.tier || {},
    rot: p.rot || {},
    ex: p.ex || {},      // gemeinsame Übungsnamen pro Tag (über alle Wochen der Rotation)
    notes: p.notes || {}, // gemeinsame Notizen pro Tag/Übung
    mem: p.mem || {},    // Übungs-Pool: Name -> zuletzt geschaffte Last, ueberlebt den Phasen-Reset
    datum: p.datum || {},  // Tag|Woche -> ISO-Datum der Einheit
    volumen: { prioritaet: p.volumen?.prioritaet || {} }, // Muskel-Prioritaeten
  };
  migrateData();

  let saveTimer = null;
  let saveStateEl = null;
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
    return { data: state.data, week: state.week, day: state.day, tier: state.tier, rot: state.rot, ex: state.ex, notes: state.notes, mem: state.mem, datum: state.datum, volumen: state.volumen, v: 3 };
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
  const isCruise = (week) => week >= 7;   // Woche 7 = Deload: nur Clusters, Level I
  // Deload: 2-3 Einheiten pro Woche, alle nur Clusters -> drei
  // eigene Slots, damit jede Einheit getrennt geloggt wird. Der dritte ist optional.
  const daysOfWeek = (week) => {
    if (isCruise(week)) return ['MRs', 'MRs-2', 'MRs-3'];
    const r = rotOf(week); return ['OK-' + r, 'UK-' + r, 'MRs'];
  };
  const tierOf = (day, week) => {
    if (isCruise(week)) return 0;   // Deload fest auf Level I
    const t = state.tier[day + '|' + week]; return (t === 0 || t === 1 || t === 2) ? t : 1;
  };
  const setTier = (day, week, t) => { state.tier[day + '|' + week] = t; };
  // Duenner Aufsatz: der Pool ist zustandslos, den Zustand geben wir hier rein.
  const recentNames = (kind, blockId) => poolNames(kind, blockId, state.data, state.mem);

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
    const prio = prioritaetsAnpassungen(payloadOut(), week);
    let done = 0, tgtTotal = 0;
    tpl.blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier); if (tgt === 0) return;
      const entry = cell[blk.id];
      exOf(blk, tier).forEach((_, xi) => {
        const basis = blk.type === 'load' ? setsForExercise(blk, tier, xi) : targetSets(blk, tier);
        const cnt = Math.max(0, basis + (prio.delta[slotKey(day, blk.id, xi)] || 0));
        tgtTotal += cnt;
        const arr = (entry && entry.sets && entry.sets[xi]) || [];
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
  // Woche, Tag, Level und Datum sind in die untere Leiste gewandert (siehe
  // unten). Oben bleibt nur, was man liest und nicht bedient: die Phase und
  // die Beschreibung des Tages. Dadurch faengt der erste Trainingsblock
  // unmittelbar unter der Kopfleiste an, statt nach drei Reihen Bedienelementen.
  wrap.innerHTML = `
    ${readOnly ? '' : `<div class="som-tab" id="lg-som-tab">
      <button class="som-tab-toggle" type="button" aria-expanded="false" aria-controls="lg-som-ziel">Set-O</button>
      <a class="som-tab-ziel" id="lg-som-ziel" href="#meter" tabindex="-1">Meter öffnen <i aria-hidden="true">›</i></a>
    </div>`}
    <div id="lg-content" class="erstblock${readOnly ? '' : ' mit-som-hinweis'}"></div>
    <div class="volbar" id="lg-vol"></div>
    <div id="lg-phasereset"></div>
    <div id="lg-pool" hidden></div>`;
  container.appendChild(wrap);

  // Der Sync-Punkt sitzt in der Kopfleiste: Dort ist Platz, er ist immer im Blick,
  // und die Wochen-Leiste bleibt frei fuer Woche, A/B und Phase. Die Kopfleiste
  // haelt den Platz bereit, das Log fuellt ihn – und raeumt ihn beim Verlassen.
  saveStateEl = readOnly ? null : document.querySelector('#app-save');
  if (saveStateEl) saveStateEl.hidden = false;
  const contentEl = wrap.querySelector('#lg-content');
  const volEl = wrap.querySelector('#lg-vol');
  const phaseEl = document.querySelector('#app-phase');
  const phaseResetEl = wrap.querySelector('#lg-phasereset');

  // Kleine Lasche statt Pull-down-Karte: Ein Tipp verbreitert sie, der dann
  // sichtbare Link oeffnet das Set-O-Meter.
  const somTab = wrap.querySelector('#lg-som-tab');
  if (somTab) {
    const toggle = somTab.querySelector('.som-tab-toggle');
    const ziel = somTab.querySelector('.som-tab-ziel');
    toggle.onclick = () => {
      const offen = somTab.classList.toggle('offen');
      toggle.setAttribute('aria-expanded', offen ? 'true' : 'false');
      ziel.tabIndex = offen ? 0 : -1;
    };
  }

  // ---- untere Bedienleiste -----------------------------------------
  // Woche, Tag, Level und Datum. Alle vier stellt man einmal zu Beginn der
  // Einheit ein und fasst sie danach nicht mehr an – sie brauchen keinen
  // Dauerplatz oben, aber sie muessen ablesbar bleiben. Darum je Feld zwei
  // Zeilen: oben der Wert, unten wofuer er steht.
  //
  // WIRD IMMER GEBAUT, auch in der Nur-Lese-Ansicht des Admins: Dort sind es
  // die einzigen Bedienelemente, mit denen er durch fremde Wochen blaettert.
  // Frueher hing das an der Speicherleiste, die es im readOnly nicht gab.
  //
  // Je Feld liegt ein durchsichtiges natives Element ueber der Beschriftung:
  // <select> und <input type="date"> oeffnen auf iOS die Systemauswahl, die
  // sich mit einer eigenen Nachbildung nur verschlechtern liesse.
  // Die Leiste selbst gehoert der App-Huelle (main.js) und ueberlebt den
  // Ansichtswechsel – sonst gaebe es auf der FAQ-Seite keinen Weg zurueck.
  // Das Log fuellt nur seine vier Felder ein und raeumt sie beim Verlassen.
  // Die Leiste und ihre vier Felder gehoeren der App-Huelle (main.js): Sie
  // stehen auf JEDER Seite, damit die Leiste ueberall gleich aussieht. Ohne
  // gemountetes Log sind sie stillgelegt; hier werden sie uebernommen.
  const ctrl = document.querySelector('#app-slots');
  ctrl.querySelectorAll('select,input').forEach((el) => { el.disabled = false; });

  const wocheSel = ctrl.querySelector('#lg-woche');
  const tagSel = ctrl.querySelector('#lg-tag');
  const tierSeg = ctrl.querySelector('#lg-tier');
  const datumEl = ctrl.querySelector('#lg-datum');
  const woWert = ctrl.querySelector('#ci-wo-w'), woLbl = ctrl.querySelector('#ci-wo-l');
  const tagWert = ctrl.querySelector('#ci-tag-w'), tagLbl = ctrl.querySelector('#ci-tag-l');
  const lvlWert = ctrl.querySelector('#ci-lvl-w');
  const datWert = ctrl.querySelector('#ci-dat-w');

  wocheSel.innerHTML = Array.from({ length: 7 }, (_, i) =>
    `<option value="${i + 1}">Woche ${i + 1}${i + 1 >= 7 ? ' · Deload' : ''}</option>`).join('');
  wocheSel.onchange = () => { state.week = Number(wocheSel.value); queuePersist(); renderAll(); window.scrollTo({ top: 0, behavior: 'instant' }); };
  tagSel.onchange = () => { state.day = tagSel.value; queuePersist(); renderAll(); window.scrollTo({ top: 0, behavior: 'instant' }); };
  tierSeg.onchange = () => { setTier(state.day, state.week, Number(tierSeg.value)); queuePersist(); renderAll(); };

  // Datum der Einheit. Ohne das weiss man beim Blick auf Woche 3 nie, wann sie
  // tatsaechlich stattgefunden hat – und ob zwischen zwei Einheiten zwei Tage
  // lagen oder zwei Wochen.
  datumEl.onchange = () => {
    const w = datumEl.value;
    if (w) state.datum[state.day + '|' + state.week] = w;
    else delete state.datum[state.day + '|' + state.week];
    queuePersist();
    renderControls();
  };

  // ---- render ------------------------------------------------------
  function renderHeader() {
    // Phase immer ablesbar, aber unterschiedlich laut: Der Overreach ist der
    // Normalzustand und bleibt eine Beschriftung; der Deload ist die Ausnahme,
    // in der sich wirklich etwas aendert – der darf auffallen.
    const imDeload = isCruise(state.week);
    phaseEl.hidden = false;
    phaseEl.textContent = imDeload ? 'Deload' : 'Overreach';
    phaseEl.classList.toggle('laut', imDeload);
    renderControls();
  }

  // Beschriftung der unteren Leiste. Steht getrennt, weil sie auch nach einer
  // Datumsaenderung allein nachgezogen wird.
  function renderControls() {
    const days = daysOfWeek(state.week);
    if (!days.includes(state.day)) state.day = days[0];
    const cruise = isCruise(state.week);

    wocheSel.value = String(state.week);
    woWert.textContent = 'Wo ' + state.week;
    // Die Unterzeile traegt die Rotation – im Deload gibt es keine.
    woLbl.textContent = cruise ? 'Deload' : rotOf(state.week) + '-Woche';

    // Der Fortschritt der ANDEREN Tage war frueher als Punkt auf den drei
    // Reitern sichtbar. In einer Klappliste faellt das weg, also steht er jetzt
    // im Eintrag: ✓ Soll erreicht, ◦ angefangen, sonst nichts.
    // Die Optionen werden AN ORT UND STELLE geaendert, nicht neu gebaut.
    //
    // Mit innerHTML zerstoerte der Browser die Kindknoten des nativen <select>
    // und baute sie neu – dabei zeichnete er kurz das Systemsteuerelement mit,
    // und es blieben weisse, eckige Reste ueber der Rundung der Leiste stehen.
    // Sichtbar wurde das beim Wechsel von Tag und Level, weil sich dort die
    // Fortschrittsmarke (✓/◦) aendert: Ein anderes Level heisst ein anderes
    // Satz-Soll und damit ein anderer Stand. Die Wochenliste hatte das Problem
    // nie – sie wird einmalig beim Start gefuellt und danach nur ausgewaehlt.
    const beschriftung = (d, i) => {
      const pr = dayProgress(d, state.week);
      const mark = pr.any ? (pr.met ? '✓ ' : '◦ ') : '';
      const opt = cruise && i === 2 ? ' (opt.)' : '';
      return `${mark}Tag ${i + 1}${opt} · ${TPL[d].short}`;
    };
    if (tagSel.options.length !== days.length) {
      // Nur wenn sich die ANZAHL aendert (Overreach <-> Deload) bleibt nichts
      // anderes uebrig, als die Liste neu aufzubauen.
      tagSel.innerHTML = days.map((d) => `<option value="${d}"></option>`).join('');
    }
    days.forEach((d, i) => {
      const o = tagSel.options[i];
      if (o.value !== d) o.value = d;
      const txt = beschriftung(d, i);
      if (o.textContent !== txt) o.textContent = txt;
    });
    if (tagSel.value !== state.day) tagSel.value = state.day;
    const idx = days.indexOf(state.day);
    tagWert.textContent = 'Tag ' + (idx + 1);
    // Kurzform ohne "· Heavy": In 60px passt nur der Koerperteil, und die volle
    // Beschreibung steht ohnehin direkt ueber dem ersten Block.
    tagLbl.textContent = TPL[state.day].short.split(' · ')[0];

    const tier = tierOf(state.day, state.week);
    tierSeg.value = String(tier);
    tierSeg.disabled = cruise;                    // Level im Deload gesperrt (I)
    lvlWert.textContent = TIER_NAMES[tier];
    ctrl.querySelector('#ci-lvl-l').textContent = cruise ? 'fest' : 'Level';

    const dat = state.datum[state.day + '|' + state.week] || '';
    datumEl.value = dat;
    // Kurzdatum: "19.07." reicht, das Jahr ist aus dem Zusammenhang klar.
    datWert.textContent = dat ? dat.slice(8, 10) + '.' + dat.slice(5, 7) + '.' : '—';
    datWert.classList.toggle('leer', !dat);
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
  // naechsten Overreach-Phase nachschauen kann, was man zuletzt geschafft hat, wird beim
  // Phasen-Reset aus den Wochendaten ein Pool geerntet, der bestehen bleibt.
  // Gelesen wird er nur als Rueckfalloption: solange die laufende Phase Daten
  // zur Übung hat, gewinnen die – das Verhalten innerhalb einer Phase bleibt
  // dadurch unveraendert.
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
    const prio = prioritaetsAnpassungen(payloadOut(), state.week);

    const cell = ensureCell();
    const prev = prevFilled(state.day, state.week);
    contentEl.innerHTML = '';

    // Frueher hing hier je Block eine datalist fuer die Tipp-Hilfe am Rechner.
    // Mit der Katalog-Auswahl gibt es nichts mehr zu tippen – das <select>
    // bringt seine Liste selbst mit, auf iOS als Auswahlrad.
    wrap.querySelector('#lg-pool').innerHTML = '';

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
      const blockMus = blk.mus;

      const el = document.createElement('div'); el.className = 'block';
      const cues = [];
      if (effType === 'load') cues.push('<span class="chip">' + effReps + ' · 0–2 RIR</span>', '<span class="chip">Versagen nur letzter Comp</span>');
      if (effType === 'pump') cues.push('<span class="chip">' + effReps + ' · leicht</span>', '<span class="chip">versagensnah · Partials optional</span>');
      if (effType === 'mr') cues.push('<span class="chip">6×4 · ~15RM</span>', '<span class="chip">Versagen nur letzter Minisatz</span>');
      cues.push('<button class="chip rest"' + (readOnly ? ' disabled' : '') + ' data-rest="' + effRest + '">⏱ ' + (effRest >= 60 ? (effRest / 60) + ' min' : effRest + ' s') + '</button>');

      el.innerHTML = `
        <div class="bhead">
          <span class="mus">${blockMus}</span>
          <span class="badge b-${effType}">${TYPE_LABEL[effType] || effType}</span>
          <span class="target" data-tgt="${blk.id}">Sätze <b>${tgt}</b></span>
        </div>
        <div class="cue">${cues.join('')}</div>`;
      // Muskelname mitgeben: Die Mitteilung soll sagen, wovon die Pause war.
      if (!readOnly) el.querySelectorAll('.chip.rest').forEach((b) => (b.onclick = () => startTimer(Number(b.dataset.rest), blockMus)));

      exOf(blk, tier).forEach((exDef, xi) => {
        const exDiv = document.createElement('div'); exDiv.className = 'ex';

        const hd = document.createElement('div'); hd.className = 'exhead';
        if (exDef.r) { const rl = document.createElement('span'); rl.className = 'role' + (exDef.r === 'Comp' ? ' comp' : ''); rl.textContent = exDef.r; hd.appendChild(rl); }
        // Auswahl statt Freitext: Nur was im Katalog steht, laesst sich
        // eintragen. Sonst wuesste das Wochenkonto nicht, auf welches
        // Muskelkonto ein Satz laeuft – und ein Tippfehler waere still eine
        // zweite Uebung. Welche Uebungen ein Feld anbietet, entscheiden die
        // Konten des Blocks und (bei Heavy) Comp/Iso.
        //
        // Natives <select> statt eigener Liste: iOS zeigt es als Auswahlrad,
        // es funktioniert offline und ohne Tastatur. Die <optgroup> sind noetig,
        // weil manche Felder lang werden – "Brust + Rücken" bietet ueber 60.
        const aktuell = (freeEx ? entry.names[xi] : names[xi]) || '';
        const nameIn = document.createElement('select');
        nameIn.className = 'exname';
        nameIn.disabled = readOnly;

        const leerOpt = document.createElement('option');
        leerOpt.value = ''; leerOpt.textContent = 'Übung wählen…';
        nameIn.appendChild(leerOpt);

        // Zuletzt Benutztes nach oben – nur bei Pump und Cluster, denn nur die
        // rotieren frei. Heavy behaelt seine Uebung ohnehin ueber die Rotation.
        const zuletzt = freeEx ? recentNames(baseMR ? 'mr' : 'pump', blk.id).map((r) => r.n) : [];
        // Feld schlaegt Block: Bei "Brust + Rücken" bietet das erste Feld nur
        // Brust an, das zweite nur Rücken – statt beide Male alles.
        auswahlGruppen(exDef.konten || blk.konten, exDef.r || null, zuletzt).forEach((g) => {
          const og = document.createElement('optgroup'); og.label = g.label;
          g.eintraege.forEach((e) => {
            const o = document.createElement('option'); o.value = e.n; o.textContent = e.n;
            og.appendChild(o);
          });
          nameIn.appendChild(og);
        });

        // Ein Name aus einem alten Log, den der Katalog nicht (mehr) kennt:
        // sichtbar lassen und als solchen kennzeichnen, statt ihn stumm zu
        // verschlucken. Streicht jemand eine Zeile aus der Excel, wuerde sonst
        // rueckwirkend die Beschriftung schon geloggter Saetze verschwinden.
        if (aktuell && !imKatalog(aktuell)) {
          const og = document.createElement('optgroup'); og.label = 'Nicht im Katalog';
          const o = document.createElement('option'); o.value = aktuell; o.textContent = aktuell;
          og.appendChild(o); nameIn.appendChild(og);
        }
        nameIn.value = aktuell;
        const tonAnpassen = () => nameIn.classList.toggle('leer', !nameIn.value);
        tonAnpassen();
        hd.appendChild(nameIn); exDiv.appendChild(hd);

        const prevLine = document.createElement('div'); prevLine.className = 'prev';
        // Anzahl Sätze: Pump-Paare sind Supersets und Cluster-Felder eigenständig -> jede Übung
        // bekommt die volle Zahl. Nur Heavy wird im Wechsel auf Comp/Iso aufgeteilt.
        const geplant = freeEx ? targetSets(blk, tier) : setsForExercise(blk, tier, xi);
        const prioDelta = prio.delta[slotKey(state.day, blk.id, xi)] || 0;
        const count = Math.max(0, geplant + prioDelta);
        if (prioDelta) {
          const vc = document.createElement('span');
          vc.className = 'volrolle ' + (prioDelta > 0 ? 'prio' : 'minus');
          vc.textContent = prioDelta > 0 ? 'Priorität +1' : 'Umverteilung −1';
          hd.appendChild(vc);
        }
        entry.sets[xi] = entry.sets[xi] || [];
        while (entry.sets[xi].length < count) entry.sets[xi].push({ w: '', r: '', rir: '' });

        const memKind = baseMR ? 'mr' : 'pump';
        if (!readOnly) nameIn.onchange = () => {
          if (freeEx) { entry.names[xi] = nameIn.value; renderMem(prevLine, entry.names[xi], memKind); }
          else { names[xi] = nameIn.value; }
          tonAnpassen();
          queuePersist();
          // Eine Pump-Wahl kann eine gespeicherte Prioritaet oder deren Spender
          // aktivieren/deaktivieren. Die Satzzahl muss deshalb sofort neu
          // berechnet werden, nicht erst beim naechsten Seitenwechsel.
          if (freeEx) renderDay();
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

    // Nach den sechs Belastungswochen bewusst entscheiden: direkt eine neue
    // Phase beginnen oder eine Woche deloaden. Im Deload bleibt nur noch der
    // Weg in die neue Phase.
    phaseResetEl.innerHTML = '';
    if (!readOnly && state.week >= 6) {
      const box = document.createElement('div');
      box.className = 'phase-ende';
      box.innerHTML = `<p>${state.week === 6 ? '6 Wochen abgeschlossen. Wie geht es weiter?' : 'Deload abgeschlossen.'}</p>
        <div class="phase-ende-aktionen">
          <button class="phase-reset" data-phase-neu>↻ Weitertrainieren · neue Phase</button>
          ${state.week === 6 ? '<button class="phase-reset phase-deload" data-phase-deload>1 Woche Deload</button>' : ''}
        </div>`;
      box.querySelector('[data-phase-neu]').onclick = resetAllData;
      box.querySelector('[data-phase-deload]')?.addEventListener('click', startDeload);
      phaseResetEl.appendChild(box);
    }
  }

  function startDeload() {
    state.week = 7;
    state.day = 'MRs';
    queuePersist();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'instant' });
    toast('Deload · 1 Woche');
  }

  async function resetAllData() {
    if (!confirm('ALLE eingetragenen Daten löschen (Übungen, Gewichte, Wdh, RIR, Notizen)?\n\nDanach startest du mit komplett leeren Feldern in eine neue Phase.\n\nDein Pump- und Cluster-Übungspool bleibt erhalten: Trägst du eine Übung wieder ein, siehst du weiterhin, was du zuletzt geschafft hast.')) return;
    // Pool retten, bevor die Wochendaten fallen. Neuere Werte gewinnen.
    state.mem = Object.assign({}, state.mem, harvestMem(state.data));
    state.data = {}; state.ex = {}; state.notes = {}; state.tier = {}; state.rot = {}; state.datum = {}; state.volumen = {};
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
    const prio = prioritaetsAnpassungen(payloadOut(), state.week);
    tpl.blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier);
      if (tgt === 0) return;
      const entry = cell[blk.id];
      let sets = 0;
      let blockTgt = 0;
      exOf(blk, tier).forEach((_, xi) => {
        const basis = blk.type === 'load' ? setsForExercise(blk, tier, xi) : targetSets(blk, tier);
        const cnt = Math.max(0, basis + (prio.delta[slotKey(state.day, blk.id, xi)] || 0));
        blockTgt += cnt;
        const arr = (entry && entry.sets && entry.sets[xi]) || [];
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) sets++; });
      });
      total += sets; tgtTotal += blockTgt;
    });

    // Nur noch Kopf und Gesamtzahl. Die Muskelzeilen mit Balken standen frueher
    // hier – sie wiederholten aber lediglich das "Sätze N" aus jedem Blockkopf,
    // ein paar Zentimeter weiter oben. Doppelt gefuehrt, nie benutzt.
    volEl.innerHTML = '<h3>Volumen · Level ' + TIER_NAMES[tier] + '</h3>' +
      '<div class="voltot">' + total + ' <span>/ ' + tgtTotal + ' ARBEITSSÄTZE</span></div>';

    contentEl.querySelectorAll('.target[data-tgt]').forEach((el) => {
      const blk = tpl.blocks.find((b) => b.id === el.dataset.tgt); if (!blk) return;
      const entry = cell[blk.id]; let sets = 0;
      const tgt = targetSets(blk, tier);
      let blockTgt = 0;
      exOf(blk, tier).forEach((_, xi) => {
        const basis = blk.type === 'load' ? setsForExercise(blk, tier, xi) : targetSets(blk, tier);
        const cnt = Math.max(0, basis + (prio.delta[slotKey(state.day, blk.id, xi)] || 0));
        blockTgt += cnt;
        const arr = (entry && entry.sets && entry.sets[xi]) || [];
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) sets++; });
      });
      el.classList.toggle('met', blockTgt > 0 && sets >= blockTgt);
      el.innerHTML = 'Sätze <b>' + tgt + '</b>';
    });
  }
  // Das Set-O-Meter haengt mit dran: Jeder eingetragene Satz aendert es, und ein
  // Konto, das erst beim naechsten Wochenwechsel nachzieht, waere schlimmer als
  // keins – man wuerde ihm glauben.
  function refreshVolume() {
    renderVolume(ensureCell(), TPL[state.day], tierOf(state.day, state.week));
  }

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
  async function alertDone() {
    try { navigator.vibrate?.([180, 90, 180]); } catch (e) { /* egal */ }
    if (!audioCtx) return;
    // iOS legt den AudioContext still, sobald die App kurz in den Hintergrund
    // geht oder der Bildschirm zugeht – der Zustand heisst dann "suspended"
    // oder "interrupted". Vorher stieg die Funktion hier einfach aus, und der
    // Ton blieb fuer den Rest der Einheit weg, auch wenn die App wieder vorne
    // war. Jetzt wird er stattdessen geweckt.
    if (audioCtx.state !== 'running') {
      try { await audioCtx.resume(); } catch (e) { return; }
      if (audioCtx.state !== 'running') return;
    }
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
    if (readOnly) return;
    primeAudio();
    pushTimer('start', sec, label);
    clearInterval(timerId);
    tEnd = Date.now() + sec * 1000;
    const box = document.querySelector('#app-timer'); box.hidden = false; box.classList.remove('done');
    // Die ganze Leiste wird zur Uhr. Waehrend der Pause waehlt man ohnehin
    // nichts aus – und wenn doch, bricht der Timer ab. Also darf der Platz
    // solange ihm gehoeren, statt sich mit fuenf Feldern zu draengeln.
    document.querySelector('.ctrlbar').classList.add('timer-an');
    tick();
    timerId = setInterval(tick, 250);
  }
  function tick() {
    const box = document.querySelector('#app-timer'); if (!box) return;
    const left = Math.max(0, Math.round((tEnd - Date.now()) / 1000));
    box.querySelector('#app-timertxt').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    if (left <= 0) {
      clearInterval(timerId);
      box.classList.add('done');
      alertDone();
      setTimeout(() => { box.hidden = true; document.querySelector('.ctrlbar')?.classList.remove('timer-an'); }, 4000);
    }
  }


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

  // Set-O-Meter und Timer-Abbruch haengen an der Steuerleiste, die weiter oben
  // gebaut wird. Der Knopf "Einheit speichern" ist ersatzlos entfallen: Die App
  // speichert nach jeder Eingabe von selbst, und ob das geklappt hat, sagt der
  // Sync-Punkt in der Kopfleiste. Ein Knopf, der nur das ausloest, was ohnehin
  // laeuft, verspricht eine Notwendigkeit, die es nicht gibt.
  document.querySelector('#app-timerx').onclick = () => {
    clearInterval(timerId);
    document.querySelector('#app-timer').hidden = true;
    document.querySelector('.ctrlbar').classList.remove('timer-an');
    // Auch den schlafenden Auftrag abbestellen, sonst meldet er sich spaeter
    // fuer eine Pause, die du abgebrochen hast.
    pushTimer('stop');
  };

  return {
    destroy() {
      clearTimeout(saveTimer);
      clearInterval(timerId);
      clearInterval(retryId);
      window.removeEventListener('online', retrySync);
      // Die Felder bleiben sichtbar, damit die Leiste auf jeder Seite gleich
      // aussieht – aber sie sind ohne Log wirkungslos und werden stillgelegt.
      const slots = document.querySelector('#app-slots');
      if (slots) slots.querySelectorAll('select,input').forEach((el) => { el.disabled = true; });
      const t = document.querySelector('#app-timer');
      if (t) t.hidden = true;
      document.querySelector('.ctrlbar')?.classList.remove('timer-an');
      // Der Phasen-Chip gehoert dem Log – ausserhalb gibt es keine Phase.
      const ph = document.querySelector('#app-phase');
      if (ph) ph.hidden = true;
      // Der Punkt gehoert dem Log – ausserhalb gibt es nichts zu synchronisieren.
      if (saveStateEl) saveStateEl.hidden = true;
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
