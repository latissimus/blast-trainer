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
      <h1 class="section-title">📈 Progression</h1>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>
    <div class="som-statuskopf prog-statuskopf">
      <p class="prog-info-titel">Heavy-Progression</p>
      <button class="som-info-knopf" id="prog-info-knopf" type="button" aria-expanded="false" aria-controls="prog-info">i</button>
    </div>
    <div class="som-kurzhilfe" id="prog-info" hidden>
      <p>Muskelaufbau folgt der <b>progressiven Überlastung</b>: Wächst die Leistung über die Wochen nicht, fehlt dem Körper der Grund, sich anzupassen. Volumen, Technik und Ernährung unterstützen diesen Prozess.</p>
      <p>Gezeigt wird das <b>geschätzte 1RM nach Epley</b> aus deinem besten Satz je Woche. Dadurch zählen sowohl mehr Gewicht als auch mehr Wiederholungen bei gleichem Gewicht.</p>
      <p>Ausgewertet werden nur <b>Heavy-Sätze</b>. Pump- und Cluster-Sätze sind nicht als vergleichbarer Leistungstest gedacht.</p>
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

  // Ohne eigenen Kartentitel – die Seitenueberschrift sagt es bereits.
  mountFortschritt(wrap.querySelector('#prog-inhalt'), { session: null, payload, titel: '' });
}
