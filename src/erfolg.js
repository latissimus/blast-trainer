import { supabase } from './supabase.js';
import { toast } from './log.js';
import { kurveSvg } from './kurve.js';
import { FALTEN, zahl, summe, heute, datumKurz, schnitt7 } from './messung.js';

// ---- Laden und Speichern ---------------------------------------------------

export async function ladeFalten(userId, limit = 60) {
  const { data, error } = await supabase
    .from('skinfolds').select('gemessen_am, falten')
    .eq('user_id', userId).order('gemessen_am', { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ datum: r.gemessen_am, falten: r.falten, summe: summe(r.falten) }));
}

export async function speichereFalten(userId, falten, datum = heute()) {
  const { error } = await supabase.from('skinfolds')
    .upsert({ user_id: userId, gemessen_am: datum, falten }, { onConflict: 'user_id,gemessen_am' });
  if (error) throw error;
}

export async function ladeGewichte(userId, limit = 180) {
  const { data, error } = await supabase
    .from('weights').select('gemessen_am, kg')
    .eq('user_id', userId).order('gemessen_am', { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({ datum: r.gemessen_am, kg: Number(r.kg) }));
}

export async function speichereGewicht(userId, kg, datum = heute()) {
  const { error } = await supabase.from('weights')
    .upsert({ user_id: userId, gemessen_am: datum, kg }, { onConflict: 'user_id,gemessen_am' });
  if (error) throw error;
}

// Beide Reihen leeren. Bewusst nacheinander und mit Fehlerabbruch: Bliebe eine
// der beiden stehen, saehe man eine halb geleerte Erfolgskontrolle und wuesste
// nicht, warum. Trainingsdaten liegen in anderen Tabellen und bleiben unberuehrt.
export async function loescheAlleMessungen(userId) {
  const sf = await supabase.from('skinfolds').delete().eq('user_id', userId);
  if (sf.error) throw sf.error;
  const wt = await supabase.from('weights').delete().eq('user_id', userId);
  if (wt.error) throw wt.error;
}


const delta = (neu, alt, einheit, kleinerIstBesser = true) => {
  if (alt == null || neu == null) return '';
  const d = Math.round((neu - alt) * 10) / 10;
  if (d === 0) return `<span class="delta d-hold">= gehalten</span>`;
  const gut = kleinerIstBesser ? d < 0 : d > 0;
  return `<span class="delta ${gut ? 'd-up' : 'd-down'}">${d < 0 ? '▼' : '▲'} ${Math.abs(d).toString().replace('.', ',')} ${einheit}</span>`;
};

export function mountErfolg(wrap, { session, profile, onProfileUpdated }) {
  const uid = session.user.id;

  // ---------------------------------------------------------------- Hautfalten
  const sfCard = document.createElement('div');
  sfCard.className = 'card';
  sfCard.innerHTML = `<h2 class="section-title" style="font-size:18px;margin:0 0 12px">Hautfalten</h2>
    <div class="mess-kopf" id="sf-kopf">lädt…</div>
    <div id="sf-kurve"></div>
    <details class="mess-neu"><summary>Neue Messung</summary><div id="sf-form"></div></details>
    <details class="mess-neu"><summary>Worauf achten?</summary>
      <p class="mess-hinweis">Nur vergleichbar bei <b>gleicher Person</b>, <b>gleicher Tageszeit</b> und
        <b>gleichem Zustand</b> (nüchtern, vor dem Training). Sonst misst du Schwankung statt Fortschritt.</p>
    </details>
    <details class="mess-neu"><summary>Erinnerung</summary><div id="sf-einst"></div></details>`;
  wrap.appendChild(sfCard);

  // ------------------------------------------------------------------ Gewicht
  const wtCard = document.createElement('div');
  wtCard.className = 'card';
  wtCard.innerHTML = `<h2 class="section-title" style="font-size:18px;margin:0 0 12px">Gewicht</h2>
    <div class="mess-kopf" id="wt-kopf">lädt…</div>
    <div id="wt-kurve"></div>
    <div id="wt-form"></div>`;
  wrap.appendChild(wtCard);

  // ---- Hautfalten: Anzeige ----
  async function zeigeFalten() {
    let reihe = [];
    try { reihe = await ladeFalten(uid); } catch (e) { sfCard.querySelector('#sf-kopf').innerHTML = `<div class="msg err">${e.message}</div>`; return; }
    const gueltig = reihe.filter((r) => r.summe != null);
    const letzte = gueltig[gueltig.length - 1];
    const davor = gueltig[gueltig.length - 2];

    sfCard.querySelector('#sf-kopf').innerHTML = letzte
      ? `<div class="mess-wert">${letzte.summe.toString().replace('.', ',')} <span>mm</span>
           ${delta(letzte.summe, davor?.summe, 'mm')}</div>
         <div class="mess-datum">gemessen am ${datumKurz(letzte.datum)}</div>`
      : `<div class="mess-leer">Noch keine Messung.</div>`;

    sfCard.querySelector('#sf-kurve').innerHTML = kurveSvg(
      [{ werte: gueltig.map((r) => ({ datum: r.datum, wert: r.summe })), klasse: 'trend', punkte: true }],
      { einheit: 'mm' },
    );
  }

  // ---- Hautfalten: Eingabe ----
  const form = sfCard.querySelector('#sf-form');
  form.innerHTML = `<div class="falten-grid">
      ${FALTEN.map(([k, label]) => `<label class="falte"><span>${label}</span>
        <input class="input falte-in" data-k="${k}" type="text" inputmode="decimal" placeholder="–"></label>`).join('')}
    </div>
    <div class="falten-summe" id="sf-live">Summe <b>—</b></div>
    <button class="btn btn-primary btn-block" id="sf-save">Messung speichern</button>`;

  const felder = [...form.querySelectorAll('.falte-in')];
  const liveSumme = () => {
    const obj = {}; felder.forEach((f) => { obj[f.dataset.k] = f.value; });
    const s = summe(obj);
    const fehlen = felder.filter((f) => zahl(f.value) === null).length;
    // Alle zwoelf sind Pflicht: Fehlt eine, ist die Summe nicht mit frueheren
    // vergleichbar. Lieber gar keine Zahl als eine falsche.
    form.querySelector('#sf-live').innerHTML = s != null
      ? `Summe <b>${s.toString().replace('.', ',')} mm</b>`
      : `Summe <b>—</b> <span class="mess-fehlt">noch ${fehlen} von 12</span>`;
    form.querySelector('#sf-save').disabled = s == null;
    return s;
  };
  felder.forEach((f) => (f.oninput = liveSumme));
  liveSumme();

  form.querySelector('#sf-save').onclick = async () => {
    const obj = {}; felder.forEach((f) => { obj[f.dataset.k] = zahl(f.value); });
    if (summe(obj) == null) return;
    const btn = form.querySelector('#sf-save'); btn.disabled = true;
    try {
      await speichereFalten(uid, obj);
      felder.forEach((f) => (f.value = ''));
      liveSumme();
      sfCard.querySelector('.mess-neu').open = false;
      await zeigeFalten();
      toast('Messung gespeichert');
    } catch (e) {
      toast('Speichern fehlgeschlagen');
      btn.disabled = false;
    }
  };

  // ---- Hautfalten: Erinnerung ----
  const einst = sfCard.querySelector('#sf-einst');
  einst.innerHTML = `<div class="mess-einst">
      <label class="mess-zeile"><span>Erinnerung</span>
        <input type="checkbox" id="sf-an" ${profile.falten_erinnerung ? 'checked' : ''}></label>
      <label class="mess-zeile"><span>alle</span>
        <select class="input" id="sf-int" style="margin:0;width:auto">
          ${[1, 2, 3, 4].map((w) => `<option value="${w}" ${profile.falten_intervall_wochen === w ? 'selected' : ''}>${w} Woche${w > 1 ? 'n' : ''}</option>`).join('')}
        </select></label>
      <label class="mess-zeile"><span>um</span>
        <input class="input" id="sf-zeit" type="time" style="margin:0;width:auto" value="${(profile.falten_uhrzeit || '08:00').slice(0, 5)}"></label>
    </div>`;

  const speichereEinst = async () => {
    const werte = {
      falten_erinnerung: einst.querySelector('#sf-an').checked,
      falten_intervall_wochen: Number(einst.querySelector('#sf-int').value),
      falten_uhrzeit: einst.querySelector('#sf-zeit').value || '08:00',
      // Zeitzone des Geraets mitschicken: Der Wecker laeuft serverseitig in UTC,
      // und "8 Uhr" heisst je nach Ort etwas anderes.
      zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin',
    };
    const { error } = await supabase.from('profiles').update(werte).eq('id', uid);
    if (error) { toast('Einstellung nicht gespeichert'); return; }
    Object.assign(profile, werte);
    onProfileUpdated?.(profile);
  };
  einst.querySelectorAll('input, select').forEach((el) => (el.onchange = speichereEinst));

  // ---- Gewicht ----
  const wtForm = wtCard.querySelector('#wt-form');
  wtForm.innerHTML = `<div class="gew-eingabe">
      <input class="input" id="wt-in" type="text" inputmode="decimal" placeholder="84,2" style="margin:0">
      <span class="gew-einheit">kg</span>
      <button class="btn btn-primary" id="wt-save">Heute</button>
    </div>`;

  async function zeigeGewicht() {
    let reihe = [];
    try { reihe = await ladeGewichte(uid); } catch (e) { wtCard.querySelector('#wt-kopf').innerHTML = `<div class="msg err">${e.message}</div>`; return; }
    const trend = schnitt7(reihe);
    const letzterTrend = trend[trend.length - 1];
    // Vergleich gegen den Schnitt von vor 7 Tagen, nicht gegen den Vortag:
    // Tageswerte schwanken staerker als der Fortschritt einer Woche.
    const wocheZuvor = trend.find((t) => {
      const tage = (iso) => Math.floor(new Date(iso + 'T12:00:00').getTime() / 86400000);
      return letzterTrend && tage(letzterTrend.datum) - tage(t.datum) <= 7;
    });

    wtCard.querySelector('#wt-kopf').innerHTML = letzterTrend
      ? `<div class="mess-wert">${letzterTrend.kg.toFixed(1).replace('.', ',')} <span>kg</span>
           ${delta(letzterTrend.kg, wocheZuvor && wocheZuvor !== letzterTrend ? wocheZuvor.kg : null, 'kg')}</div>
         <div class="mess-datum">7-Tage-Schnitt · zuletzt gewogen ${datumKurz(reihe[reihe.length - 1].datum)}</div>`
      : `<div class="mess-leer">Noch kein Gewicht eingetragen.</div>`;

    wtCard.querySelector('#wt-kurve').innerHTML = kurveSvg([
      { werte: reihe.map((r) => ({ datum: r.datum, wert: r.kg })), klasse: 'roh' },
      { werte: trend.map((r) => ({ datum: r.datum, wert: r.kg })), klasse: 'trend' },
    ], { einheit: 'kg' });

    const heutigerWert = reihe.find((r) => r.datum === heute());
    if (heutigerWert) wtForm.querySelector('#wt-in').value = heutigerWert.kg.toFixed(1).replace('.', ',');
  }

  wtForm.querySelector('#wt-save').onclick = async () => {
    const kg = zahl(wtForm.querySelector('#wt-in').value);
    if (kg == null || kg <= 0 || kg >= 500) { toast('Bitte ein Gewicht in kg eintragen'); return; }
    const btn = wtForm.querySelector('#wt-save'); btn.disabled = true;
    try { await speichereGewicht(uid, kg); await zeigeGewicht(); toast('Gewicht gespeichert'); }
    catch (e) { toast('Speichern fehlgeschlagen'); }
    btn.disabled = false;
  };

  // ---- Alles zuruecksetzen ----
  // Gelb wie der Phasen-Reset im Log – dieselbe Geste, dieselbe Warnfarbe.
  const resetBtn = document.createElement('button');
  resetBtn.className = 'phase-reset';
  resetBtn.style.marginTop = '18px';
  resetBtn.textContent = 'Messdaten zurücksetzen';
  resetBtn.onclick = async () => {
    if (!confirm('ALLE Hautfalten- und Gewichts-Messungen löschen?\n\nDie Kurven und Werte starten danach leer. Deine Trainingsdaten bleiben unberührt.')) return;
    resetBtn.disabled = true;
    try {
      await loescheAlleMessungen(uid);
      wtForm.querySelector('#wt-in').value = '';
      await zeigeFalten();
      await zeigeGewicht();
      toast('Messdaten zurückgesetzt');
    } catch (e) {
      toast('Zurücksetzen fehlgeschlagen');
    }
    resetBtn.disabled = false;
  };
  wrap.appendChild(resetBtn);

  zeigeFalten();
  zeigeGewicht();
}
