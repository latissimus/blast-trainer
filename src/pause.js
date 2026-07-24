import { supabase } from './supabase.js';

const STORAGE_KEY = 'blast:pausentimer';

let ende = 0;
let label = '';
let intervalId = null;
let ausblendId = null;
let audioCtx = null;

function gespeichertenTimerLesen() {
  try {
    const wert = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (wert?.ende > Date.now()) {
      ende = Number(wert.ende);
      label = String(wert.label || '');
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) { /* Ein kaputter Browserwert darf die App nicht aufhalten. */ }
}

function timerSpeichern() {
  try {
    if (ende > Date.now()) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ende, label }));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* Timer läuft auch ohne Session-Speicher. */ }
}

function primeAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* Der sichtbare Timer bleibt funktionsfähig. */ }
}

async function endeMelden() {
  try { navigator.vibrate?.([180, 90, 180]); } catch (e) { /* egal */ }
  if (!audioCtx) return;
  if (audioCtx.state !== 'running') {
    try { await audioCtx.resume(); } catch (e) { return; }
    if (audioCtx.state !== 'running') return;
  }
  try {
    [0, 0.22].forEach((versatz) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const start = audioCtx.currentTime + versatz;
      osc.frequency.setValueAtTime(880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch (e) { /* Push und sichtbare Anzeige bleiben als Rückfall. */ }
}

function pushTimer(aktion, sekunden, muskel) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!navigator.onLine) return;
  supabase.functions
    .invoke('pausentimer', { body: { aktion, sekunden, label: muskel } })
    .catch(() => {});
}

function elemente() {
  return {
    leiste: document.querySelector('.ctrlbar'),
    box: document.querySelector('#app-timer'),
    text: document.querySelector('#app-timertxt'),
    aus: document.querySelector('#app-timerx'),
  };
}

function ausblenden() {
  const { leiste, box } = elemente();
  if (box) {
    box.hidden = true;
    box.classList.remove('done');
  }
  leiste?.classList.remove('timer-an');
}

function fertig() {
  clearInterval(intervalId);
  intervalId = null;
  ende = 0;
  label = '';
  timerSpeichern();
  const { box } = elemente();
  box?.classList.add('done');
  endeMelden();
  clearTimeout(ausblendId);
  ausblendId = setTimeout(ausblenden, 4000);
}

function zeichnen() {
  const { leiste, box, text } = elemente();
  if (!leiste || !box || !text || ende <= 0) return;
  const rest = Math.max(0, Math.round((ende - Date.now()) / 1000));
  box.hidden = false;
  box.classList.remove('done');
  leiste.classList.add('timer-an');
  text.textContent = `${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}`;
  if (rest <= 0) fertig();
}

function intervallSichern() {
  clearInterval(intervalId);
  intervalId = ende > Date.now() ? setInterval(zeichnen, 250) : null;
}

export function verbindePausenAnzeige() {
  const { aus } = elemente();
  if (aus) aus.onclick = () => stoppePause();
  if (!ende) gespeichertenTimerLesen();
  if (ende > Date.now()) {
    zeichnen();
    intervallSichern();
  } else {
    ausblenden();
  }
}

export function startePause(sekunden, muskel = '') {
  const dauer = Math.max(1, Number(sekunden) || 0);
  primeAudio();
  clearTimeout(ausblendId);
  pushTimer('start', dauer, muskel);
  ende = Date.now() + dauer * 1000;
  label = muskel;
  timerSpeichern();
  zeichnen();
  intervallSichern();
}

export function stoppePause(pushAbbrechen = true) {
  clearInterval(intervalId);
  clearTimeout(ausblendId);
  intervalId = null;
  ende = 0;
  label = '';
  timerSpeichern();
  ausblenden();
  if (pushAbbrechen) pushTimer('stop');
}

// Einmal beim Modulstart lesen. Die Anzeige wird erst verbunden, nachdem die
// App-Hülle mit ihrer unteren Leiste gebaut wurde.
gespeichertenTimerLesen();
