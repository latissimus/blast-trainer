import { supabase } from './supabase.js';
import { readLog, writeLog } from './localstore.js';
import { zaehleCycle, sortiert, zeigName } from './setometer.js';
import { KONTEN } from './katalog.js';
import {
  prioritaetenVon,
  prioSatzanzahl,
  prioReihenfolgeMoeglich,
  pumpMoeglichkeiten,
  spenderKandidaten,
} from './prioritaet.js';
import { synchronisiereTraining } from './trainingssync.js';
import { strukturellGleich } from './datenvergleich.js';

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
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Planung</span>
        <h1 class="section-title">Set-O-Meter</h1>
      </div>
      ${zurueckChip()}
    </div>
    <section class="som-einstieg" aria-label="Set-O-Meter verwenden">
      <div class="som-statuskopf">
        <p class="som-lage" id="som-lage"></p>
        <button class="som-info-knopf" id="som-info-knopf" type="button" aria-expanded="false" aria-controls="som-info">i</button>
      </div>
      <div class="som-einfach">
        <p><b>Optional:</b> Dein Plan funktioniert auch ohne Priorität.</p>
        <div class="som-ablauf" aria-label="So setzt du eine Priorität">
          <span><i>1</i>Muskel</span>
          <span><i>2</i>Sätze</span>
          <span><i>3</i>Art</span>
          <span><i>4</i>Spender</span>
        </div>
      </div>
      <div class="som-legende" aria-label="Balkenlegende">
        <span><i class="direkt"></i> Direkte Arbeit</span><span><i class="indirekt"></i> Indirekte Arbeit</span>
      </div>
    </section>
    <div class="som-kurzhilfe" id="som-info" hidden>
      <p><b>Direkte Arbeit:</b> Der Muskel ist das Hauptziel der Übung.</p>
      <p><b>Indirekte Arbeit:</b> Der Muskel arbeitet als unterstützender Nebenmuskel mit, während eine andere Muskelgruppe das Hauptziel ist – zum Beispiel der Trizeps beim Bankdrücken oder der Bizeps beim Rudern.</p>
      <p>Jeder solche Satz wird als <b>1 indirekter Satz</b> angezeigt, trägt im Vergleichsbalken aber nur <b>0,5</b> bei. So bleibt sichtbar, wie oft der Muskel mitarbeitet, ohne indirekte und direkte Belastung gleichzusetzen.</p>
    </div>
    <div class="som-liste" id="som-body">lädt…</div>
    <p class="som-speicher" id="som-speicher" aria-live="polite"></p>`;
  container.appendChild(wrap);

  const lokal = readLog(userId);
  const normalisiere = (stand) => {
    const payload = stand?.v === 4 ? stand : { v: 4, week: 1 };
    payload.volumen = { prioritaet: payload.volumen?.prioritaet || {} };
    return payload;
  };
  // Der lokale Spiegel erscheint sofort. Der Server ist nur die nachgelagerte
  // Aktualisierung; so bleibt das Meter offline und ohne leere Wartephase
  // nutzbar.
  let payload = normalisiere(lokal?.payload || {});

  let cycle = Math.min(8, Math.max(1, Number(payload.week) || 1));
  const lage = wrap.querySelector('#som-lage');
  const body = wrap.querySelector('#som-body');
  const speicher = wrap.querySelector('#som-speicher');
  const info = wrap.querySelector('#som-info');
  const infoKnopf = wrap.querySelector('#som-info-knopf');
  let ausgewaehlt = null;
  let modusOffen = false;
  let entwurfSaetze = 2;
  let revision = 0;
  let destroyed = false;

  const html = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  infoKnopf.onclick = () => {
    info.hidden = !info.hidden;
    infoKnopf.setAttribute('aria-expanded', info.hidden ? 'false' : 'true');
  };

  function statusText(ergebnis, cfg) {
    if (!ergebnis) return '';
    const n = prioSatzanzahl(cfg);
    const satz = n === 1 ? 'Satz' : 'Sätze';
    if (ergebnis.status === 'aktiv' && ergebnis.modus === 'reihenfolge')
      return 'Aktiv: zuerst in der Einheit · keine Zusatzsätze.';
    if (ergebnis.status === 'aktiv' && ergebnis.modus === 'plus')
      return `Aktiv: je +${n} ${satz} in HEAVYS sowie MIDDLES & PUMPS.`;
    if (ergebnis.status === 'aktiv')
      return `Aktiv: je +${n} Priorität und −${n} ${ergebnis.spenderName || ergebnis.spender} in HEAVYS sowie MIDDLES & PUMPS.`;
    if (ergebnis.status === 'spender-fehlt' && !cfg?.spender)
      return 'Wähle noch einen Spender aus derselben Körperhälfte.';
    if (ergebnis.status === 'spender-fehlt')
      return 'Pausiert: Der gewählte Spender ist derzeit nicht verfügbar.';
    return 'Vorgemerkt: Wähle noch die Art der Priorisierung.';
  }

  function donorVon(konto, prioErgebnisse) {
    return KONTEN.filter((ziel) => {
      const ergebnis = prioErgebnisse[ziel];
      if (ergebnis?.status !== 'aktiv' || ergebnis.modus !== 'tausch') return false;
      return ergebnis.spenderFeld?.konto === konto ||
        (!ergebnis.spenderFeld?.konto && ergebnis.spender === konto);
    });
  }

  function basisWerte() {
    return zaehleCycle({
      ...payload,
      volumen: { ...payload.volumen, prioritaet: {} },
    }, cycle);
  }

  function inlineEditor(konto, werte, prioErgebnisse) {
    const prios = prioritaetenVon(payload);
    const cfg = prios[konto];
    const satzanzahl = modusOffen ? entwurfSaetze : (cfg ? prioSatzanzahl(cfg) : entwurfSaetze);
    const ergebnis = prioErgebnisse[konto];
    const spenderFuer = donorVon(konto, prioErgebnisse);
    const hatPumpplatz = pumpMoeglichkeiten(payload, cycle, konto).length > 0;
    const nurReihenfolgeMoeglich = prioReihenfolgeMoeglich(payload, cycle, konto);
    const alleKandidaten = cfg?.modus === 'tausch'
      ? spenderKandidaten(payload, cycle, konto, basisWerte())
      : [];
    const kandidaten = alleKandidaten.slice(0, 3);
    const istGewaehlt = (k) => cfg?.spenderFeld ? cfg.spenderFeld === k.key : cfg?.spender === k.konto;
    const zeigeModus = modusOffen || !!cfg;
    const quellen = werte.indirektQuellen?.[konto] || [];

    return `<div class="som-inline-editor">
      ${quellen.length ? `<div class="som-indirekt-quellen"><span>Indirekt durch</span><div>
        ${quellen.map((q) => `<small><b>${q.saetze}×</b> ${html(q.name)}</small>`).join('')}
      </div></div>` : ''}
      ${cfg ? `<p class="som-prio-status">${html(statusText(ergebnis, cfg))}</p>` : ''}
      ${spenderFuer.length ? `<p class="som-prio-status neutral">Gibt in HEAVYS sowie MIDDLES & PUMPS ab für: <b>${spenderFuer.map((ziel) =>
        `${html(ziel)} (je ${prioSatzanzahl(prios[ziel])})`).join(', ')}</b></p>` : ''}
      <span class="som-ed-label">1 · Muskel priorisieren</span>
      <button type="button" class="som-prio-toggle${cfg ? ' on' : ''}" data-prio-toggle ${!hatPumpplatz ? ' disabled' : ''}>
        <span aria-hidden="true">${cfg ? '✓' : '○'}</span> ${cfg ? 'Priorität aktiv' : 'Als Priorität setzen'}
      </button>
      ${!hatPumpplatz ? '<p class="som-hinweis">Im Deload sind keine Prio-Slots vorgesehen.</p>' : ''}
      ${zeigeModus && hatPumpplatz ? `<div class="som-inline-plan">
        <span class="som-ed-label">2 · Zusatz je Einheit</span>
        <div class="som-modusseg som-satzwahl drei" role="group" aria-label="Zusatzsätze je Einheit">
          <button type="button" data-prio-saetze="0" class="${satzanzahl === 0 ? 'on' : ''}" ${!nurReihenfolgeMoeglich ? 'disabled' : ''}><b>Keine</b><small>nur zuerst</small></button>
          <button type="button" data-prio-saetze="1" class="${satzanzahl === 1 ? 'on' : ''}"><b>1 Satz</b><small>+2 pro Cycle</small></button>
          <button type="button" data-prio-saetze="2" class="${satzanzahl === 2 ? 'on' : ''}"><b>2 Sätze</b><small>+4 pro Cycle</small></button>
        </div>
        ${!nurReihenfolgeMoeglich ? '<p class="som-hinweis">„Nur zuerst“ ist möglich, wenn der Muskel bereits regulär in beiden passenden Einheiten vorkommt.</p>' : ''}
        ${satzanzahl > 0 ? `<span class="som-ed-label">3 · Art wählen</span>
        <div class="som-modusseg" role="group" aria-label="Art der Priorisierung">
          <button type="button" data-modus="tausch" class="${cfg?.modus === 'tausch' ? 'on' : ''}"><b>Umverteilen</b><small>je −${satzanzahl} anderswo</small></button>
          <button type="button" data-modus="plus" class="${cfg?.modus === 'plus' ? 'on' : ''}"><b>Aufschlagen</b><small>+${satzanzahl * 2} pro Cycle</small></button>
        </div>
        ${cfg?.modus === 'tausch' ? `<div class="som-spender">
          <span class="som-ed-label">4 · Spender bestätigen · meiste Cycle-Arbeit zuerst</span>
          ${kandidaten.length ? kandidaten.map((k) => `<button type="button" class="som-spender-wahl${istGewaehlt(k) ? ' on' : ''}"
            data-spender="${html(k.konto)}" data-spender-feld="${html(k.key)}" data-spender-name="${html(k.label)}">
            <span><b>${html(k.label)}</b><small>${html(k.name)}</small></span>
            <span class="som-spender-zahlen">${k.direkt} direkt · ${k.indirekt} indirekt</span>
            <em>${k.gruende.map(html).join(' · ')}</em>
          </button>`).join('') : `<p class="som-hinweis">Kein Muskel kann in beiden passenden Einheiten je ${satzanzahl} ${satzanzahl === 1 ? 'Satz' : 'Sätze'} abgeben.</p>`}
          ${alleKandidaten.length ? `<label class="som-spender-frei"><span class="som-ed-label">Oder frei wählen</span>
            <select data-spender-frei>
              <option value="">Muskel auswählen…</option>
              ${alleKandidaten.map((k) => `<option value="${html(k.key)}" data-konto="${html(k.konto)}" data-name="${html(k.label)}"${istGewaehlt(k) ? ' selected' : ''}>${html(k.label)} · ${html(k.name)}</option>`).join('')}
            </select>
          </label>` : ''}
        </div>` : ''}` : ''}
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
        <span class="som-zeile-fuss">
          <span class="som-wert"><small>Direkt</small><b>${direkt}</b></span>
          <span class="som-wert"><small>Indirekt</small><b>${indirekt}</b></span>
          <span class="som-pfeil" aria-hidden="true">⌄</span>
        </span>
      </button>
      ${offen ? inlineEditor(r.konto, werte, prioErgebnisse) : ''}
    </div>`;
  }

  function render() {
    const werte = zaehleCycle(payload, cycle);
    const { konten, ohneZuordnung, unbekannte, gesamt, prioritaet } = werte;
    const prios = prioritaetenVon(payload);
    const aktiv = Object.keys(prios).filter((k) => prios[k]).length;
    lage.innerHTML = `
      <span class="som-stat"><small>Cycle</small><b>${cycle >= 8 ? 'Deload' : cycle}</b></span>
      <span class="som-stat"><small>Prioritäten</small><b>${aktiv}</b></span>`;

    const sortiertNachVolumen = sortiert(konten);
    const priorisiert = Object.keys(prios)
      .map((konto) => sortiertNachVolumen.find((r) => r.konto === konto))
      .filter(Boolean);
    const uebrig = sortiertNachVolumen.filter((r) => !prios[r.konto]);
    const max = Math.max(1, ...sortiertNachVolumen.map((r) =>
      (werte.direkt[r.konto] || 0) + (werte.indirekt[r.konto] || 0) * .5));

    const gruppe = (titel, reihen, klasse = '') => reihen.length
      ? `<p class="som-gruppe${klasse ? ` ${klasse}` : ''}">${titel}</p>${reihen.map((r) => reihe(r, max, werte, prioritaet, prios)).join('')}`
      : '';
    body.innerHTML = (gesamt === 0
      ? '<p class="som-hinweis som-hinweis-oben">Ohne Übung · Priorität trotzdem möglich.</p>'
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
        entwurfSaetze = 2;
        render();
      }
    });
    body.querySelectorAll('[data-prio-saetze]').forEach((b) => {
      b.onclick = () => {
        const wert = Number(b.dataset.prioSaetze);
        const saetze = wert === 0 ? 0 : (wert === 1 ? 1 : 2);
        const cfg = prios[ausgewaehlt];
        if (saetze === 0) {
          payload.volumen.prioritaet[ausgewaehlt] = { modus: 'reihenfolge', saetze: 0 };
          modusOffen = false;
          speichern(!cfg);
          return;
        }
        if (!cfg) {
          entwurfSaetze = saetze;
          render();
          return;
        }
        if (cfg.modus === 'reihenfolge') {
          entwurfSaetze = saetze;
          modusOffen = true;
          render();
          return;
        }
        cfg.saetze = saetze;
        speichern();
      };
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
            modus: 'tausch',
            saetze: prioSatzanzahl(alt || { saetze: entwurfSaetze }),
            spender: alt?.modus === 'tausch' ? (alt.spender || null) : null,
            spenderFeld: alt?.modus === 'tausch' ? (alt.spenderFeld || null) : null,
            spenderName: alt?.modus === 'tausch' ? (alt.spenderName || null) : null,
          };
        } else payload.volumen.prioritaet[ausgewaehlt] = {
          modus: 'plus',
          saetze: prioSatzanzahl(payload.volumen.prioritaet[ausgewaehlt] || { saetze: entwurfSaetze }),
        };
        modusOffen = false;
        speichern(springtNachOben);
      };
    });
    const spenderSetzen = (spender, spenderFeld, spenderName) => {
      Object.values(payload.volumen.prioritaet).forEach((p) => {
        if (p?.modus === 'tausch' && p.spender === ausgewaehlt) p.spender = null;
      });
      payload.volumen.prioritaet[ausgewaehlt] = {
        modus: 'tausch',
        saetze: prioSatzanzahl(payload.volumen.prioritaet[ausgewaehlt]),
        spender, spenderFeld, spenderName,
      };
      speichern();
    };
    body.querySelectorAll('[data-spender]').forEach((b) => {
      b.onclick = () => spenderSetzen(b.dataset.spender, b.dataset.spenderFeld, b.dataset.spenderName);
    });
    body.querySelector('[data-spender-frei]')?.addEventListener('change', (e) => {
      const option = e.target.selectedOptions[0];
      if (option?.value) spenderSetzen(option.dataset.konto, option.value, option.dataset.name);
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
    await synchronisiereTraining(userId, payload, (status) => {
      if (rev !== revision) return;
      if (status === 'saving') speicher.textContent = 'Auf diesem Gerät gespeichert · synchronisiert…';
      if (status === 'saved') speicher.textContent = 'Gespeichert';
      if (status === 'offline') speicher.textContent = 'Auf diesem Gerät gespeichert · wartet auf Verbindung';
      if (status === 'error') speicher.textContent = 'Auf diesem Gerät gespeichert · Upload fehlgeschlagen';
    });
  }

  render();

  // Einen sauberen lokalen Stand im Hintergrund aktualisieren. Beginnt der
  // Nutzer vorher mit einer Änderung, darf eine langsamere Serverantwort diese
  // lokale Eingabe nicht mehr überschreiben.
  if (!lokal?.dirty && navigator.onLine) {
    const startRevision = revision;
    supabase
      .from('training_logs').select('payload').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (error || destroyed || revision !== startRevision || !data?.payload) return;
        if (strukturellGleich(data.payload, payload)) return;
        payload = normalisiere(data.payload);
        cycle = Math.min(8, Math.max(1, Number(payload.week) || 1));
        writeLog(userId, payload, false, false);
        render();
      })
      .catch(() => {});
  }

  return {
    destroy() {
      destroyed = true;
    },
  };
}
