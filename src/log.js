import { supabase } from './supabase.js';
import { readLog, writeLog, mergePayload } from './localstore.js';
import { TPL, TIER_NAMES, CYCLE_TAGE, DELOAD_TAGE } from './template.js';
import { targetSets, effTypeOf, exOf, setsForExercise, extraSets } from './saetze.js';
import { memKey, harvestMem, recentNames as poolNames } from './pool.js';
import { auswahlGruppen, sucheAuswahlGruppen, imKatalog } from './auswahl.js';
import { prioritaetsAnpassungen, prioBloecke, slotKey } from './prioritaet.js';
import { startePause } from './pause.js';
import { actionTitleSvg } from './brand.js';
import { setStatusleistenOverlay } from './theme.js';

function effektivePause(blk) {
  return blk.rest || 120;
}

function pausenLabel(sekunden) {
  if (sekunden < 60) return sekunden + ' s';
  const minuten = sekunden / 60;
  return minuten + ' min';
}

// Anzeige-Labels der Set-Typen. Die internen Keys (load/pump/mr) bleiben, damit
// gespeicherte Logs gueltig bleiben – nur die Beschriftung wechselt.
const TYPE_LABEL = { load: 'HEAVYS', pump: 'PUMPS', mr: 'CLUSTERS' };
const LEVEL_LABEL = ['Kompakt', 'Standard', 'Selektiv'];
const TUTORIAL_SETUP = [
  { week: 1, day: 'OK-H', titel: 'OK HEAVYS', folgt: 'UK HEAVYS' },
  { week: 1, day: 'UK-H', titel: 'UK HEAVYS', folgt: 'Satzeingabe' },
];

