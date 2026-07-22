import { supabase } from './supabase.js';
import { kurveSvg } from './kurve.js';
import { heavyReihen, verlauf } from './progression.js';

// Heavy-Progression im Profil.
//
// Bewusst ein eigenes Modul und nicht Teil der Koerperwerte: Das hier ist der
// Trainings-Marker und gehoert dauerhaft zu LOGMAN, waehrend Hautfalten und
// Gewicht Koerperdaten sind und spaeter woanders leben koennen.

const fmt = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');

export function mountFortschritt(wrap, { session, payload: fertig = null, titel = 'Heavy-Progression' }) {
  const karte = document.createElement('div');
  karte.className = 'card';
  karte.innerHTML = `${titel ? `<h2 class="section-title" style="font-size:18px;margin:0 0 12px">${titel}</h2>` : ''}
    <div id="fs-inhalt"><div class="mess-leer">lädt…</div></div>`;
  wrap.appendChild(karte);

  const inhalt = karte.querySelector('#fs-inhalt');

  (async () => {
    // Im Log liegt das Payload schon im Speicher – dann wird es durchgereicht,
    // statt es ein zweites Mal vom Server zu holen. Das Blatt geht so ohne
    // Ladezeit auf und funktioniert auch ohne Netz.
    let payload = fertig;
    if (payload) { zeichneAlles(payload); return; }
    try {
      const { data, error } = await supabase
        .from('training_logs').select('payload').eq('user_id', session.user.id).maybeSingle();
      if (error) throw error;
      payload = data?.payload || {};
    } catch (e) {
      inhalt.innerHTML = `<div class="msg err">${e.message}</div>`;
      return;
    }

    zeichneAlles(payload);
  })();

  function zeichneAlles(payload) {
    const reihen = heavyReihen(payload);
    if (!reihen.length) {
      inhalt.innerHTML = `<div class="mess-leer">Noch keine Heavy-Übung mit zwei erfassten Wochen.<br>
        <span style="font-size:11.5px">Sobald dieselbe Übung ein zweites Mal im Log steht, erscheint hier ihr Verlauf.</span></div>`;
      return;
    }

    inhalt.innerHTML = `
      ${reihen.length > 1 ? `<select class="input" id="fs-wahl" style="margin:0 0 12px">
        ${reihen.map((r, i) => `<option value="${i}">${r.name}</option>`).join('')}
      </select>` : ''}
      <div class="mess-kopf" id="fs-kopf"></div>
      <div id="fs-kurve"></div>`;

    const zeichne = (i) => {
      const r = reihen[i];
      const v = verlauf(r.punkte);
      // Bei nur einer Uebung ersetzt der Name die fehlende Auswahl.
      const titel = reihen.length > 1 ? '' : `<div class="mess-datum" style="margin:0 0 4px">${r.name}</div>`;
      const delta = v.kg === 0
        ? `<span class="delta d-hold">= gehalten</span>`
        : `<span class="delta ${v.kg > 0 ? 'd-up' : 'd-down'}">${v.kg > 0 ? '▲' : '▼'} ${fmt(Math.abs(v.kg))} kg · ${fmt(Math.abs(v.prozent))} %</span>`;
      karte.querySelector('#fs-kopf').innerHTML = `${titel}
        <div class="mess-wert">${fmt(v.letzt)} <span>kg e1RM</span> ${delta}</div>
        <div class="mess-datum">Woche ${r.punkte[0].week} → ${r.punkte[r.punkte.length - 1].week} · bester Satz je Woche</div>`;
      karte.querySelector('#fs-kurve').innerHTML = kurveSvg(
        [{ werte: r.punkte.map((p) => ({ x: p.week, wert: p.e1 })), klasse: 'trend', punkte: true }],
        { einheit: 'kg', xText: (w) => 'Wo ' + w },
      );
    };

    const wahl = karte.querySelector('#fs-wahl');
    if (wahl) wahl.onchange = () => zeichne(Number(wahl.value));
    zeichne(0);
  }
}
