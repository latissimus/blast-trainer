import { supabase } from './supabase.js';
import { readLog, writeLog } from './localstore.js';
import { zaehleWoche, sortiert, zeigName } from './setometer.js';
import { KONTEN } from './katalog.js';
import {
  prioritaetenVon,
  pumpMoeglichkeiten,
  spenderKandidaten,
} from './prioritaet.js';

// Der Pfeil steht aufrecht in Monospace – wie in der unteren Bedienleiste.
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
    <div class="som-statuskopf">
      <p class="som-lage" id="som-lage"></p>
      <button class="som-info-knopf" id="som-info-knopf" type="button" aria-expanded="false" aria-controls="som-info">i</button>
    </div>
    <div class="som-kurzhilfe" id="som-info" hidden>
      Das Meter zeigt dein geplantes Wochenvolumen. Tippe einen Muskel an, um ihn direkt hier zu priorisieren.
      Indirekte Arbeit wird mit 0,5 gewichtet.
    </div>
    <div class="som-legende" aria-label="Balkenlegende">
      <span><i class="direkt"></i> Direkte Arbeit</span><span><i class="indirekt"></i> Indirekte Arbeit</span>
    </div>
    <div class="som-liste" id="som-body">lädt…</div>
    <p class="som-speicher" id="som-speicher" aria-live="polite"></p>`;
  container.appendChild(wrap);

  let payload = null;
  const lokal = readLog(userId);
  if (lokal?.payload) payload = lokal.payload;
  else {
    try {
      const { data } = await supabase
        .from('training_logs').select('payload').eq('user_id', userId).maybeSingle();
      payload = data?.payload || {};
    } catch (e) {
      payload = {};
    }
  }
  payload.volumen = { prioritaet: payload.volumen?.prioritaet || {} };

  const woche = Math.min(7, Math.max(1, Number(payload.week) || 1));
  const lage = wrap.querySelector('#som-lage');
  const body = wrap.querySelector('#som-body');
  const speicher = wrap.querySelector('#som-speicher');
  const info = wrap.querySelector('#som-info');
  const infoKnopf = wrap.querySelector('#som-info-knopf');
  let ausgewaehlt = null;
  let modusOffen = false;
  let revision = 0;

  const html = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  infoKnopf.onclick = () => {
    info.hidden = !info.hidden;
    infoKnopf.setAttribute('aria-expanded', info.hidden ? 'false' : 'true');
  };

  function statusText(ergebnis, cfg) {
    if (!ergebnis) return '';
    if (ergebnis.status === 'aktiv' && ergebnis.vorgemerkt && ergebnis.modus === 'plus')
      return 'Aktiv: Der Zusatzsatz steht im passenden Pumpfeld bereit; die Übung kannst du später wählen.';
    if (ergebnis.status === 'aktiv' && ergebnis.vorgemerkt)
      return `Aktiv vorgemerkt: +1 im Pumpfeld, −1 ${ergebnis.spender} in derselben Einheit.`;
    if (ergebnis.status === 'aktiv' && ergebnis.modus === 'plus')
      return `Aktiv: +1 Satz bei ${ergebnis.zielFeld.mus}.`;
    if (ergebnis.status === 'aktiv')
      return `Aktiv: +1 bei ${ergebnis.zielFeld.mus}, −1 ${ergebnis.spender} in derselben Einheit.`;
    if (ergebnis.status === 'spender-fehlt' && !cfg?.spender)
      return 'Wähle noch einen Pump-Spender aus derselben Einheit.';
    if (ergebnis.status === 'spender-fehlt')
      return 'Pausiert: Der gewählte Spender ist derzeit nicht verfügbar.';
    return 'Vorgemerkt: Die Priorität greift, sobald die passende Pump-Übung gewählt ist.';
  }

  function donorVon(konto, prios) {
    return KONTEN.filter((ziel) => prios[ziel]?.modus === 'tausch' && prios[ziel]?.spender === konto);
  }

  function basisWerte() {
    return zaehleWoche({
      ...payload,
      volumen: { ...payload.volumen, prioritaet: {} },
    }, woche);
  }

  function inlineEditor(konto, werte, prioErgebnisse) {
    const prios = prioritaetenVon(payload);
    const cfg = prios[konto];
    const ergebnis = prioErgebnisse[konto];
    const spenderFuer = donorVon(konto, prios);
    const hatPumpplatz = pumpMoeglichkeiten(payload, woche, konto).length > 0;
    const kandidaten = cfg?.modus === 'tausch'
      ? spenderKandidaten(payload, woche, konto, basisWerte()).slice(0, 3)
      : [];
    const zeigeModus = modusOffen || !!cfg;

    return `<div class="som-inline-editor">
      ${cfg ? `<p class="som-prio-status">${html(statusText(ergebnis, cfg))}</p>` : ''}
      ${spenderFuer.length ? `<p class="som-prio-status neutral">Gibt je 1 Satz ab für: <b>${spenderFuer.map(html).join(', ')}</b></p>` : ''}
      <button type="button" class="som-prio-toggle${cfg ? ' on' : ''}" data-prio-toggle ${!hatPumpplatz ? ' disabled' : ''}>
        <span aria-hidden="true">${cfg ? '✓' : '○'}</span> ${cfg ? 'Priorität aktiv' : 'Als Priorität setzen'}
      </button>
      ${!hatPumpplatz ? '<p class="som-hinweis">Für diesen Muskel gibt es in dieser Woche keinen regulären Pumpplatz.</p>' : ''}
      ${zeigeModus && hatPumpplatz ? `<div class="som-inline-plan">
        <span class="som-ed-label">Zusatzsatz planen</span>
        <div class="som-modusseg" role="group" aria-label="Art der Priorisierung">
          <button type="button" data-modus="tausch" class="${cfg?.modus === 'tausch' ? 'on' : ''}"><b>Umverteilen</b><small>−1 anderswo</small></button>
          <button type="button" data-modus="plus" class="${cfg?.modus === 'plus' ? 'on' : ''}"><b>Aufschlagen</b><small>+1 gesamt</small></button>
        </div>
        ${cfg?.modus === 'tausch' ? `<div class="som-spender">
          <span class="som-ed-label">Bis zu 3 sinnvolle Vorschläge</span>
          ${kandidaten.length ? kandidaten.map((k) => `<button type="button" class="som-spender-wahl${cfg.spender === k.konto ? ' on' : ''}" data-spender="${html(k.konto)}">
            <span><b>${html(k.konto)}</b><small>${html(k.name)}</small></span>
            <span class="som-spender-zahlen">${k.direkt} direkt · ${k.indirekt} indirekt</span>
            <em>${k.gruende.map(html).join(' · ')}</em>
          </button>`).join('') : '<p class="som-hinweis">Kein verfügbares, nicht priorisiertes Pumpfeld in derselben Einheit.</p>'}
        </div>` : ''}
      </div>` : ''}
    </div>`;
  }

  function reihe(r, max, werte, prioErgebnisse, prios) {
    const direkt = werte.direkt[r.konto] || 0;
    const indirekt = werte.indirekt[r.konto] || 0;
    const direktBreite = (direkt / max) * 100;
    const indirektBreite = ((indirekt * .5) / max) * 100;
    const prio = !!prios[r.konto];
    const offen = ausgewaehlt === r.konto;
    return `<div class="som-muskel${prio ? ' priorisiert' : ''}${offen ? ' offen' : ''}">
      <button type="button" class="som-zeile" data-konto="${html(r.konto)}" aria-expanded="${offen ? 'true' : 'false'}">
        <span class="som-zeile-kopf"><span class="som-name">${html(zeigName(r.konto))}</span>${prio ? '<span class="som-prio-marke">Priorität</span>' : ''}</span>
        <span class="som-track"><span class="som-fill-direkt" style="width:${direktBreite}%"></span><span class="som-fill-indirekt" style="width:${indirektBreite}%"></span></span>
        <span class="som-zeile-fuss"><span class="som-zahlen"><b>${direkt}</b> direkt · <b>${indirekt}</b> indirekt</span><span class="som-pfeil" aria-hidden="true">⌄</span></span>
      </button>
      ${offen ? inlineEditor(r.konto, werte, prioErgebnisse) : ''}
    </div>`;
  }

  function render() {
    const werte = zaehleWoche(payload, woche);
    const { konten, ohneZuordnung, unbekannte, gesamt, prioritaet } = werte;
    const prios = prioritaetenVon(payload);
    const aktiv = Object.keys(prios).filter((k) => prios[k]).length;
    const gesamtText = (Math.round(gesamt * 10) / 10).toString().replace('.', ',');
    lage.innerHTML = `
      <span class="som-stat"><small>Woche</small><b>${woche}</b></span>
      <span class="som-stat"><small>Prioritäten</small><b>${aktiv}</b></span>
      <span class="som-stat"><small>Volumen</small><b>${gesamtText}</b></span>`;

    const sortiertNachVolumen = sortiert(konten);
    const priorisiert = sortiertNachVolumen.filter((r) => prios[r.konto]);
    const uebrig = sortiertNachVolumen.filter((r) => !prios[r.konto]);
    const max = Math.max(1, ...sortiertNachVolumen.map((r) =>
      (werte.direkt[r.konto] || 0) + (werte.indirekt[r.konto] || 0) * .5));

    const gruppe = (titel, reihen, klasse = '') => reihen.length
      ? `<p class="som-gruppe${klasse ? ` ${klasse}` : ''}">${titel}</p>${reihen.map((r) => reihe(r, max, werte, prioritaet, prios)).join('')}`
      : '';
    body.innerHTML = (gesamt === 0
      ? '<p class="som-hinweis som-hinweis-oben">Noch keine Übung gewählt. Prioritäten kannst du trotzdem bereits festlegen.</p>'
      : '') + gruppe('Priorisiert', priorisiert, 'prio') + gruppe(priorisiert.length ? 'Alle Muskeln' : 'Muskeln', uebrig)
      + (ohneZuordnung ? `<p class="som-hinweis">Nicht zugeordnet: ${unbekannte.map((u) => `<b>${html(u)}</b>`).join(', ') || 'Übung ohne Namen'}.</p>` : '');

    body.querySelectorAll('[data-konto]').forEach((b) => {
      b.onclick = () => {
        const konto = b.dataset.konto;
        ausgewaehlt = ausgewaehlt === konto ? null : konto;
        modusOffen = false;
        render();
      };
    });
    body.querySelector('[data-prio-toggle]')?.addEventListener('click', () => {
      const cfg = prios[ausgewaehlt];
      if (cfg) {
        delete payload.volumen.prioritaet[ausgewaehlt];
        modusOffen = false;
        speichern();
      } else {
        modusOffen = true;
        render();
      }
    });
    body.querySelectorAll('[data-modus]').forEach((b) => {
      b.onclick = () => {
        const springtNachOben = !payload.volumen.prioritaet[ausgewaehlt];
        Object.values(payload.volumen.prioritaet).forEach((p) => {
          if (p?.modus === 'tausch' && p.spender === ausgewaehlt) p.spender = null;
        });
        if (b.dataset.modus === 'tausch') {
          const alt = payload.volumen.prioritaet[ausgewaehlt];
          payload.volumen.prioritaet[ausgewaehlt] = {
            modus: 'tausch', spender: alt?.modus === 'tausch' ? (alt.spender || null) : null,
          };
        } else payload.volumen.prioritaet[ausgewaehlt] = { modus: 'plus' };
        modusOffen = false;
        speichern(springtNachOben);
      };
    });
    body.querySelectorAll('[data-spender]').forEach((b) => {
      b.onclick = () => {
        Object.values(payload.volumen.prioritaet).forEach((p) => {
          if (p?.modus === 'tausch' && p.spender === ausgewaehlt) p.spender = null;
        });
        payload.volumen.prioritaet[ausgewaehlt] = { modus: 'tausch', spender: b.dataset.spender };
        speichern();
      };
    });
  }

  async function speichern(scrollAusgleich = false) {
    const vorherTop = scrollAusgleich
      ? body.querySelector('.som-muskel.offen')?.getBoundingClientRect().top
      : null;
    const rev = ++revision;
    const lokalJetzt = readLog(userId);
    writeLog(userId, payload, true, !!lokalJetzt?.replace);
    speicher.textContent = 'Auf diesem Gerät gespeichert · synchronisiert…';
    render();
    // Wird die offene Box durch ihre neue Prioritaet an den Listenanfang
    // sortiert, folgt der Viewport um genau dieselbe Strecke nach oben.
    if (Number.isFinite(vorherTop)) requestAnimationFrame(() => {
      const nachher = body.querySelector('.som-muskel.offen');
      if (!nachher) return;
      const delta = nachher.getBoundingClientRect().top - vorherTop;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: 'smooth' });
    });
    if (!navigator.onLine) {
      speicher.textContent = 'Auf diesem Gerät gespeichert · wartet auf Verbindung';
      return;
    }
    try {
      const { error } = await supabase.from('training_logs').upsert(
        { user_id: userId, payload, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
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