/* ------------------------------------------------------------------
   Mount the LOGMAN log (v4: Cycles, rollierender OK/UK-Split, Pausen-Timer)
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
  const hatInhalt = (wert) => !!(wert && Object.keys(wert).length);
  const lokalesAltschema = hatInhalt(local?.payload) && local.payload.v !== 4;
  const serverAltschema = hatInhalt(server) && server.v !== 4;
  const lokalesNeuschema = local?.payload?.v === 4;
  const schemaReset = !lokalesNeuschema && (lokalesAltschema || serverAltschema);
  if (serverAltschema && lokalesNeuschema) {
    // Ein bereits lokal begonnenes Cycle-Log darf nicht von einem noch nicht
    // aktualisierten v3-Serverstand gelöscht werden.
    p = local.payload;
    mergedOffline = true;
  } else if (schemaReset) {
    p = { v: 4 };
    mergedOffline = true;
  } else if (serverOk && local && local.dirty) {
    // Nach einem Phasen-Reset ersetzt der lokale Stand den Server, statt sich mit
    // ihm zu vereinigen – sonst kaemen die bewusst geloeschten Wochen zurueck.
    p = local.replace ? local.payload : mergePayload(server, local.payload);
    mergedOffline = true;
  } else if (serverOk) p = server;
  else { p = local.payload; mergedOffline = true; }
  // Schema v4 ist ein neues Trainingssystem. Alte Ganzkörper-/Wochenlogs
  // werden bewusst nicht gemischt, sondern durch diesen leeren Cycle-Stand
  // ersetzt. Der Nutzer hat dieses Löschen ausdrücklich freigegeben.
  const state = {
    // Cycles 1–7, Eintrag 8 = Deload.
    week: Math.min(8, Math.max(1, Number(p.week) || 1)),
    day: TPL[p.day] ? p.day : 'OK-H',
    data: p.data || {},
    tier: p.tier || {},
    ex: p.ex || {},      // feste HEAVYS-Namen pro Einheit über alle Cycles
    notes: p.notes || {}, // gemeinsame Notizen pro Tag/Übung
    mem: p.mem || {},    // Übungs-Pool: Name -> zuletzt geschaffte Last, ueberlebt den Phasen-Reset
    datum: p.datum || {},  // Einheit|Cycle -> ISO-Datum
    volumen: { prioritaet: p.volumen?.prioritaet || {} }, // Muskel-Prioritaeten
    meta: p.meta || {},    // phasenuebergreifende Oberflaechen-Zustaende
  };

  let saveTimer = null;
  let saveStateEl = null;

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
    return { data: state.data, week: state.week, day: state.day, tier: state.tier, ex: state.ex, notes: state.notes, mem: state.mem, datum: state.datum, volumen: state.volumen, meta: state.meta, v: 4 };
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

  // Gemeinsame Übungsnamen für einen Tag/Block (über alle Wochen geteilt).
  // Start LEER — jeder Trainee trägt seine Übungen selbst ein.
  function dayNames(day, blk) {
    const nameDay = TPL[day]?.nameSource || day;
    state.ex[nameDay] = state.ex[nameDay] || {};
    if (!state.ex[nameDay][blk.id]) state.ex[nameDay][blk.id] = blk.ex.map(() => '');
    return state.ex[nameDay][blk.id];
  }

  // Gemeinsame Notizen pro Tag/Block/Übung (über alle Wochen geteilt)
  function dayNotes(day, blk) {
    state.notes[day] = state.notes[day] || {};
    if (!state.notes[day][blk.id]) state.notes[day][blk.id] = blk.ex.map(() => '');
    return state.notes[day][blk.id];
  }

  // ---- structure helpers -------------------------------------------
  const isCruise = (cycle) => cycle >= 8;
  const daysOfWeek = (cycle) => isCruise(cycle) ? [...DELOAD_TAGE] : [...CYCLE_TAGE];
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
  const hatNutzdaten = () =>
    Object.values(state.data).some((wochen) => Object.values(wochen || {}).some(cellHasData)) ||
    Object.values(state.ex).some((bloecke) =>
      Object.values(bloecke || {}).some((namen) => (namen || []).some((n) => String(n || '').trim())));
  let einstiegSichtbar = !readOnly && !state.meta.einstiegErledigt && !hatNutzdaten();
  let tutorialAktiv = !readOnly && !!state.meta.tutorialAktiv;
  const gespeicherterTutorialSchritt = Number(state.meta.tutorialSchritt);
  let tutorialSchritt = Number.isFinite(gespeicherterTutorialSchritt)
    ? Math.min(TUTORIAL_SETUP.length, Math.max(-1, gespeicherterTutorialSchritt))
    : -1;
  let tutorialFx = null;
  let tutorialFxTimer = [];
  let tutorialLetzterBlock = null;
  let tutorialScrollAufFeld = false;

  // Aus dem FAQ kann das Tutorial auch spaeter erneut gestartet werden.
  try {
    if (!readOnly && sessionStorage.getItem('blast:tutorial-start') === '1') {
      sessionStorage.removeItem('blast:tutorial-start');
      tutorialAktiv = true;
      tutorialSchritt = -1;
      einstiegSichtbar = false;
      state.meta.tutorialAktiv = true;
      state.meta.tutorialSchritt = -1;
      state.meta.einstiegErledigt = true;
      state.week = TUTORIAL_SETUP[0].week;
      state.day = TUTORIAL_SETUP[0].day;
    }
  } catch (e) { /* sessionStorage darf den Log nicht aufhalten */ }

  // Existiert der Prioritätsmuskel bereits regulär in der Einheit, steht seine
  // kompakte Zusatzkarte direkt hinter dem letzten passenden Muskelblock.
  // Neue Muskeln wie Unterarme bleiben als eigener Slot am Ende.
  function sortierteBloecke(tpl, week, day) {
    const basis = [...tpl.blocks];
    const extras = prioBloecke(payloadOut(), week, day);
    const verwendet = new Set();
    const result = [];
    basis.forEach((blk, index) => {
      result.push(blk);
      extras.forEach((extra, extraIndex) => {
        const konto = extra.konten[0];
        const passt = (blk.konten || []).includes(konto);
        const spaeter = basis.slice(index + 1).some((b) => (b.konten || []).includes(konto));
        if (passt && !spaeter) {
          extra.angedockt = 1;
          result.push(extra);
          verwendet.add(extraIndex);
        }
      });
    });
    extras.forEach((extra, index) => {
      if (!verwendet.has(index)) result.push(extra);
    });
    return result;
  }

  // Fortschritt einer Einheit fuer den Punkt auf dem Tab. Zaehlt wie die Volumen-Leiste,
  // damit Punkt und "X / Y ARBEITSSÄTZE" nie widersprechen.
  function dayProgress(day, week) {
    const tpl = TPL[day];
    const cell = (state.data[day] || {})[week];
    if (!tpl || !cell) return { any: false, met: false };
    const tier = tierOf(day, week);
    const prio = prioritaetsAnpassungen(payloadOut(), week);
    const blocks = sortierteBloecke(tpl, week, day);
    let done = 0, tgtTotal = 0;
    blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier); if (tgt === 0) return;
      const entry = cell[blk.id];
      exOf(blk, tier).forEach((_, xi) => {
        const basis = setsForExercise(blk, tier, xi) + extraSets(entry, tier, xi);
        const cnt = Math.max(0, basis + (prio.delta[slotKey(day, blk.id, xi)] || 0));
        tgtTotal += cnt;
        const arr = (entry && entry.sets && entry.sets[xi]) || [];
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) done++; });
      });
    });
    return { any: done > 0, met: tgtTotal > 0 && done >= tgtTotal };
  }
  function lokalesDatum() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  // Nach einer vollständigen Einheit nur den nächsten Schritt anbieten.
  // Nach Cycle 7 bleibt die bewusste Wahl "neue Phase oder Deload".
  function naechsteEinheit() {
    if (!dayProgress(state.day, state.week).met) return null;
    const letzterCycle = isCruise(state.week) ? 8 : 7;
    for (let cycle = state.week; cycle <= letzterCycle; cycle++) {
      const tage = daysOfWeek(cycle);
      const start = cycle === state.week ? tage.indexOf(state.day) + 1 : 0;
      for (let i = Math.max(0, start); i < tage.length; i++) {
        if (!dayProgress(tage[i], cycle).met) {
          return { week: cycle, day: tage[i], tagNummer: i + 1 };
        }
      }
    }
    return null;
  }
  function cycleFertig(cycle) {
    return daysOfWeek(cycle).every((day) => dayProgress(day, cycle).met);
  }
  function heavyAuswahlStatus(tpl, tier) {
    const felder = [];
    tpl.blocks.filter((blk) => !blk.prio).forEach((blk) => {
      if (effTypeOf(blk, tier) !== 'load') return;
      const namen = dayNames(state.day, blk);
      exOf(blk, tier).forEach((exDef, xi) => felder.push({
        name: namen[xi] || '',
        blockId: blk.id,
        xi,
        muskel: blk.mus,
        rolle: exDef.r || '',
      }));
    });
    return {
      gesamt: felder.length,
      gewaehlt: felder.filter((f) => f.name.trim()).length,
      offen: felder.filter((f) => !f.name.trim()),
    };
  }
  function tutorialZielSetzen(schritt) {
    tutorialSchritt = schritt;
    state.meta.tutorialAktiv = true;
    state.meta.tutorialSchritt = schritt;
    tutorialAktiv = true;
    einstiegSichtbar = false;
    tutorialLetzterBlock = null;
    tutorialScrollAufFeld = false;
    setStatusleistenOverlay('tutorial', true);
    if (schritt < TUTORIAL_SETUP.length) {
      const ziel = TUTORIAL_SETUP[Math.max(0, schritt)];
      state.week = ziel.week;
      state.day = ziel.day;
      setTier(state.day, state.week, 1);
    } else {
      state.week = 1;
      state.day = 'OK-H';
    }
  }
  function tutorialSpeichernUndZeichnen() {
    queuePersist();
    renderAll();
  }
  function tutorialBeenden(abgebrochen = false) {
    tutorialAktiv = false;
    tutorialSchritt = 0;
    state.meta.tutorialAktiv = false;
    state.meta.tutorialSchritt = 0;
    state.meta.tutorialErledigt = true;
    state.meta.tutorialAbgebrochen = abgebrochen;
    state.meta.einstiegErledigt = true;
    state.week = 1;
    state.day = 'OK-H';
    einstiegSichtbar = false;
    setStatusleistenOverlay('tutorial', false);
    if (tutorialDunkel) tutorialDunkel.hidden = true;
    queuePersist();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function tutorialStartAnimation() {
    if (tutorialFx) return;
    // Die Abschlussanimation ist ein bewusst hellblauer Markenmoment. Der
    // eigentliche Tutorial-Overlayzustand endet deshalb schon beim Start der
    // Animation und nicht erst, wenn darunter der Log neu gezeichnet wird.
    setStatusleistenOverlay('tutorial', false);
    tutorialFx = document.createElement('div');
    tutorialFx.className = 'tutorial-startfx';
    tutorialFx.setAttribute('role', 'status');
    tutorialFx.setAttribute('aria-live', 'polite');
    tutorialFx.innerHTML = `
      <div class="tutorial-startfx-strahlen" aria-hidden="true"></div>
      <div class="tutorial-startfx-inhalt">
        <small>Einrichtung abgeschlossen</small>
        ${actionTitleSvg("LOS GEHT'S!")}
        <span>Du beginnst jetzt mit Cycle 1 · OK HEAVYS. Mehr Hilfe findest du im FAQ.</span>
      </div>`;
    document.body.appendChild(tutorialFx);
    requestAnimationFrame(() => tutorialFx?.classList.add('an'));
    const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Der Inhalt dahinter darf erst wechseln, wenn die Schrift verschwunden
    // ist. Die violette Flaeche deckt den Wechsel ab und faehrt danach herunter.
    tutorialFxTimer.push(setTimeout(() => tutorialBeenden(false), reduziert ? 3000 : 5650));
    tutorialFxTimer.push(setTimeout(() => {
      tutorialFx?.remove();
      tutorialFx = null;
    }, reduziert ? 3200 : 6800));
  }
  function tutorialScrollen() {
    if (!tutorialAktiv || tutorialSchritt < 0) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ziel = tutorialScrollAufFeld
        ? contentEl.querySelector('.tutorial-scrollziel')
        : contentEl.querySelector('.tutorial-aktiv');
      const karte = tutorialEbene.querySelector('.log-tutorial');
      if (!ziel || !karte) return;
      // Die Karte liegt waehrend des Tutorials bewusst ueber dem Header. Das
      // naechste Uebungsfeld richtet sich deshalb an ihrer TATSAECHLICHEN
      // Unterkante aus, nicht an Headerhoehe + geschaetzter Kartenhoehe. So
      // scrollt kein Feld vor oder sichtbar hinter die Einrichtungsbox.
      const zielOben = karte.getBoundingClientRect().bottom + 10;
      const appScroller = document.documentElement.classList.contains('overlay-scroll-gesperrt')
        ? container
        : null;
      const aktuellePosition = appScroller ? appScroller.scrollTop : window.scrollY;
      const scrollZiel = Math.max(0, aktuellePosition + ziel.getBoundingClientRect().top - zielOben);
      (appScroller || window).scrollTo({
        top: scrollZiel,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }));
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
    <div id="lg-content" class="erstblock"></div>
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

  // Ein gemeinsamer, durchsuchbarer Uebungswaehler statt bis zu 199 Eintraegen
  // im nativen Scrollrad. Der Dialog wird fuer jedes Feld wiederverwendet und
  // liegt ausserhalb der Trainingskarten, damit deren Neuzeichnen ihn nicht
  // mitten in einer Auswahl entfernt.
  //
  // BEWUSST KEIN <dialog> MEHR. Ein modal geoeffneter Dialog liegt in der
  // Top-Layer, und dort endete die Abdunkelung auf dem installierten iPhone
  // oberhalb der Safe-Area: Der Streifen unter Uhrzeit und Akku blieb hellblau.
  // Weder ::backdrop noch ein zusaetzlicher Riegel im Seitenfluss kamen dagegen
  // an. Der Tutorial-Dimmer schafft es dagegen zuverlaessig – weil er ein ganz
  // gewoehnliches festes Element mit inset:0 ist. Genau diese Bauweise hat der
  // Waehler jetzt: eine Deckflaeche, die selbst abdunkelt, mit dem Feld darin.
  const pickerLage = document.createElement('div');
  pickerLage.className = 'ex-picker-lage';
  pickerLage.hidden = true;
  const picker = document.createElement('div');
  picker.className = 'ex-picker';
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-modal', 'true');
  picker.setAttribute('aria-label', 'Übung auswählen');
  pickerLage.appendChild(picker);
  document.body.appendChild(pickerLage);
  const tutorialDunkel = document.createElement('div');
  tutorialDunkel.className = 'tutorial-dimmer';
  tutorialDunkel.hidden = !tutorialAktiv;
  tutorialDunkel.setAttribute('aria-hidden', 'true');
  tutorialDunkel.onclick = () => tutorialScrollen();
  // Der Dimmer muss dieselbe Compositing-Ebene wie die scrollenden Karten
  // teilen. Auf iOS liegt ein fester Dimmer ausserhalb von #view sonst ueber
  // dem kompletten Scrollcontainer – auch ueber dem aktiven Übungsfeld.
  container.appendChild(tutorialDunkel);
  // Die Tutorialkarte gehoert nicht in den scrollenden Trainingsinhalt.
  // Andernfalls wandert ihre weisse Flaeche auf iOS beim Scrollen unter die
  // transparente Systemleiste. Diese feste Ebene bleibt am Display stehen,
  // waehrend ausschliesslich #view darunter scrollt.
  const tutorialEbene = document.createElement('div');
  tutorialEbene.className = 'tutorial-ebene';
  tutorialEbene.hidden = !tutorialAktiv;
  document.body.appendChild(tutorialEbene);
  // Keine dynamische Kopfmaske mehr: Sie wurde frueher bei jedem Scrollschritt
  // auf die Unterkante der Tutorialkarte ausgemessen und war der Ausloeser fuer
  // die wechselnde weisse iOS-Systemleiste. Die Karte selbst (z 60) verdeckt
  // alles in ihrem Rechteck; den schmalen Bereich darueber deckt der statische
  // Safe-Area-Schutz aus styles.css ab.
  setStatusleistenOverlay('tutorial', tutorialAktiv);
  let tutorialClipRaf = null;
  function tutorialClipAktualisieren() {
    tutorialClipRaf = null;
    const karte = tutorialEbene.querySelector('.log-tutorial');
    const block = contentEl.querySelector('.block.tutorial-aktiv');
    if (!tutorialAktiv || !karte) {
      container.style.removeProperty('--tutorial-kartenraum');
      block?.style.removeProperty('--tutorial-clip-top');
      return;
    }
    // Weil die Karte nun ausserhalb des Scrollcontainers fest am Display
    // sitzt, reserviert #view denselben Raum. So beginnt die aktuelle
    // Muskelkarte direkt UNTER der Tutorialkarte, statt von ihr abgeschnitten
    // zu werden. Beim naechsten Feld kann #view diesen Raum intern wegscrollen.
    container.style.setProperty(
      '--tutorial-kartenraum',
      `${Math.ceil(karte.getBoundingClientRect().bottom + 10)}px`,
    );
    if (!block) return;
    const blockRect = block.getBoundingClientRect();
    // Nur die hervorgehobene Muskelkarte abschneiden. Anders als die fruehere
    // Vollflaechenmaske veraendert das keine Flaeche im iOS-Statusbereich.
    const verdeckt = Math.max(0, Math.min(
      blockRect.height + 8,
      Math.ceil(karte.getBoundingClientRect().bottom - blockRect.top),
    ));
    block.style.setProperty('--tutorial-clip-top', `${verdeckt}px`);
  }
  function tutorialClipPlanen() {
    if (tutorialClipRaf != null) return;
    tutorialClipRaf = requestAnimationFrame(tutorialClipAktualisieren);
  }
  window.addEventListener('resize', tutorialClipPlanen);
  window.addEventListener('scroll', tutorialClipPlanen, { passive: true });
  container.addEventListener('scroll', tutorialClipPlanen, { passive: true });

  function oeffneUebungswahl({ titel, gruppen, aktuell, onSelect }) {
    picker.innerHTML = '';
    const schale = document.createElement('div');
    schale.className = 'ex-picker-schale';
    schale.innerHTML = `
      <div class="ex-picker-kopf">
        <div><small>Übung auswählen</small><b></b></div>
        <button type="button" class="ex-picker-zu" aria-label="Schließen">×</button>
      </div>
      <input class="ex-picker-suche" type="search" placeholder="Übung suchen…" autocomplete="off">
      <div class="ex-picker-liste"></div>
      ${aktuell ? '<button type="button" class="ex-picker-leeren">Auswahl löschen</button>' : ''}`;
    schale.querySelector('.ex-picker-kopf b').textContent = titel;
    picker.appendChild(schale);
    const suche = schale.querySelector('.ex-picker-suche');
    const liste = schale.querySelector('.ex-picker-liste');

    // Ohne <dialog> gibt es kein eingebautes Escape mehr – selbst nachruesten.
    const beiTaste = (e) => { if (e.key === 'Escape') schliessen(); };
    const schliessen = () => {
      window.visualViewport?.removeEventListener('resize', anOberkante);
      document.removeEventListener('keydown', beiTaste);
      pickerLage.classList.remove('tastatur');
      pickerLage.style.removeProperty('--picker-top');
      pickerLage.style.removeProperty('--picker-hoehe');
      pickerLage.hidden = true;
      setStatusleistenOverlay('uebungskatalog', false);
    };
    const anOberkante = () => {
      const ansicht = window.visualViewport;
      const oben = Math.max(6, Number(ansicht?.offsetTop) || 0) + 6;
      const hoehe = Math.max(240, (Number(ansicht?.height) || window.innerHeight) - oben - 6);
      pickerLage.classList.add('tastatur');
      pickerLage.style.setProperty('--picker-top', `${oben}px`);
      pickerLage.style.setProperty('--picker-hoehe', `${hoehe}px`);
      liste.scrollTop = 0;
    };
    schale.querySelector('.ex-picker-zu').onclick = schliessen;
    // Tippen neben das Feld schliesst – die Deckflaeche ist jetzt ein echtes
    // Element, der Treffer liegt also auf ihr statt auf einem ::backdrop.
    pickerLage.onclick = (e) => { if (e.target === pickerLage) schliessen(); };
    document.addEventListener('keydown', beiTaste);
    suche.addEventListener('focus', () => {
      anOberkante();
      window.visualViewport?.addEventListener('resize', anOberkante);
    });

    const waehlen = (name) => {
      schliessen();
      onSelect(name);
    };
    const zeichneListe = () => {
      liste.innerHTML = '';
      const treffer = sucheAuswahlGruppen(gruppen, suche.value);
      if (!treffer.length) {
        const leer = document.createElement('p');
        leer.className = 'ex-picker-kein';
        leer.textContent = 'Keine passende Übung gefunden.';
        liste.appendChild(leer);
        return;
      }
      treffer.forEach((gruppe) => {
        const ueberschrift = document.createElement('p');
        ueberschrift.className = 'ex-picker-gruppe';
        ueberschrift.textContent = gruppe.label;
        liste.appendChild(ueberschrift);
        gruppe.eintraege.forEach((eintrag) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ex-picker-option' + (eintrag.n === aktuell ? ' gewaehlt' : '');
          b.textContent = eintrag.n;
          b.onclick = () => waehlen(eintrag.n);
          liste.appendChild(b);
        });
      });
      liste.scrollTop = 0;
    };
    suche.oninput = zeichneListe;
    schale.querySelector('.ex-picker-leeren')?.addEventListener('click', () => waehlen(''));
    zeichneListe();
    // Erst den dunklen iOS-/Overlayzustand setzen, dann das Feld sichtbar
    // machen. Kein automatischer Fokus: Das sofortige Oeffnen der iOS-Tastatur
    // baute den geschuetzten Bereich erneut in der hellen Seitenfarbe auf.
    setStatusleistenOverlay('uebungskatalog', true);
    pickerLage.hidden = false;
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

  wocheSel.innerHTML = [
    ...Array.from({ length: 7 }, (_, i) =>
      `<option value="${i + 1}">Cycle ${i + 1}</option>`),
    '<option value="8">Deload</option>',
  ].join('');
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
    phaseEl.textContent = imDeload ? 'Deload' : 'Cycle ' + state.week;
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
    woWert.textContent = cruise ? 'Deload' : String(state.week);
    woLbl.textContent = cruise ? 'aktiv' : 'Cycle';
    [...wocheSel.options].forEach((option) => {
      const cycle = Number(option.value);
      const basis = cycle >= 8 ? 'Deload' : `Cycle ${cycle}`;
      const text = `${cycleFertig(cycle) ? '✓ ' : ''}${basis}`;
      if (option.textContent !== text) option.textContent = text;
    });

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
      return `${mark}${TPL[d].short}`;
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
    const [koerper, typ] = TPL[state.day].short.split(' · ');
    tagWert.textContent = koerper;
    tagLbl.textContent = typ;

    const tier = tierOf(state.day, state.week);
    tierSeg.value = String(tier);
    tierSeg.disabled = cruise;                    // Level im Deload gesperrt (I)
    lvlWert.textContent = TIER_NAMES[tier];
    ctrl.querySelector('#ci-lvl-l').textContent = cruise ? 'fest' : LEVEL_LABEL[tier];

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
    node.innerHTML = `<b>Cycle ${pWeek}: ${txt}</b>${chip}`;
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
      rirIn.setAttribute('aria-label', 'RIR – mögliche Wiederholungen übrig');
      rirIn.title = 'RIR = mögliche Wiederholungen übrig';
      rirIn.disabled = readOnly; rirF.appendChild(rirIn); row.appendChild(rirF);
      if (!readOnly) rirIn.oninput = () => { s.rir = rirIn.value; queuePersist(); };
    }

    if (!readOnly) {
      const upd = () => {
        s.w = wIn.value; s.r = rIn.value;
        renderPrev(prevLine, prevSets, entry.sets[xi].slice(0, count), prev ? prev.week : null);
        refreshVolume(); renderControls(); queuePersist();
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
      ? `zuletzt: ${m.w} kg${hasR ? ` · ${m.r} Wdh. im letzten Clusters` : ''}`
      : `zuletzt: ${m.w} kg${hasR ? ` × ${m.r} Wdh` : ''}`;
    // Wochennummern starten pro Phase neu – Pool-Treffer stammen aus einer
    // frueheren Phase und werden deshalb nicht als "Wo N" ausgewiesen.
    node.innerHTML = `<b>${txt}</b><span class="delta d-hold">${m.pool ? 'Pool' : 'C ' + m.week}</span>`;
  }
  // Clusters = 6×4 Minisätze. Kompakt: Gewicht + Wdh im letzten (6.) Satz.
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
      const upd = () => { s.w = wIn.value; s.r = rIn.value; renderMem(memNode, entry.names[xi], 'mr'); refreshVolume(); renderControls(); queuePersist(); };
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
      const upd = () => { s.w = wIn.value; s.r = rIn.value; renderMem(memNode, entry.names[xi], kind); refreshVolume(); renderControls(); queuePersist(); };
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
    tutorialEbene.innerHTML = '';
    tutorialEbene.hidden = !tutorialAktiv;
    tutorialDunkel.hidden = !tutorialAktiv;

    if (einstiegSichtbar) {
      const einstieg = document.createElement('section');
      einstieg.className = 'log-einstieg';
      einstieg.innerHTML = `
        <p class="log-einstieg-kicker">LOGMAN einrichten</p>
        <p class="log-einstieg-text">Das kurze Tutorial erklärt zuerst den Plan.
          Danach legst du die Übungen fest, die sich automatisch wiederholen,
          und lernst die Satzeingabe.</p>
        <div>
          <button type="button" class="log-einstieg-los">Tutorial starten</button>
          <button type="button" class="log-einstieg-skip">Überspringen</button>
          <a href="#faq">Wie funktioniert LOGMAN?</a>
        </div>`;
      einstieg.querySelector('.log-einstieg-los').onclick = () => {
        state.meta.einstiegErledigt = true;
        state.meta.tutorialErledigt = false;
        einstiegSichtbar = false;
        tutorialZielSetzen(-1);
        tutorialSpeichernUndZeichnen();
      };
      einstieg.querySelector('.log-einstieg-skip').onclick = () => tutorialBeenden(true);
      contentEl.appendChild(einstieg);
    }

    let tutorialStatus = null;
    if (tutorialAktiv) {
      const karte = document.createElement('section');
      karte.className = 'log-tutorial';
      if (tutorialSchritt < 0) {
        karte.classList.add('log-tutorial-basics');
        karte.innerHTML = `
          <div class="log-tutorial-kopf">
            <span>Kurz erklärt</span>
            <button type="button" data-tutorial-zu aria-label="Tutorial beenden">×</button>
          </div>
          <h2>Dein Plan auf einen Blick</h2>
          <div class="tutorial-planpunkte">
            <div>
              <b>4</b>
              <span><strong>4 Einheiten</strong><small>OK HEAVYS · UK HEAVYS · OK PUMPS · UK PUMPS.</small></span>
            </div>
            <div>
              <b>7</b>
              <span><strong>7 Cycles</strong><small>Nach jeder Pause machst du einfach mit der nächsten Einheit weiter.</small></span>
            </div>
            <div>
              <b>2</b>
              <span><strong>2 Satzarten</strong><small>HEAVYS sind schwer · PUMPS leichter und versagensnah.</small></span>
            </div>
          </div>
          <div class="tutorial-heavyinfo">
            <strong>Was du jetzt festlegst</strong>
            <p>Für HEAVYS wählst du jetzt feste Übungen für Ober- und Unterkörper.
              LOGMAN übernimmt sie in alle sieben Cycles. PUMPS wählst du im Training frei.</p>
            <p>Die Felder unterscheiden zwei Übungsarten:</p>
            <div class="tutorial-rollen">
              <span><b>Comp</b><small>mehrere Gelenke und Muskeln</small></span>
              <span><b>Iso</b><small>ein Muskel möglichst gezielt</small></span>
            </div>
          </div>
          <button type="button" class="log-tutorial-weiter" data-tutorial-beginnen>
            HEAVYS auswählen <span class="tutorial-pf">→</span>
          </button>`;
        karte.querySelector('[data-tutorial-beginnen]').onclick = () => {
          tutorialZielSetzen(0);
          tutorialSpeichernUndZeichnen();
        };
      } else if (tutorialSchritt < TUTORIAL_SETUP.length) {
        const schritt = TUTORIAL_SETUP[tutorialSchritt];
        tutorialStatus = heavyAuswahlStatus(tpl, tier);
        const fertig = tutorialStatus.offen.length === 0;
        const alsNaechstes = tutorialStatus.offen[0];
        const naechsteAuswahl = alsNaechstes
          ? `${alsNaechstes.muskel} ${alsNaechstes.rolle}-Übung wählen`
          : '';
        const rollenHilfe = alsNaechstes?.rolle === 'Comp'
          ? '<b>Comp-Feld:</b> Wähle eine große Grundübung. Sie bewegt mehrere Gelenke und trainiert mehrere Muskeln.'
          : alsNaechstes?.rolle === 'Iso'
            ? '<b>Iso-Feld:</b> Wähle eine Übung, die den angezeigten Muskel möglichst gezielt belastet.'
            : '';
        karte.innerHTML = `
          <div class="log-tutorial-kopf">
            <span>Setup ${tutorialSchritt + 1} / ${TUTORIAL_SETUP.length}</span>
            <button type="button" data-tutorial-zu aria-label="Tutorial beenden">×</button>
          </div>
          <div class="tutorial-fortschritt" aria-hidden="true">
            ${TUTORIAL_SETUP.map((_, i) => `<i class="${i <= tutorialSchritt ? 'an' : ''}"></i>`).join('')}
          </div>
          <div class="tutorial-zielkopf"><h2>${schritt.titel}</h2><span>HEAVYS</span></div>
          <p class="tutorial-kurzziel"><b>Feste Auswahl</b> · wird automatisch in Cycle 1–7 übernommen.</p>
          ${rollenHilfe ? `<p class="log-tutorial-typen">${rollenHilfe}</p>` : ''}
          <p class="log-tutorial-stand"><b>${tutorialStatus.gewaehlt} / ${tutorialStatus.gesamt}</b> HEAVYS gewählt</p>
          <button type="button" class="log-tutorial-weiter" data-tutorial-weiter ${fertig ? '' : 'data-offen'}>
            ${fertig
              ? `Weiter: ${schritt.folgt} <span class="tutorial-pf">→</span>`
              : `${naechsteAuswahl} <span class="tutorial-pf">↓</span>`}
          </button>`;
        karte.querySelector('[data-tutorial-weiter]').onclick = () => {
          if (!fertig) { tutorialScrollen(); return; }
          tutorialZielSetzen(tutorialSchritt + 1);
          tutorialSpeichernUndZeichnen();
        };
      } else {
        karte.innerHTML = `
          <div class="log-tutorial-kopf">
            <span>Satzeingabe</span>
            <button type="button" data-tutorial-zu aria-label="Tutorial beenden">×</button>
          </div>
          <h2>HEAVYS protokollieren</h2>
          <div class="tutorial-eingabe">
            <span><b>kg</b><small>Gewicht</small></span>
            <span><b>Wdh.</b><small>Wiederholungen</small></span>
            <span><b>RIR</b><small>Wiederholungen übrig</small></span>
          </div>
          <p><b>RIR 1</b> bedeutet: Eine saubere Wiederholung wäre noch möglich gewesen.</p>
          <p class="tutorial-kurzziel">Beim nächsten vergleichbaren Training stehen die letzten Werte direkt über der Eingabe.</p>
          <div class="log-tutorial-ende">
            <button type="button" class="log-tutorial-weiter" data-tutorial-fertig>Tutorial abschließen</button>
          </div>`;
        karte.querySelector('[data-tutorial-fertig]').onclick = tutorialStartAnimation;
      }
      karte.querySelector('[data-tutorial-zu]').onclick = () => {
        if (confirm('Tutorial beenden? Du kannst es später im FAQ erneut starten.')) tutorialBeenden(true);
      };
      tutorialEbene.appendChild(karte);
    }

    const naechste = tutorialAktiv ? null : naechsteEinheit();
    if (!readOnly && naechste) {
      const weiter = document.createElement('button');
      weiter.type = 'button';
      weiter.className = 'log-weiter';
      weiter.innerHTML = `<span>Diese Einheit ist vollständig</span><b>Weiter mit ${naechste.week >= 8 ? 'Deload' : `Cycle ${naechste.week}`} · ${TPL[naechste.day].short} →</b>`;
      weiter.onclick = () => {
        state.week = naechste.week;
        state.day = naechste.day;
        const key = state.day + '|' + state.week;
        if (!state.datum[key]) state.datum[key] = lokalesDatum();
        queuePersist();
        renderAll();
        window.scrollTo({ top: 0, behavior: 'instant' });
      };
      contentEl.appendChild(weiter);
    }

    // Frueher hing hier je Block eine datalist fuer die Tipp-Hilfe am Rechner.
    // Mit der Katalog-Auswahl gibt es nichts mehr zu tippen – das <select>
    // bringt seine Liste selbst mit, auf iOS als Auswahlrad.
    wrap.querySelector('#lg-pool').innerHTML = '';

  let tutorialWahlMarkiert = false;
    const blocks = sortierteBloecke(tpl, state.week, state.day);
    blocks.forEach((blk) => {
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
      const effRest = effektivePause(blk);
      const effReps = effType === 'mr' ? '6×4' : (baseMR ? '15–25' : blk.reps);
      const blockMus = blk.mus;

      const el = document.createElement('div'); el.className = `block block-${effType}`;
      const cues = [];
      if (!blk.prio && effType === 'load') {
        const hatComp = exOf(blk, tier).some((exDef) => exDef.r === 'Comp');
        cues.push('<span class="chip">' + effReps + ' · ' + (blk.rir || '1–3 RIR') + '</span>',
          `<span class="chip">${blk.deload ? 'Kein Versagen' : (hatComp ? 'Versagen nur letzter Comp' : 'Kein erzwungenes Versagen')}</span>`);
      }
      if (!blk.prio && effType === 'pump') cues.push('<span class="chip">' + effReps + ' · ' + (blk.rir || '0–1 RIR') + '</span>', '<span class="chip">leicht · versagensnah · Partials optional</span>');
      if (!blk.prio && effType === 'mr') cues.push('<span class="chip">6×4 · ~15RM</span>', '<span class="chip">Versagen nur letzter Minisatz</span>');
      if (!blk.prio) cues.push('<button class="chip rest"' + (readOnly ? ' disabled' : '') + ' data-rest="' + effRest + '">⏱ ' + pausenLabel(effRest) + '</button>');

      el.innerHTML = `
        <div class="bhead">
          <span class="mus">${blockMus}</span>
          <span class="badge b-${effType}">${TYPE_LABEL[effType] || effType}</span>
          ${blk.prio ? '<span class="volrolle prio">Priorisiert</span>' : ''}
          <span class="target" data-tgt="${blk.id}">Sätze <b>${tgt}</b></span>
        </div>
        ${cues.length ? `<div class="cue">${cues.join('')}</div>` : ''}`;
      if (blk.prio) el.classList.add('prioritaets-block');
      if (blk.angedockt) el.classList.add('prioritaets-angedockt');
      // Muskelname mitgeben: Die Mitteilung soll sagen, wovon die Pause war.
      if (!readOnly) el.querySelectorAll('.chip.rest').forEach((b) => (
        b.onclick = () => startePause(Number(b.dataset.rest), blockMus)
      ));

      exOf(blk, tier).forEach((exDef, xi) => {
        const exDiv = document.createElement('div'); exDiv.className = 'ex';

        const hd = document.createElement('div'); hd.className = 'exhead';
        if (exDef.r || blk.prio) {
          const rl = document.createElement('span');
          rl.className = 'role' + (exDef.r === 'Comp' ? ' comp' : '');
          rl.textContent = blk.prio ? 'Comp / Iso' : exDef.r;
          hd.appendChild(rl);
        }
        // Auswahl statt Freitext: Nur was im Katalog steht, laesst sich
        // eintragen. Sonst wuesste das Wochenkonto nicht, auf welches
        // Muskelkonto ein Satz laeuft – und ein Tippfehler waere still eine
        // zweite Uebung. Welche Uebungen ein Feld anbietet, entscheiden die
        // Konten des Blocks und (bei Heavy) Comp/Iso.
        //
        // Suchdialog statt langem Auswahlrad: Manche Felder bieten mehr als 60
        // Uebungen. Zuletzt Benutztes und Muskelgruppen bleiben trotzdem als
        // Reihenfolge erhalten.
        const aktuell = (freeEx ? entry.names[xi] : names[xi]) || '';
        const nameIn = document.createElement('button');
        nameIn.type = 'button';
        nameIn.className = 'exname';
        nameIn.disabled = readOnly;

        // Zuletzt Benutztes nach oben – nur bei Pump und Cluster, denn nur die
        // rotieren frei. Heavy behaelt seine Uebung ohnehin ueber die Rotation.
        const zuletzt = freeEx ? recentNames(baseMR ? 'mr' : 'pump', blk.id).map((r) => r.n) : [];
        // Feld schlaegt Block: Bei "Brust + Rücken" bietet das erste Feld nur
        // Brust an, das zweite nur Rücken – statt beide Male alles.
        const gruppen = auswahlGruppen(exDef.konten || blk.konten, exDef.r || null, zuletzt);

        // Ein Name aus einem alten Log, den der Katalog nicht (mehr) kennt:
        // sichtbar lassen und als solchen kennzeichnen, statt ihn stumm zu
        // verschlucken. Streicht jemand eine Zeile aus der Excel, wuerde sonst
        // rueckwirkend die Beschriftung schon geloggter Saetze verschwinden.
        if (aktuell && !imKatalog(aktuell)) {
          gruppen.push({ label: 'Nicht im Katalog', eintraege: [{ n: aktuell }] });
        }
        nameIn.value = aktuell;
        const tonAnpassen = () => {
          nameIn.classList.toggle('leer', !nameIn.value);
          nameIn.textContent = nameIn.value || 'Übung wählen…';
        };
        tonAnpassen();
        if (tutorialAktiv && tutorialSchritt >= 0 && tutorialSchritt < TUTORIAL_SETUP.length &&
            effType === 'load' && !nameIn.value && !tutorialWahlMarkiert) {
          tutorialScrollAufFeld = tutorialLetzterBlock === blk.id;
          tutorialLetzterBlock = blk.id;
          nameIn.classList.add('tutorial-ziel');
          hd.classList.add('tutorial-scrollziel');
          el.classList.add('tutorial-aktiv');
          tutorialWahlMarkiert = true;
        }
        hd.appendChild(nameIn); exDiv.appendChild(hd);

        const prevLine = document.createElement('div'); prevLine.className = 'prev';
        // Anzahl Sätze: Pump-Paare sind Supersets und Cluster-Felder eigenständig -> jede Übung
        // bekommt die volle Zahl. Nur Heavy wird im Wechsel auf Comp/Iso aufgeteilt.
        const geplant = setsForExercise(blk, tier, xi) + extraSets(entry, tier, xi);
        const prioDelta = prio.delta[slotKey(state.day, blk.id, xi)] || 0;
        const count = Math.max(0, geplant + prioDelta);
        if (prioDelta) {
          const vc = document.createElement('span');
          vc.className = 'volrolle ' + (prioDelta > 0 ? 'prio' : 'minus');
          vc.textContent = prioDelta > 0 ? `Priorität +${prioDelta}` : `Umverteilung ${prioDelta}`;
          hd.appendChild(vc);
        }
        if (tier === 2 && !blk.prio && !readOnly) {
          entry.extra = entry.extra || {};
          const extra = extraSets(entry, tier, xi);
          const steuerung = document.createElement('span');
          steuerung.className = 'satz-extra';
          if (extra > 0) {
            const minus = document.createElement('button');
            minus.type = 'button';
            minus.className = 'satz-extra-minus';
            minus.textContent = '−';
            minus.setAttribute('aria-label', 'Einen Zusatzsatz entfernen');
            minus.onclick = () => {
              entry.extra[xi] = Math.max(0, extra - 1);
              queuePersist();
              renderAll();
            };
            steuerung.appendChild(minus);
            const stand = document.createElement('b');
            stand.textContent = `+${extra}`;
            stand.title = `${extra} zusätzliche ${extra === 1 ? 'Satz' : 'Sätze'}`;
            steuerung.appendChild(stand);
          }
          const plus = document.createElement('button');
          plus.type = 'button';
          plus.className = 'satz-extra-plus';
          plus.innerHTML = '<span aria-hidden="true">+</span> Satz';
          plus.setAttribute('aria-label', 'Einen Zusatzsatz hinzufügen');
          plus.onclick = () => {
            entry.extra[xi] = extra + 1;
            queuePersist();
            renderAll();
          };
          steuerung.appendChild(plus);
          hd.appendChild(steuerung);
        }
        entry.sets[xi] = entry.sets[xi] || [];
        while (entry.sets[xi].length < count) entry.sets[xi].push({ w: '', r: '', rir: '' });

        const memKind = baseMR ? 'mr' : 'pump';
        if (!readOnly) nameIn.onclick = () => oeffneUebungswahl({
          titel: blockMus,
          gruppen,
          aktuell: nameIn.value,
          onSelect: (wert) => {
            nameIn.value = wert;
            if (freeEx) { entry.names[xi] = wert; renderMem(prevLine, entry.names[xi], memKind); }
            else { names[xi] = wert; }
            tonAnpassen();
            if (!tutorialAktiv) {
              state.meta.einstiegErledigt = true;
              einstiegSichtbar = false;
              contentEl.querySelector('.log-einstieg')?.remove();
            }
            queuePersist();
            // Eine Pump-Wahl kann eine gespeicherte Prioritaet oder deren Spender
            // aktivieren/deaktivieren. Die Satzzahl muss deshalb sofort neu
            // berechnet werden, nicht erst beim naechsten Seitenwechsel.
            if (freeEx || tutorialAktiv) renderDay();
          },
        });

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
    if (tutorialAktiv && tutorialSchritt === TUTORIAL_SETUP.length) {
      contentEl.querySelector('.block')?.classList.add('tutorial-aktiv');
      contentEl.querySelector('.setrow')?.classList.add('tutorial-ziel');
    }
    renderVolume(cell, tpl, tier);
    tutorialClipPlanen();
    tutorialScrollen();

    // Nach sieben Cycles bewusst entscheiden: neuer Trainingsblock oder Deload.
    phaseResetEl.innerHTML = '';
    const letzterCycleFertig = state.week === 7 &&
      daysOfWeek(7).every((day) => dayProgress(day, 7).met);
    if (!readOnly && (letzterCycleFertig || state.week >= 8)) {
      const box = document.createElement('div');
      box.className = 'phase-ende';
      box.innerHTML = `<p>${state.week === 7 ? '7 Cycles abgeschlossen. Wie geht es weiter?' : 'Deload abgeschlossen.'}</p>
        <div class="phase-ende-aktionen">
          <button class="phase-reset" data-phase-neu>↻ Weitertrainieren · neue Phase</button>
          ${state.week === 7 ? '<button class="phase-reset phase-deload" data-phase-deload>1 Woche Deload</button>' : ''}
        </div>`;
      box.querySelector('[data-phase-neu]').onclick = resetAllData;
      box.querySelector('[data-phase-deload]')?.addEventListener('click', startDeload);
      phaseResetEl.appendChild(box);
    }
  }

  function startDeload() {
    state.week = 8;
    state.day = 'OK-D';
    queuePersist();
    renderAll();
    window.scrollTo({ top: 0, behavior: 'instant' });
    toast('Deload · 1 Woche');
  }

  async function resetAllData() {
    if (!confirm('ALLE eingetragenen Daten löschen (Übungen, Gewichte, Wdh, RIR, Notizen)?\n\nDanach startest du mit komplett leeren Feldern in eine neue Phase.\n\nDein PUMPS-Übungspool bleibt erhalten: Trägst du eine Übung wieder ein, siehst du weiterhin, was du zuletzt geschafft hast.')) return;
    // Pool retten, bevor die Wochendaten fallen. Neuere Werte gewinnen.
    state.mem = Object.assign({}, state.mem, harvestMem(state.data));
    state.data = {}; state.ex = {}; state.notes = {}; state.tier = {}; state.datum = {};
    state.volumen = { prioritaet: {} };
    state.week = 1; state.day = 'OK-H';
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
    const blocks = sortierteBloecke(tpl, state.week, state.day);
    blocks.forEach((blk) => {
      const tgt = targetSets(blk, tier);
      if (tgt === 0) return;
      const entry = cell[blk.id];
      let sets = 0;
      let blockTgt = 0;
      exOf(blk, tier).forEach((_, xi) => {
        const basis = setsForExercise(blk, tier, xi) + extraSets(entry, tier, xi);
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
      const blk = blocks.find((b) => b.id === el.dataset.tgt); if (!blk) return;
      const entry = cell[blk.id]; let sets = 0;
      const tgt = targetSets(blk, tier);
      let blockTgt = 0;
      exOf(blk, tier).forEach((_, xi) => {
        const basis = setsForExercise(blk, tier, xi) + extraSets(entry, tier, xi);
        const cnt = Math.max(0, basis + (prio.delta[slotKey(state.day, blk.id, xi)] || 0));
        blockTgt += cnt;
        const arr = (entry && entry.sets && entry.sets[xi]) || [];
        (arr || []).slice(0, cnt).forEach((s) => { if (s && (s.w || s.r)) sets++; });
      });
      el.classList.toggle('met', blockTgt > 0 && sets >= blockTgt);
      el.innerHTML = 'Sätze <b>' + blockTgt + '</b>';
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

  if (mergedOffline && !readOnly) {
    // Offline geladen oder zusammengefuehrt: Der lokale Stand ist jetzt der
    // gueltige und muss noch hoch. Markieren und (falls Netz da ist) senden.
    writeLog(userId, payloadOut(), true, schemaReset);
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

  // Der Knopf "Einheit speichern" ist ersatzlos entfallen: Die App
  // speichert nach jeder Eingabe von selbst, und ob das geklappt hat, sagt der
  // Sync-Punkt in der Kopfleiste. Ein Knopf, der nur das ausloest, was ohnehin
  // laeuft, verspricht eine Notwendigkeit, die es nicht gibt.

  return {
    destroy() {
      clearTimeout(saveTimer);
      clearInterval(retryId);
      window.removeEventListener('online', retrySync);
      // Die App-Huelle blendet die Felder auf Unterseiten aus; stilllegen wir
      // sie trotzdem, damit kein verdecktes natives Element reagieren kann.
      const slots = document.querySelector('#app-slots');
      if (slots) slots.querySelectorAll('select,input').forEach((el) => { el.disabled = true; });
      // Der Phasen-Chip gehoert dem Log – ausserhalb gibt es keine Phase.
      const ph = document.querySelector('#app-phase');
      if (ph) ph.hidden = true;
      // Der Punkt gehoert dem Log – ausserhalb gibt es nichts zu synchronisieren.
      if (saveStateEl) saveStateEl.hidden = true;
      pickerLage.remove();
      tutorialDunkel.remove();
      tutorialEbene.remove();
      container.style.removeProperty('--tutorial-kartenraum');
      cancelAnimationFrame(tutorialClipRaf);
      window.removeEventListener('resize', tutorialClipPlanen);
      window.removeEventListener('scroll', tutorialClipPlanen);
      container.removeEventListener('scroll', tutorialClipPlanen);
      tutorialFxTimer.forEach(clearTimeout);
      tutorialFxTimer = [];
      tutorialFx?.remove();
      tutorialFx = null;
      setStatusleistenOverlay('uebungskatalog', false);
      setStatusleistenOverlay('tutorial', false);
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
