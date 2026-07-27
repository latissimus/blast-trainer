import { supabase } from './supabase.js';
import { readLog } from './localstore.js';
import { mountFortschritt } from './fortschritt.js';

// Heavy-Progression als eigene Seite.
//
// Lag zuerst im Profil, dann unter dem Set-O-Meter. Beides war der falsche Ort:
// Sie beantwortet die wichtigste Frage der App ("werde ich staerker?") und
// gehoert damit auf dieselbe Ebene wie Log und Set-O-Meter, nicht unter etwas
// anderes geschoben.
//
// Die Daten kommen wie beim Set-O-Meter aus dem lokalen Spiegel: Das Log
// schreibt ihn bei jeder Eingabe, er ist also aktuell und auch offline da.

export async function mountProg(container, { userId }) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Auswertung</span>
        <h1 class="section-title">Progression</h1>
      </div>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>
    <div class="som-statuskopf prog-statuskopf">
      <p class="prog-info-titel">HEAVYS-Progression</p>
      <button class="som-info-knopf" id="prog-info-knopf" type="button" aria-expanded="false" aria-controls="prog-info">i</button>
    </div>
    <div class="som-kurzhilfe" id="prog-info" hidden>
      <p>Diese Kurve zeigt den <b>Trend deiner HEAVYS-Leistung</b>. Einzelne schwächere Einheiten sind normal; aussagekräftig wird erst die Entwicklung über mehrere vergleichbare Cycles.</p>
      <p>Gezeigt wird das <b>geschätzte 1RM nach Epley</b> aus deinem besten Satz je Cycle. Dadurch zählen sowohl mehr Gewicht als auch mehr Wiederholungen bei gleichem Gewicht. Es ist eine Rechengröße, kein Maximalkrafttest und kein direkter Beweis für Muskelwachstum.</p>
      <p>Ausgewertet werden nur <b>HEAVYS-Sätze</b>. PUMPS sind nicht als vergleichbarer Leistungstest gedacht.</p>
    </div>
    <div id="prog-inhalt"></div>`;
  container.appendChild(wrap);

  const info = wrap.querySelector('#prog-info');
  const infoKnopf = wrap.querySelector('#prog-info-knopf');
  infoKnopf.onclick = () => {
    info.hidden = !info.hidden;
    infoKnopf.setAttribute('aria-expanded', info.hidden ? 'false' : 'true');
  };

  let payload = null;
  const lokal = readLog(userId);
  if (lokal && lokal.payload) payload = lokal.payload;
  else {
    try {
      const { data } = await supabase
        .from('training_logs').select('payload').eq('user_id', userId).maybeSingle();
      payload = data?.payload || {};
    } catch (e) {
      payload = {};
    }
  }
  if (payload?.v !== 4) payload = { v: 4 };

  // Ohne eigenen Kartentitel – die Seitenueberschrift sagt es bereits.
  mountFortschritt(wrap.querySelector('#prog-inhalt'), { session: null, payload, titel: '' });
}
