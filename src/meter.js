import { supabase } from './supabase.js';
import { readLog } from './localstore.js';
import { zaehleWoche, sortiert, zeigName } from './setometer.js';

// Set-O-Meter als eigene Seite.
//
// Frueher ein Fenster ueber dem Log. Als Seite hat es den Platz, den die
// Balkenliste und die Progressionskurve zusammen brauchen – und es verhaelt
// sich wie das FAQ, statt eine dritte Sorte Oberflaeche zu sein.
//
// Die Daten kommen aus dem LOKALEN SPIEGEL, nicht vom Server: Das Log schreibt
// ihn bei jeder Eingabe, er ist also immer aktuell und auch im Funkloch da.
// Der Server ist nur der Rueckfall fuer das erste Oeffnen auf einem neuen Geraet.

// Der Pfeil steht aufrecht in Monospace – wie frueher im Wochenfeld. In der
// kursiven Display-Schrift wirkte er duenn und kippte nach rechts, also gegen
// die Richtung, in die er zeigt.
export function zurueckChip() {
  return `<a class="zurueck" href="#log"><span class="pf">←</span> Log</a>`;
}

export async function mountMeter(container, { userId }) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <h1 class="section-title">🎯 Set-O-Meter</h1>
      ${zurueckChip()}
    </div>
    <p class="som-lage" id="som-lage"></p>
    <div class="som-karte"><div class="som-body" id="som-body">lädt…</div></div>`;
  container.appendChild(wrap);

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

  const woche = payload.week || 1;
  const { konten, ohneZuordnung, unbekannte, gesamt } = zaehleWoche(payload, woche);
  const lage = wrap.querySelector('#som-lage');
  const body = wrap.querySelector('#som-body');

  lage.textContent = gesamt === 0
    ? 'Woche ' + woche + ' · noch keine Übung gewählt'
    : 'Woche ' + woche + ' · geplant aus Level und Übungswahl';

  if (gesamt === 0) {
    body.innerHTML = `<p class="som-hinweis">Sobald Übungen gewählt sind, steht hier,
      welcher Muskel diese Woche wie viel Arbeit bekommt.</p>`;
  } else {
    // Bezug ist der laengste Balken, nicht ein Sollwert: Das Bild zeigt das
    // Verhaeltnis der Gruppen zueinander, es bewertet nichts.
    const reihen = sortiert(konten);
    const max = reihen[0].wert || 1;
    body.innerHTML = reihen.map((r) => `
      <div class="som-zeile">
        <span class="som-name">${zeigName(r.konto)}</span>
        <span class="som-track"><span class="som-fill" style="width:${(r.wert / max) * 100}%"></span></span>
      </div>`).join('')
      + (ohneZuordnung
        ? `<p class="som-hinweis">Nicht im Bild: Sätze mit einer Übung, die nicht im Katalog steht
           (${unbekannte.map((u) => `<b>${u}</b>`).join(', ') || 'ohne Namen'}).</p>`
        : '');
  }
}
