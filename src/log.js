import { supabase } from './supabase.js';
import { TPL, DAYS } from './template.js';

/* ------------------------------------------------------------------
   Mount the BLAST log into `container`.
   opts:
     userId    – whose training_logs row to load
     readOnly  – true for the admin viewing a customer (no editing/saving)
   Returns { destroy } to clean up the sticky save bar on navigation.
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
    day: DAYS.includes(p.day) ? p.day : DAYS[0],
    data: p.data || {},
  };

  let saveTimer = null;
  let saveStateEl = null;
  let saveBar = null;

  // ---- persistence ----
  function setStatus(t, ok) {
    if (saveStateEl) { saveStateEl.textContent = t; saveStateEl.className = 'save-state' + (ok ? ' ok' : ''); }
  }
  async function persist() {
    if (readOnly) return true;
    setStatus('speichere…');
    const { error: e } = await supabase.from('training_logs').upsert(
      { user_id: userId, payload: { data: state.data, week: state.week, day: state.day }, updated_at: new Date().toISOString() },
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

  // ---- data helpers ----
  function ensureCell() {
    state.data[state.day] = state.data[state.day] || {};
    state.data[state.day][state.week] = state.data[state.day][state.week] || {};
    return state.data[state.day][state.week];
  }
  function prevFilled(day, week) {
    const d = state.data[day] || {};
    const ws = Object.keys(d).map(Number).filter((w) => w < week && cellHasData(d[w])).sort((a, b) => b - a);
    return ws.length ? { week: ws[0], data: d[ws[0]] } : null;
  }
  function cellHasData(cell) {
    if (!cell) return false;
    return Object.values(cell).some((b) => (b.sets || []).some((arr) => (arr || []).some((s) => s && (s.w || s.r))));
  }
  const e1rm = (w, r) => { w = parseFloat(w); r = parseFloat(r); if (!w || !r) return 0; return w * (1 + r / 30); };
  const bestE1 = (arr) => { let m = 0; (arr || []).forEach((s) => { if (s) { const e = e1rm(s.w, s.r); if (e > m) m = e; } }); return m; };
  const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

  // ---- DOM scaffold ----
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="subhead">
      <span class="thesis">Schlag dein letztes Mal ★</span>
      ${readOnly ? '' : '<span class="save-state" id="lg-save">gespeichert</span>'}
    </div>
    <div class="weekbar">
      <span class="lbl">Woche</span>
      <div class="wk">
        <button id="lg-wkdn" aria-label="Woche runter">–</button>
        <span class="num" id="lg-wknum">1</span>
        <button id="lg-wkup" aria-label="Woche hoch">+</button>
      </div>
    </div>
    <div class="tabs" id="lg-tabs"></div>
    <div class="daymeta" id="lg-daymeta"></div>
    <div id="lg-content"></div>
    <div class="volbar" id="lg-vol"></div>
    <p class="foot">
      Load = 6–12 Wdh · 0–2 RIR · nur letzter Comp-Satz ans Versagen<br>
      Pump = 12–25 · bis metabolisches Versagen + Teilwdh. im gedehnten Bereich<br>
      MR = 6×4 · ~15RM · nur letzter Minisatz · Steigern = Log schlagen
    </p>`;
  container.appendChild(wrap);
  saveStateEl = wrap.querySelector('#lg-save');
  const tabsEl = wrap.querySelector('#lg-tabs');
  const contentEl = wrap.querySelector('#lg-content');
  const volEl = wrap.querySelector('#lg-vol');
  const dayMetaEl = wrap.querySelector('#lg-daymeta');
  const wkNumEl = wrap.querySelector('#lg-wknum');

  wrap.querySelector('#lg-wkup').onclick = () => { state.week++; queuePersist(); renderAll(); };
  wrap.querySelector('#lg-wkdn').onclick = () => { if (state.week > 1) { state.week--; queuePersist(); renderAll(); } };

  // ---- render ----
  function renderTabs() {
    tabsEl.innerHTML = '';
    DAYS.forEach((d) => {
      const b = document.createElement('button');
      b.className = 'tab' + (d === state.day ? ' active' : '');
      b.textContent = d;
      b.onclick = () => { state.day = d; queuePersist(); renderAll(); window.scrollTo(0, 0); };
      tabsEl.appendChild(b);
    });
  }

  function renderPrev(node, prevSets, todaySets, pWeek) {
    if (!prevSets || !prevSets.some((s) => s && (s.w || s.r))) { node.innerHTML = '<b>letztes Mal: —</b>'; return; }
    const txt = prevSets.filter((s) => s && (s.w || s.r)).map((s) => `${s.w || '–'}×${s.r || '–'}`).join(', ');
    let chip = '';
    const pe = bestE1(prevSets), te = bestE1(todaySets);
    if (te > 0) {
      const diff = te - pe;
      if (diff > 0.4) chip = `<span class="delta d-up">▲ +${fmt(diff)} e1RM</span>`;
      else if (diff < -0.4) chip = `<span class="delta d-down">▼ ${fmt(diff)} e1RM</span>`;
      else chip = `<span class="delta d-hold">= gehalten</span>`;
    }
    node.innerHTML = `<b>W${pWeek}: ${txt}</b>${chip}`;
  }

  function setRow(entry, xi, si, blk, prevLine, prevSets, prev) {
    const s = entry.sets[xi][si];
    const row = document.createElement('div'); row.className = 'setrow';
    const isMR = blk.type === 'mr';

    const idx = document.createElement('span'); idx.className = 'sidx'; idx.textContent = si + 1; row.appendChild(idx);

    const grp = document.createElement('div'); grp.className = 'fieldgrp';

    const wF = document.createElement('div'); wF.className = 'fld';
    const wIn = document.createElement('input'); wIn.type = 'text'; wIn.inputMode = 'decimal'; wIn.value = s.w || '';
    wIn.placeholder = 'kg'; wIn.disabled = readOnly; wF.appendChild(wIn);
    const wU = document.createElement('span'); wU.className = 'u'; wU.textContent = 'kg'; wF.appendChild(wU);

    const times = document.createElement('span'); times.className = 'times'; times.textContent = '×';

    const rF = document.createElement('div'); rF.className = 'fld';
    const rIn = document.createElement('input'); rIn.type = 'text'; rIn.inputMode = 'numeric'; rIn.value = s.r || '';
    rIn.placeholder = isMR ? '4' : 'Wdh'; rIn.disabled = readOnly; rF.appendChild(rIn);

    grp.appendChild(wF); grp.appendChild(times); grp.appendChild(rF);
    row.appendChild(grp);

    if (blk.type === 'load') {
      const rirF = document.createElement('div'); rirF.className = 'fld rir';
      const rirIn = document.createElement('input'); rirIn.type = 'text'; rirIn.inputMode = 'numeric'; rirIn.value = s.rir || '';
      rirIn.placeholder = 'RIR'; rirIn.disabled = readOnly; rirF.appendChild(rirIn);
      if (!readOnly) rirIn.oninput = () => { s.rir = rirIn.value; queuePersist(); };
      row.appendChild(rirF);
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
    dayMetaEl.textContent = tpl.sub + ' · Woche ' + state.week;
    const cell = ensureCell();
    const prev = prevFilled(state.day, state.week);
    contentEl.innerHTML = '';

    tpl.blocks.forEach((blk, bi) => {
      cell[bi] = cell[bi] || { ex: [...blk.ex], sets: blk.ex.map(() => [{ w: '', r: '', rir: '' }, { w: '', r: '', rir: '' }]) };
      const entry = cell[bi];

      const el = document.createElement('div'); el.className = 'block';
      const stretchChip = blk.stretch ? '<span class="chip stretch">↕ gedehnte Position betonen</span>' : '';
      const typeCue = blk.type === 'load' ? '<span class="chip">0–2 RIR · schwer</span>'
        : blk.type === 'pump' ? '<span class="chip">metab. Versagen + Teilwdh.</span>'
        : '<span class="chip">letzter Minisatz ans Versagen</span>';
      el.innerHTML = `
        <div class="bhead">
          <span class="mus">${blk.mus}</span>
          <span class="badge b-${blk.type}">${blk.type === 'mr' ? 'MR' : blk.type}</span>
          <span class="reprange">${blk.rr}</span>
        </div>
        <div class="cue">${typeCue}${stretchChip}</div>`;

      entry.ex.forEach((exName, xi) => {
        const exDiv = document.createElement('div'); exDiv.className = 'ex';

        const nameIn = document.createElement('input');
        nameIn.className = 'exname'; nameIn.value = exName || '';
        nameIn.placeholder = blk.free ? 'Übung wählen…' : 'Übung';
        nameIn.disabled = readOnly;
        if (!readOnly) nameIn.oninput = () => { entry.ex[xi] = nameIn.value; queuePersist(); };
        exDiv.appendChild(nameIn);

        const prevLine = document.createElement('div'); prevLine.className = 'prev';
        let prevSets = null;
        if (prev && prev.data[bi] && prev.data[bi].sets[xi]) prevSets = prev.data[bi].sets[xi];
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
    renderVolume(cell, tpl);
  }

  function renderVolume(cell, tpl) {
    const rows = tpl.blocks.map((blk, bi) => {
      const entry = cell[bi]; if (!entry) return null;
      let sets = 0;
      entry.sets.forEach((arr) => arr.forEach((s) => { if (s && (s.w || s.r)) sets++; }));
      return { mus: blk.mus, sets };
    }).filter(Boolean);
    const total = rows.reduce((a, r) => a + r.sets, 0);
    volEl.innerHTML = '<h3>Volumen diese Einheit · ' + total + ' Arbeitssätze</h3>' +
      rows.map((r) => `<div class="volrow"><span class="m">${r.mus}</span><span class="v"><b>${r.sets}</b> Sätze</span></div>`).join('');
  }
  function refreshVolume() { renderVolume(ensureCell(), TPL[state.day]); }

  function renderAll() { renderTabs(); wkNumEl.textContent = state.week; renderDay(); }
  renderAll();

  // ---- sticky save bar (editable only) ----
  if (!readOnly) {
    saveBar = document.createElement('div');
    saveBar.className = 'savebar';
    saveBar.innerHTML = `
      <div class="inner">
        <button class="btn btn-primary" id="lg-savebtn">Einheit speichern</button>
        <button class="btn btn-navy btn-ghost" id="lg-reset" title="Diese Einheit leeren">⌫</button>
      </div>`;
    document.body.appendChild(saveBar);
    saveBar.querySelector('#lg-savebtn').onclick = async () => {
      clearTimeout(saveTimer);
      const ok = await persist();
      if (ok) toast('Woche ' + state.week + ' · ' + state.day + ' gespeichert');
    };
    saveBar.querySelector('#lg-reset').onclick = () => {
      if (!confirm('Diese Einheit (' + state.day + ', Woche ' + state.week + ') leeren?')) return;
      if (state.data[state.day]) delete state.data[state.day][state.week];
      queuePersist(); renderDay(); toast('Einheit geleert');
    };
  }

  return {
    destroy() {
      clearTimeout(saveTimer);
      if (saveBar) saveBar.remove();
    },
  };
}

// ---- toast (shared) ----
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
