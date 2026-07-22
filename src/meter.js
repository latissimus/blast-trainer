import { supabase } from './supabase.js';
import { readLog, writeLog } from './localstore.js';
import { zaehleWoche, sortiert, zeigName } from './setometer.js';
import { KONTEN } from './katalog.js';
import {
  erhaltVon,
  prioritaetenVon,
  pumpFelder,
  pumpMoeglichkeiten,
  spenderKandidaten,
} from './prioritaet.js';

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
    <div class="som-karte"><div class="som-body" id="som-body">lädt…</div></div>
    <div id="som-editor"></div>
    <p class="som-speicher" id="som-speicher" aria-live="polite"></p>`;
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

  payload.volumen = payload.volumen || {};
  payload.volumen.prioritaet = payload.volumen.prioritaet || {};
  payload.volumen.erhalt = payload.volumen.erhalt || {};

  const woche = payload.week || 1;
  const lage = wrap.querySelector('#som-lage');
  const body = wrap.querySelector('#som-body');
  const editor = wrap.querySelector('#som-editor');
  const speicher = wrap.querySelector('#som-speicher');
  let ausgewaehlt = null;
  let schritt = null;
  let revision = 0;

  const html = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  function statusText(ergebnis) {
    if (!ergebnis) return '';
    if (ergebnis.status === 'aktiv' && ergebnis.modus === 'plus')
      return `Aktiv: +1 Satz bei ${ergebnis.zielFeld.mus}.`;
    if (ergebnis.status === 'aktiv')
      return `Aktiv: +1 bei ${ergebnis.zielFeld.mus}, −1 ${ergebnis.spender} in derselben Einheit.`;
    if (ergebnis.status === 'level-i') return 'Pausiert: Der passende Pump-Tag steht auf Level I.';
    if (ergebnis.status === 'ziel-fehlt') return 'Pausiert: Für diesen Muskel ist noch keine Pump-Übung gewählt.';
    if (ergebnis.status === 'spender-fehlt') return 'Pausiert: Der gewählte Spender ist in derselben Einheit nicht verfügbar.';
    return '';
  }

  function donorVon(konto, prios) {
    return KONTEN.filter((ziel) => prios[ziel]?.modus === 'tausch' && prios[ziel]?.spender === konto);
  }

  function renderEditor(werte, prioErgebnisse) {
    if (!ausgewaehlt) { editor.innerHTML = ''; return; }
    const konto = ausgewaehlt;
    const prios = prioritaetenVon(payload);
    const erhalt = erhaltVon(payload);
    const cfg = prios[konto];
    const ergebnis = prioErgebnisse[konto];
    const spenderFuer = donorVon(konto, prios);
    const moeglich = pumpMoeglichkeiten(payload, woche, konto);
    const levelOk = moeglich.some((m) => m.tier >= 1);
    const gewaehlt = pumpFelder(payload, woche).some((f) => f.konto === konto && f.tier >= 1);

    const basisPayload = Object.assign({}, payload, {
      volumen: Object.assign({}, payload.volumen, { prioritaet: {} }),
    });
    const basisWerte = zaehleWoche(basisPayload, woche);
    const kandidaten = schritt === 'spender'
      ? spenderKandidaten(payload, woche, konto, basisWerte)
      : [];

    editor.innerHTML = `
      <section class="som-editor">
        <div class="som-ed-kopf">
          <div><span class="som-ed-label">Muskel planen</span><h2>${html(konto)}</h2></div>
          <button class="som-ed-zu" type="button" aria-label="Schließen">×</button>
        </div>
        <p class="som-ed-stand">Direkt ${werte.direkt[konto] || 0} · indirekt ${werte.indirekt[konto] || 0} · zusammen ${werte.konten[konto] || 0}</p>
        ${cfg ? `<p class="som-prio-status">${html(statusText(ergebnis))}</p>` : ''}
        ${spenderFuer.length ? `<p class="som-prio-status">Gibt je 1 Satz ab für: <b>${spenderFuer.map(html).join(', ')}</b></p>` : ''}
        <div class="som-rollen">
          <button type="button" data-rolle="basis" class="${!cfg && !erhalt[konto] ? 'on' : ''}">Basis</button>
          <button type="button" data-rolle="erhalt" class="${erhalt[konto] ? 'on' : ''}">Erhalt</button>
          <button type="button" data-rolle="prio" class="${cfg ? 'on' : ''}" ${!levelOk || !gewaehlt ? 'disabled' : ''}>Priorität</button>
        </div>
        ${!levelOk ? '<p class="som-hinweis">Priorisierung ist erst ab Level II möglich.</p>' : ''}
        ${levelOk && !gewaehlt ? `<p class="som-hinweis">Wähle im Log zuerst eine Pump-Übung mit Hauptmuskel ${html(konto)}.</p>` : ''}
        ${schritt === 'modus' ? `
          <div class="som-frage">
            <h3>Wie soll der Satz eingeplant werden?</h3>
            <button type="button" class="som-wahl" data-modus="tausch"><b>Umverteilen</b><span>+1 hier, −1 in einem Pumpfeld derselben Einheit</span></button>
            <button type="button" class="som-wahl" data-modus="plus"><b>Aufschlagen</b><span>Gesamtvolumen bewusst um 1 Satz erhöhen</span></button>
          </div>` : ''}
        ${schritt === 'spender' ? `
          <div class="som-frage">
            <h3>Welcher Muskel gibt einen Satz ab?</h3>
            ${kandidaten.length ? kandidaten.map((k) => `
              <button type="button" class="som-wahl" data-spender="${html(k.konto)}">
                <b>${html(k.konto)}</b><span>${html(k.name)} · direkt ${k.direkt} + indirekt ${k.indirekt}</span>
                <small>${k.gruende.map(html).join(' · ')}</small>
              </button>`).join('') : '<p class="som-hinweis">Keine passende nicht priorisierte Pump-Übung mit verfügbarem Satz in derselben Einheit.</p>'}
            <button type="button" class="som-zurueck" data-zurueck="modus">← Andere Art wählen</button>
          </div>` : ''}
      </section>`;

    editor.querySelector('.som-ed-zu').onclick = () => { ausgewaehlt = null; schritt = null; render(); };
    editor.querySelectorAll('[data-rolle]').forEach((b) => {
      b.onclick = () => {
        const rolle = b.dataset.rolle;
        if (rolle === 'prio') { schritt = 'modus'; render(); return; }
        if (rolle === 'erhalt') {
          delete payload.volumen.prioritaet[konto];
          payload.volumen.erhalt[konto] = true;
        } else {
          delete payload.volumen.prioritaet[konto];
          delete payload.volumen.erhalt[konto];
          // Basis darf nicht weiter unsichtbar einen Satz abgeben. Betroffene
          // Prioritaeten bleiben erhalten, pausieren aber bis ein neuer
          // Spender bestaetigt wurde.
          Object.values(payload.volumen.prioritaet).forEach((p) => {
            if (p?.modus === 'tausch' && p.spender === konto) p.spender = null;
          });
        }
        schritt = null;
        speichern();
      };
    });
    editor.querySelectorAll('[data-modus]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.modus === 'tausch') { schritt = 'spender'; render(); return; }
        // Ein Muskel kann nicht gleichzeitig Prioritaet und Spender sein.
        Object.values(payload.volumen.prioritaet).forEach((p) => {
          if (p?.modus === 'tausch' && p.spender === konto) p.spender = null;
        });
        payload.volumen.prioritaet[konto] = { modus: 'plus' };
        delete payload.volumen.erhalt[konto];
        schritt = null;
        speichern();
      };
    });
    editor.querySelectorAll('[data-spender]').forEach((b) => {
      b.onclick = () => {
        Object.values(payload.volumen.prioritaet).forEach((p) => {
          if (p?.modus === 'tausch' && p.spender === konto) p.spender = null;
        });
        payload.volumen.prioritaet[konto] = { modus: 'tausch', spender: b.dataset.spender };
        delete payload.volumen.erhalt[konto];
        schritt = null;
        speichern();
      };
    });
    editor.querySelector('[data-zurueck]')?.addEventListener('click', () => { schritt = 'modus'; render(); });
  }

  function render() {
    const { konten, direkt, indirekt, ohneZuordnung, unbekannte, gesamt, prioritaet } = zaehleWoche(payload, woche);
    const prios = prioritaetenVon(payload);
    const erhalt = erhaltVon(payload);

    lage.textContent = gesamt === 0
      ? 'Woche ' + woche + ' · noch keine Übung gewählt'
      : 'Woche ' + woche + ' · geplant aus Level, Übungswahl und Priorität';

    if (gesamt === 0) {
      body.innerHTML = `<p class="som-hinweis">Sobald Übungen gewählt sind, steht hier,
        welcher Muskel diese Woche wie viel Arbeit bekommt.</p>`;
    } else {
      const reihen = sortiert(konten);
      const max = reihen[0].wert || 1;
      body.innerHTML = reihen.map((r) => {
        const spenderFuer = donorVon(r.konto, prios);
        const tags = [
          ...(prios[r.konto] ? ['Priorität'] : []),
          ...(erhalt[r.konto] ? ['Erhalt'] : []),
          ...(spenderFuer.length ? ['−1 für ' + spenderFuer.join(', ')] : []),
        ];
        return `<button type="button" class="som-zeile som-waehlbar${ausgewaehlt === r.konto ? ' on' : ''}" data-konto="${html(r.konto)}" aria-label="${html(r.konto)} planen">
          <span class="som-name">${zeigName(r.konto)}${tags.length ? `<small>${tags.map(html).join(' · ')}</small>` : ''}</span>
          <span class="som-track"><span class="som-fill" style="width:${(r.wert / max) * 100}%"></span></span>
        </button>`;
      }).join('')
        + (ohneZuordnung
          ? `<p class="som-hinweis">Nicht im Bild: Sätze mit einer Übung, die nicht im Katalog steht
             (${unbekannte.map((u) => `<b>${html(u)}</b>`).join(', ') || 'ohne Namen'}).</p>`
          : '');
    }
    body.querySelectorAll('[data-konto]').forEach((b) => {
      b.onclick = () => { ausgewaehlt = b.dataset.konto; schritt = null; render(); };
    });
    renderEditor({ konten, direkt, indirekt }, prioritaet);
  }

  async function speichern() {
    const rev = ++revision;
    const lokalJetzt = readLog(userId);
    writeLog(userId, payload, true, !!lokalJetzt?.replace);
    speicher.textContent = 'Auf diesem Gerät gespeichert · synchronisiert…';
    render();
    if (!navigator.onLine) {
      speicher.textContent = 'Auf diesem Gerät gespeichert · wartet auf Verbindung';
      return;
    }
    try {
      const { error } = await supabase.from('training_logs').upsert(
        { user_id: userId, payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      if (rev === revision) {
        writeLog(userId, payload, false, false);
        speicher.textContent = 'Gespeichert';
      }
    } catch (e) {
      if (rev === revision) speicher.textContent = 'Auf diesem Gerät gespeichert · Upload fehlgeschlagen';
    }
  }

  render();
}
