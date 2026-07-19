import { supabase } from './supabase.js';
import { zurueckChip } from './meter.js';

// Notizbuch: freie Notizen mit Links und Bildern.
//
// Der einzige Ort in der App, an dem etwas den Phasen-Reset ueberlebt. Darum
// liegt es in einer eigenen Tabelle (public.notizen) statt im Payload – siehe
// die Migration, dort steht die ausfuehrliche Begruendung.
//
// Bewusst KEIN local-first wie das Log: Notizen schreibt man am Schreibtisch,
// nicht zwischen zwei Saetzen im Funkloch. Der Aufwand eines zweiten
// Spiegels samt Zusammenfuehrung waere hier nicht bezahlt.

const BUCKET = 'notizbuch';
const MAX_KANTE = 1600;        // Langkante nach dem Verkleinern
const MAX_BILDER = 12;         // pro Notiz

// ---- Bilder ----------------------------------------------------------------

// Vor dem Hochladen verkleinern. Ein iPhone-Foto sind 3–5 MB; auf einer
// Notizseite will man davon nichts sehen ausser dem Bild. Das spart Upload-Zeit
// im Training und Platz im Bucket.
function verkleinern(datei) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(new Error('Datei nicht lesbar'));
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => fehler(new Error('Kein gültiges Bild'));
      bild.onload = () => {
        const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bild.width * faktor);
        c.height = Math.round(bild.height * faktor);
        c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? fertig(b) : fehler(new Error('Umwandeln fehlgeschlagen'))), 'image/jpeg', 0.82);
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

// Der Bucket ist privat, also braucht jedes Bild einen signierten Link.
// Eine Stunde reicht weit ueber jede Sitzung hinaus.
async function signiere(pfade) {
  if (!pfade.length) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(pfade, 3600);
  const map = {};
  (data || []).forEach((e) => { if (e.signedUrl) map[e.path] = e.signedUrl; });
  return map;
}

// ---- Text ------------------------------------------------------------------

const escape = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// URLs klickbar machen. Bewusst nach dem Escapen: Sonst wuerde ein <script> im
// Notiztext als Auszeichnung durchgehen. Erst entschaerfen, dann verlinken.
//
// rel="noopener noreferrer": Ohne das kann die Zielseite ueber window.opener
// auf unseren Tab zugreifen.
export function verlinke(text) {
  return escape(text)
    .replace(/(https?:\/\/[^\s<]+)/g, (u) => {
      const sauber = u.replace(/[.,;:!?)]+$/, '');       // Satzzeichen gehoeren nicht zum Link
      const rest = u.slice(sauber.length);
      return `<a href="${sauber}" target="_blank" rel="noopener noreferrer">${sauber}</a>${rest}`;
    })
    .replace(/\n/g, '<br>');
}

// ---- Seite -----------------------------------------------------------------

