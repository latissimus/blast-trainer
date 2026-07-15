import { supabase } from './supabase.js';
import { TPL, LEGACY, TIER_NAMES } from './template.js';

/* ------------------------------------------------------------------
   Mount the BLAST log (v2: Tiers, A/B-Wochen, Rollen, Pausen-Timer)
   into `container`.
     userId    – whose training_logs row to load
     readOnly  – true for the admin viewing a customer (no editing/saving)
   Returns { destroy } to remove the sticky save bar / sheet on nav.
   ------------------------------------------------------------------ */
export async function mountLog(container, { userId, readOnly = false }) {
  const { data, error } = await supabase
    .from('training_logs')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  const p = data?.payload || {};
  const state = {
    week: p.week || 1,
    day: TPL[p.day] ? p.day : 'OK-A',
    data: migrate(p.data || {}),
    tier: p.tier || {},
    rot: p.rot || {},
  };

  let saveTimer = null;
  let saveStateEl = null;
  let saveBar = null;
  let sheet = null;
  let timerId = null;

  // ---- persistence -------------------------------------------------
  function setStatus(t, ok) {
    if (saveStateEl) { saveStateEl.textContent = t; saveStateEl.className = 'save-state' + (ok ? ' ok' : ''); }
  }
  function payloadOut() {
    return { data: state.data, week: state.week, day: state.day, tier: state.tier, rot: state.rot, v: 2 };
  }
  async function persist() {
    if (readOnly) return true;
    setStatus('speichere…');
    const { error: e } = await supabase.from('training_logs').upsert(
      { user_id: userId, payload: payloadOut(), updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
    if (e) { setStatus('Fehler – nicht gespeichert'); return false; }
    setStatus('gespeichert', true);
    return true;
  }
  function queuePersist() {
    if (readOnly) return;
    setStatus('…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 700);
  }

  // ---- migration v1 (index) -> v2 (id) -----------------------------
  function migrate(d) {
    Object.keys(d).forEach((day) => {
      const map = LEGACY[day]; if (!map) return;
      Object.keys(d[day] || {}).forEach((wk) => {
        const cell = d[day][wk]; if (!cell) return;
        Object.keys(cell).forEach((k) => {
          if (/^\d+$/.test(k)) {
            const id = map[Number(k)];
            if (id && !cell[id]) cell[id] = cell[k];
            delete cell[k];
          }
        });
      });
    });
    return d;
  }

  // ---- structure helpers -------------------------------------------
  const rotOf = (week) => state.rot[week] || (week % 2 === 1 ? 'A' : 'B');
  const daysOfWeek = (week) => { const r = rotOf(week); return ['OK-' + r, 'UK-' + r, 'MRs']; };
  const tierOf = (day, week) => { const t = state.tier[day + '|' + week]; return (t === 0 || t === 1 || t === 2) ? t : 2; };
  const setTier = (day, week, t) => { state.tier[day + '|' + week] = t; };
  function targetSets(blk, tier) {
    const [mn, mx] = blk.sets;
    if (tier === 0) return mn;
    if (tier === 2) return mx;
    return Math.round((mn + mx) / 2);
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
    <div class="log-top">
      <button class="ibtn" id="lg-info" aria-label="Prinzipien">?</button>
      ${readOnly ? '' : '<span class="save-state" id="lg-save">gespeichert</span>'}
    </div>
    <div class="blastbar">
      <div class="wk">
        <button id="lg-wkdn" aria-label="Woche runter">–</button>
        <span class="num" id="lg-wknum">Wo 1</span>
        <button id="lg-wkup" aria-label="Woche hoch">+</button>
      </div>
      <button class="rotchip" id="lg-rot">A-Woche</button>
      <span class="cruise" id="lg-cruise" hidden>Cruise fällig</span>
    </div>
    <div class="tabs" id="lg-tabs"></div>
    <div class="tierbar">
      <span class="lbl">Tier</span>
      <div class="seg" id="lg-tier">
        <button data-t="0">I</button><button data-t="1">II</button><button data-t="2">III</button>
      </div>
      <span class="tierhint" id="lg-tierhint"></span>
    </div>
    <div class="daymeta" id="lg-daymeta"></div>
    <div id="lg-content"></div>
    <div class="volbar" id="lg-vol"></div>`;
  container.appendChild(wrap);

  saveStateEl = wrap.querySelector('#lg-save');
  const tabsEl = wrap.querySelector('#lg-tabs');
  const contentEl = wrap.querySelector('#lg-content');
  const volEl = wrap.querySelector('#lg-vol');
  const dayMetaEl = wrap.querySelector('#lg-daymeta');
  const wkNumEl = wrap.querySelector('#lg-wknum');
  const rotEl = wrap.querySelector('#lg-rot');
  const cruiseEl = wrap.querySelector('#lg-cruise');
  const tierSeg = wrap.querySelector('#lg-tier');
  const tierHintEl = wrap.querySelector('#lg-tierhint');

  wrap.querySelector('#lg-wkup').onclick = () => { state.week++; queuePersist(); renderAll(); };
  wrap.querySelector('#lg-wkdn').onclick = () => { if (state.week > 1) { state.week--; queuePersist(); renderAll(); } };
  rotEl.onclick = () => {
    state.rot[state.week] = rotOf(state.week) === 'A' ? 'B' : 'A';
    const days = daysOfWeek(state.week);
    if (!days.includes(state.day)) state.day = days[0];
    queuePersist(); renderAll();
    toast('Woche ' + state.week + ' ist jetzt ' + rotOf(state.week) + '-Woche');
  };
  tierSeg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { setTier(state.day, state.week, Number(b.dataset.t)); queuePersist(); renderAll(); };
  });
  wrap.querySelector('#lg-info').onclick = openSheet;

  // ---- render ------------------------------------------------------
  function renderHeader() {
    wkNumEl.textContent = 'Wo ' + state.week;
    rotEl.textContent = rotOf(state.week) + '-Woche';
    cruiseEl.hidden = state.week < 6;

    tabsEl.innerHTML = '';
    const days = daysOfWeek(state.week);
    if (!days.includes(state.day)) state.day = days[0];
    days.forEach((d) => {
      const tpl = TPL[d];
      const b = document.createElement('button');
      b.className = 'tab' + (d === state.day ? ' active' : '');
      b.innerHTML = `<span>${tpl.label}</span><span class="t2">${tpl.short}</span>`;
      if (dayHasData(d, state.week)) { const dot = document.createElement('span'); dot.className = 'dot'; b.appendChild(dot); }
      b.onclick = () => { state.day = d; queuePersist(); renderAll(); window.scrollTo({ top: 0, behavior: 'instant' }); };
      tabsEl.appendChild(b);
    });

    const tier = tierOf(state.day, state.week);
    tierSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.t) === tier));
    const tot = TPL[state.day].blocks.reduce((a, b) => a + targetSets(b, tier), 0);
    tierHintEl.textContent = tier === 0 ? 'wenig Volumen · schlechter Tag · ' + tot + ' Sätze'
      : tier === 1 ? 'mittleres Volumen · ' + tot + ' Sätze'
      : 'volles Volumen · guter Tag · ' + tot + ' Sätze';
  }

  function renderPrev(node, prevSets, todaySets, pWeek) {
    if (!prevSets || !prevSets.some((s) => s && (s.w || s.r))) { node.innerHTML = '<b>letztes Mal: —</b>'; return; }
    const txt = prevSets.filter((s) => s && (s.w || s.r)).map((s) => `${s.w || '–'}×${s.r || '–'}`).join(', ');
    let chip = '';
    const pe = bestE1(prevSets), te = bestE1(todaySets);
    if (te > 0 && pe > 0) {
      const diff = te - pe;
      if (diff > 0.4) chip = `<span class="delta d-up">▲ +${fmt(diff)}</span>`;
      else if (diff < -0.4) chip = `<span class="delta d-down">▼ ${fmt(diff)}</span>`;
      else chip = `<span class="delta d-hold">= gehalten</span>`;
    }
    node.innerHTML = `<b>Wo ${pWeek}: ${txt}</b>${chip}`;
  }

  function setRow(entry, xi, si, blk, prevLine, prevSets, prev) {
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
      const del = document.createElement('button'); del.className = 'delrow'; del.innerHTML = '×';
      del.onclick = () => {
        entry.sets[xi].splice(si, 1);
        if (entry.sets[xi].length === 0) entry.sets[xi].push({ w: '', r: '', rir: '' });
        queuePersist(); renderDay();
      };
      row.appendChild(del);

      const upd = () => {
        s.w = wIn.value; s.r = rIn.value;
        renderPrev(prevLine, prevSets, entry.sets[xi], prev ? prev.week : null);
        refreshVolume(); queuePersist();
      };
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

    tpl.blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier);
      if (!cell[blk.id]) {
        const per = Math.max(1, Math.ceil(Math.max(tgt, 1) / blk.ex.length));
        cell[blk.id] = { ex: blk.ex.map((e) => e.n), sets: blk.ex.map(() => Array.from({ length: per }, () => ({ w: '', r: '', rir: '' }))) };
      }
      const entry = cell[blk.id];

      const el = document.createElement('div'); el.className = 'block' + (blk.opt ? ' opt' : '');
      const cues = [];
      if (blk.type === 'load') cues.push('<span class="chip">' + blk.reps + ' · 0–2 RIR</span>', '<span class="chip">Versagen nur letzter Comp</span>');
      if (blk.type === 'pump') cues.push('<span class="chip">' + blk.reps + ' · leicht</span>', '<span class="chip">bis metab. Versagen + Teilwdh.</span>');
      if (blk.type === 'mr') cues.push('<span class="chip">6×4 · ~15RM</span>', '<span class="chip">Versagen nur letzter Minisatz</span>');
      if (blk.stretch) cues.push('<span class="chip stretch">↕ gedehnte Position</span>');
      cues.push('<button class="chip rest"' + (readOnly ? ' disabled' : '') + ' data-rest="' + blk.rest + '">⏱ ' + (blk.rest >= 60 ? (blk.rest / 60) + ' min' : blk.rest + ' s') + '</button>');

      el.innerHTML = `
        <div class="bhead">
          <span class="mus">${blk.mus}</span>
          <span class="badge b-${blk.type}">${blk.type === 'mr' ? 'MR' : blk.type}</span>
          <span class="target" data-tgt="${blk.id}">Ziel <b>${tgt}</b></span>
        </div>
        <div class="cue">${cues.join('')}</div>`;
      if (!readOnly) el.querySelectorAll('.chip.rest').forEach((b) => (b.onclick = () => startTimer(Number(b.dataset.rest))));

      blk.ex.forEach((exDef, xi) => {
        const exDiv = document.createElement('div'); exDiv.className = 'ex';

        const hd = document.createElement('div'); hd.className = 'exhead';
        if (exDef.r) { const rl = document.createElement('span'); rl.className = 'role' + (exDef.r === 'Comp' ? ' comp' : ''); rl.textContent = exDef.r; hd.appendChild(rl); }
        const nameIn = document.createElement('input');
        nameIn.className = 'exname'; nameIn.value = entry.ex[xi] || ''; nameIn.placeholder = blk.free ? 'Übung wählen…' : 'Übung';
        nameIn.disabled = readOnly;
        if (!readOnly) nameIn.oninput = () => { entry.ex[xi] = nameIn.value; queuePersist(); };
        hd.appendChild(nameIn); exDiv.appendChild(hd);

        const prevLine = document.createElement('div'); prevLine.className = 'prev';
        const prevSets = (prev && prev.data[blk.id] && prev.data[blk.id].sets && prev.data[blk.id].sets[xi]) ? prev.data[blk.id].sets[xi] : null;
        entry.sets[xi] = entry.sets[xi] || [{ w: '', r: '', rir: '' }];
        renderPrev(prevLine, prevSets, entry.sets[xi], prev ? prev.week : null);
        exDiv.appendChild(prevLine);

        entry.sets[xi].forEach((_, si) => exDiv.appendChild(setRow(entry, xi, si, blk, prevLine, prevSets, prev)));

        if (!readOnly) {
          const add = document.createElement('button'); add.className = 'addset'; add.textContent = '+ Satz';
          add.onclick = () => { entry.sets[xi].push({ w: '', r: '', rir: '' }); queuePersist(); renderDay(); };
          exDiv.appendChild(add);
        }
        el.appendChild(exDiv);
      });
      contentEl.appendChild(el);
    });
    renderVolume(cell, tpl, tier);
  }

  function renderVolume(cell, tpl, tier) {
    let total = 0, tgtTotal = 0;
    const rows = tpl.blocks.map((blk) => {
      const entry = cell[blk.id]; if (!entry) return null;
      let sets = 0;
      (entry.sets || []).forEach((arr) => (arr || []).forEach((s) => { if (s && (s.w || s.r)) sets++; }));
      const tgt = targetSets(blk, tier);
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
      ((entry && entry.sets) || []).forEach((arr) => (arr || []).forEach((s) => { if (s && (s.w || s.r)) sets++; }));
      const tgt = targetSets(blk, tier);
      el.classList.toggle('met', tgt > 0 && sets >= tgt);
      el.innerHTML = 'Ziel <b>' + tgt + '</b>';
    });
  }
  function refreshVolume() { renderVolume(ensureCell(), TPL[state.day], tierOf(state.day, state.week)); }

  function renderAll() { renderHeader(); renderDay(); }
  renderAll();

  // ---- pause timer (editable only) ---------------------------------
  let tEnd = 0;
  function startTimer(sec) {
    if (!saveBar) return;
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
      if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
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
        <div class="sheet-hd"><h2>PRINZIPIEN</h2><button class="sp-x" id="lg-sheetx" aria-label="schließen">×</button></div>
        <h4 class="g">Rangfolge</h4>
        <p><b>1. Progressive Überlastung</b> — mehr Last oder mehr Wdh. gegenüber dem letzten Mal. Steht als Delta über jeder Übung.</p>
        <p><b>2. Nähe zum Versagen</b> — 0–3 RIR. Der Reizauslöser pro Satz.</p>
        <p><b>3. Erholung</b> — Schlaf, Protein, Stress. Das Fundament.</p>
        <p>Volumen ist der Dosis-Regler (~10–20 Sätze/Muskel/Woche). Frequenz verteilt nur — 2–3×/Muskel. Kater ist kein Maß.</p>
        <h4>Loading</h4>
        <p>6–12 Wdh., 0–2 RIR. Zig-Zag: <b>Comp → Iso → Comp → Iso</b>. Versagen nur im <b>letzten Comp-Satz</b>; Iso-Sätze dürfen ans Versagen. Pause: Oberkörper 90 s, Unterkörper 120 s, Waden 90 s.</p>
        <h4 class="p">Pump</h4>
        <p>12–25 Wdh., leichte Last (~50 % 1RM), Pause 60 s, im Supersatz gekoppelt. Bis zum <b>metabolischen Versagen</b>, dann Teilwiederholungen im gedehnten Bereich. Übungen frei rotieren.</p>
        <h4 class="m">Muscle Rounds</h4>
        <p>6 Minisätze à 4 Wdh., ~10 s Pause, 5–10 min pro Round. Gewicht ≈ 15RM. <b>Nur ein Versagenspunkt</b>, im letzten Minisatz.</p>
        <h4 class="g">Tiers (Autoregulation)</h4>
        <p><b>Tier I</b> = wenig Sätze, schlechter Tag. <b>Tier III</b> = volles Volumen, guter Tag. Nach Tagesform wählen, nicht nach Ehrgeiz.</p>
        <h4 class="g">Progression</h4>
        <p>Doppelte Progression: erst Wdh. ans obere Ende, dann Last hoch (2,5–5 kg), Wdh. zurück. <b>2 Einheiten ohne Fortschritt</b> → Übung tauschen.</p>
        <h4 class="g">Gedehnte Position</h4>
        <p>Wo das ↕-Zeichen steht: Last in den verlängerten Bereich bringen, volle ROM oder Teilwdh. im gedehnten Bereich.</p>
        <h4 class="g">Blast / Cruise</h4>
        <p>Blast 3–6 Wochen progressiv (Tier steigend), dann Cruise ≈ 1/3 der Blast-Dauer: Volumen und Frequenz runter, nur Muscle Rounds.</p>
        <p class="src">Struktur: Fortitude Training, Scott Stevenson. Evidenz: Pelland et al. 2025 · Baz-Valle et al. 2022 · Schoenfeld et al. 2021 · Wolf/Schoenfeld 2025.</p>
      </div>`;
    document.body.appendChild(sheet);
    sheet.querySelector('#lg-sheetx').onclick = () => { sheet.hidden = true; };
    sheet.onclick = (e) => { if (e.target === sheet) sheet.hidden = true; };
  }
  buildSheet();

  // ---- sticky save bar (editable only) -----------------------------
  if (!readOnly) {
    saveBar = document.createElement('div');
    saveBar.className = 'savebar';
    saveBar.innerHTML = `
      <div class="inner">
        <button class="btn btn-primary" id="lg-savebtn">Einheit speichern</button>
        <div class="timer" id="lg-timer" hidden><span id="lg-timertxt">0:00</span><button class="x" id="lg-timerx" aria-label="Timer abbrechen">×</button></div>
        <button class="btn btn-navy btn-ghost" id="lg-reset" title="Diese Einheit leeren">⌫</button>
      </div>`;
    document.body.appendChild(saveBar);
    saveBar.querySelector('#lg-savebtn').onclick = async () => {
      clearTimeout(saveTimer);
      const ok = await persist();
      if (ok) toast('Wo ' + state.week + ' · ' + state.day + ' gespeichert');
    };
    saveBar.querySelector('#lg-timerx').onclick = () => { clearInterval(timerId); saveBar.querySelector('#lg-timer').hidden = true; };
    saveBar.querySelector('#lg-reset').onclick = () => {
      if (!confirm('Diese Einheit (' + state.day + ', Woche ' + state.week + ') leeren?')) return;
      if (state.data[state.day]) delete state.data[state.day][state.week];
      queuePersist(); renderAll(); toast('Einheit geleert');
    };
  }

  return {
    destroy() {
      clearTimeout(saveTimer);
      clearInterval(timerId);
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