export async function mountNotizbuch(container, { userId }) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <h1 class="section-title">📒 Notizbuch</h1>
      ${zurueckChip()}
    </div>
    <button class="btn btn-primary btn-block" id="nb-neu">+ Neue Notiz</button>
    <div id="nb-liste"><p class="som-hinweis">lädt…</p></div>`;
  container.appendChild(wrap);

  const liste = wrap.querySelector('#nb-liste');
  let notizen = [];

  async function laden() {
    const { data, error } = await supabase
      .from('notizen').select('*').order('updated_at', { ascending: false });
    if (error) { liste.innerHTML = `<div class="msg err">${escape(error.message)}</div>`; return; }
    notizen = data || [];
    await zeichne();
  }

  async function zeichne() {
    if (!notizen.length) {
      liste.innerHTML = `<p class="som-hinweis">Noch nichts notiert. Platz für Links, Screenshots,
        Gedanken zur Technik — bleibt beim Start einer neuen Phase erhalten.</p>`;
      return;
    }
    const alle = notizen.flatMap((n) => n.bilder || []);
    const urls = await signiere(alle);
    liste.innerHTML = notizen.map((n) => karte(n, urls)).join('');
    notizen.forEach((n) => verdrahte(n));
  }

  function karte(n, urls) {
    const bilder = (n.bilder || [])
      .map((p) => (urls[p] ? `<img class="nb-bild" src="${urls[p]}" alt="" data-pfad="${p}">` : ''))
      .join('');
    return `
      <div class="card nb-karte" data-id="${n.id}">
        <div class="nb-kopf">
          <b class="nb-titel">${escape(n.titel) || '<i>Ohne Titel</i>'}</b>
          <span class="nb-akt">
            <button class="chip nb-edit">Bearbeiten</button>
            <button class="chip nb-weg">Löschen</button>
          </span>
        </div>
        ${n.text ? `<p class="nb-text">${verlinke(n.text)}</p>` : ''}
        ${bilder ? `<div class="nb-bilder">${bilder}</div>` : ''}
      </div>`;
  }

  function verdrahte(n) {
    const el = liste.querySelector(`[data-id="${n.id}"]`);
    if (!el) return;
    el.querySelector('.nb-edit').onclick = () => bearbeiten(n);
    el.querySelector('.nb-weg').onclick = () => loeschen(n);
  }

  // Bearbeiten ersetzt die Karte an Ort und Stelle. Kein Dialog: Das Notizbuch
  // ist die einzige Seite, auf der man laengeren Text tippt – dafuer will man
  // den ganzen Bildschirm, nicht ein Fenster darin.
  async function bearbeiten(n) {
    const el = liste.querySelector(`[data-id="${n.id}"]`);
    const urls = await signiere(n.bilder || []);
    // Felder in der Hausform (.fld-l + .input) statt eigener: Das Profil sieht
    // schon so aus, und ein zweites Formular-Aussehen in derselben App waere
    // eine Erfindung ohne Anlass.
    el.innerHTML = `
      <label class="fld-l">Titel</label>
      <input class="input nb-in-titel" value="${escape(n.titel)}" placeholder="Worum geht es?" maxlength="120">
      <label class="fld-l">Text</label>
      <textarea class="input nb-in-text" rows="10" placeholder="Gedanken, Links, Cues…">${escape(n.text)}</textarea>
      <div class="nb-bilder nb-bilder-edit">
        ${(n.bilder || []).map((p) => `
          <span class="nb-slot">
            <img class="nb-bild" src="${urls[p] || ''}" alt="">
            <button class="nb-bildweg" data-pfad="${p}" aria-label="Bild entfernen">×</button>
          </span>`).join('')}
      </div>
      <label class="chip nb-upload">+ Bild
        <input type="file" accept="image/*" hidden multiple></label>
      <button class="btn btn-primary btn-block nb-ok">Sichern</button>
      <button class="btn btn-block nb-ab">Abbrechen</button>`;

    const titelIn = el.querySelector('.nb-in-titel');
    const textIn = el.querySelector('.nb-in-text');
    let bilder = [...(n.bilder || [])];

    el.querySelectorAll('.nb-bildweg').forEach((b) => {
      b.onclick = () => {
        bilder = bilder.filter((p) => p !== b.dataset.pfad);
        b.closest('.nb-slot').remove();
        // Aus dem Bucket erst beim Sichern – sonst ist das Bild weg, wenn du
        // den Vorgang abbrichst.
      };
    });

    el.querySelector('.nb-upload input').onchange = async (ev) => {
      const dateien = [...ev.target.files];
      ev.target.value = '';
      for (const d of dateien) {
        if (bilder.length >= MAX_BILDER) { alert(`Höchstens ${MAX_BILDER} Bilder pro Notiz.`); break; }
        try {
          const klein = await verkleinern(d);
          const pfad = `${userId}/${crypto.randomUUID()}.jpg`;
          const { error } = await supabase.storage.from(BUCKET)
            .upload(pfad, klein, { contentType: 'image/jpeg' });
          if (error) throw error;
          bilder.push(pfad);
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(pfad, 3600);
          el.querySelector('.nb-bilder-edit').insertAdjacentHTML('beforeend', `
            <span class="nb-slot">
              <img class="nb-bild" src="${data?.signedUrl || ''}" alt="">
              <button class="nb-bildweg" data-pfad="${pfad}" aria-label="Bild entfernen">×</button>
            </span>`);
          const neu = el.querySelector(`.nb-bildweg[data-pfad="${pfad}"]`);
          neu.onclick = () => { bilder = bilder.filter((p) => p !== pfad); neu.closest('.nb-slot').remove(); };
        } catch (e) {
          alert('Bild konnte nicht hochgeladen werden: ' + e.message);
        }
      }
    };

    el.querySelector('.nb-ab').onclick = () => zeichne();
    el.querySelector('.nb-ok').onclick = async () => {
      // Beim Sichern die tatsaechlich entfernten Bilder aus dem Bucket werfen,
      // sonst waechst er mit Karteileichen voll.
      const weg = (n.bilder || []).filter((p) => !bilder.includes(p));
      if (weg.length) await supabase.storage.from(BUCKET).remove(weg);
      const { error } = await supabase.from('notizen').update({
        titel: titelIn.value.trim(),
        text: textIn.value,
        bilder,
        updated_at: new Date().toISOString(),
      }).eq('id', n.id);
      if (error) { alert('Nicht gesichert: ' + error.message); return; }
      await laden();
    };
  }

  async function loeschen(n) {
    if (!confirm(`Notiz „${n.titel || 'Ohne Titel'}" löschen?`)) return;
    if ((n.bilder || []).length) await supabase.storage.from(BUCKET).remove(n.bilder);
    const { error } = await supabase.from('notizen').delete().eq('id', n.id);
    if (error) { alert('Nicht gelöscht: ' + error.message); return; }
    await laden();
  }

  wrap.querySelector('#nb-neu').onclick = async () => {
    const { data, error } = await supabase.from('notizen')
      .insert({ user_id: userId, titel: '', text: '' }).select().single();
    if (error) { alert('Nicht angelegt: ' + error.message); return; }
    notizen = [data, ...notizen];
    await zeichne();
    bearbeiten(data);
  };

  await laden();
}
