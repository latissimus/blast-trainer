import { supabase } from './supabase.js';
import { readNotizen, writeNotizen } from './localstore.js';
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


export function mountNotizbuch(container, { userId }) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <h1 class="section-title">📄 Notizbuch</h1>
      ${zurueckChip()}
    </div>
    <div id="nb-inhalt"><p class="som-hinweis">lädt…</p></div>`;
  container.appendChild(wrap);

  const inhalt = wrap.querySelector('#nb-inhalt');
  let notizen = [];
  // Die Seite hat drei Zustaende: Raster, eine offene Notiz zum Lesen, oder
  // deren Formular. Frueher wurde im Raster selbst bearbeitet – in einer
  // zweispaltigen Kachel ist dafuer kein Platz.
  //
  // Die Leseansicht ist nicht blosse Zierde: Nur dort sind Links anklickbar.
  // Im Formular steht der Text roh in einem Eingabefeld – ein Notizbuch, dessen
  // Links man nicht antippen kann, verfehlt den halben Zweck.
  let offen = null;
  let bearbeitet = false;
  // Der Server war nicht erreichbar, gezeigt wird der lokale Spiegel.
  let veraltet = false;

  // Erst den Spiegel zeigen, dann vom Server nachziehen.
  //
  // Ohne das war die Seite im Funkloch leer – ausgerechnet dort, wo man sie
  // braucht. Der Spiegel steht sofort da, auch ohne Empfang; scheitert der
  // Server, bleibt er stehen und sagt es.
  async function laden() {
    offen = null;
    bearbeitet = false;

    const lokal = readNotizen(userId);
    if (lokal) { notizen = lokal; veraltet = false; await zeichne(); }

    try {
      const { data, error } = await supabase
        .from('notizen').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      notizen = data || [];
      writeNotizen(userId, notizen);
      veraltet = false;
    } catch (e) {
      if (!lokal) {
        inhalt.innerHTML = `<div class="msg err">Keine Verbindung – und auf diesem Gerät
          liegt noch kein Notizbuch. Bitte einmal mit Internet öffnen.</div>`;
        return;
      }
      veraltet = true;   // Spiegel bleibt stehen, Hinweis erscheint
    }
    await zeichne();
  }

  async function zeichne() {
    if (offen && bearbeitet) return zeigeEditor(offen);
    if (offen) return zeigeAnsicht(offen);
    zeigeRaster();
  }

  // ---- Raster --------------------------------------------------------------

  // Vorschau: erste Zeile mit Inhalt, hart gekuerzt. Auf einer Kachel ist Platz
  // fuer zwei Zeilen – mehr waere Fliesstext in Briefmarkengroesse.
  const vorschau = (n) => {
    const roh = (n.text || '').split('\n').find((z) => z.trim()) || '';
    return escape(roh.slice(0, 90));
  };

  function zeigeRaster() {
    const kacheln = notizen.map((n) => `
      <button class="nb-kachel" data-id="${n.id}">
        <span class="nb-k-titel">${escape(n.titel) || 'Ohne Titel'}</span>
        <span class="nb-k-text">${vorschau(n)}</span>
        ${(n.bilder || []).length ? `<span class="nb-k-bilder">${n.bilder.length} Bild${n.bilder.length > 1 ? 'er' : ''}</span>` : ''}
      </button>`).join('');

    inhalt.innerHTML = `
      <div class="nb-leiste"><button class="nb-chip pink" id="nb-neu">+ Neue Notiz</button></div>
      ${veraltet ? `<p class="nb-offline">Ohne Verbindung – zuletzt geladener Stand.
        Bilder und Änderungen brauchen Internet.</p>` : ''}
      ${notizen.length
        ? `<div class="nb-raster">${kacheln}</div>`
        : `<p class="som-hinweis">Noch nichts notiert. Platz für Links, Screenshots,
             Gedanken zur Technik — bleibt beim Start einer neuen Phase erhalten.</p>`}`;

    inhalt.querySelector('#nb-neu').onclick = () => {
      offen = { id: 'entwurf', neu: true, titel: '', text: '', bilder: [] };
      bearbeitet = true;                       // ein Entwurf hat nichts zu lesen
      zeichne();
    };
    inhalt.querySelectorAll('.nb-kachel').forEach((k) => {
      k.onclick = () => {
        offen = notizen.find((n) => String(n.id) === k.dataset.id);
        bearbeitet = false;
        zeichne();
      };
    });
  }

  // ---- Lupe ----------------------------------------------------------------

  // Die Vorschau ist auf 120px quadratisch zugeschnitten (object-fit:cover) –
  // von einem Hochformat sieht man darin die Mitte und sonst nichts. Zum
  // Ansehen braucht es also das ganze Bild.
  //
  // Ueber document.body, nicht in der Karte: Die Bedienleiste unten liegt
  // hoeher im Stapel und wuerde sonst ueber dem Bild kleben.
  function zeigeBild(src) {
    const lupe = document.createElement('div');
    lupe.className = 'nb-lupe';
    lupe.innerHTML = `<img src="${src}" alt=""><button class="nb-lupe-zu" aria-label="Schließen">×</button>`;
    const zu = () => {
      lupe.remove();
      window.removeEventListener('hashchange', zu);
      document.removeEventListener('keydown', taste);
    };
    const taste = (e) => { if (e.key === 'Escape') zu(); };
    lupe.onclick = zu;                       // irgendwohin tippen schliesst
    window.addEventListener('hashchange', zu);   // sonst bleibt sie beim Seitenwechsel stehen
    document.addEventListener('keydown', taste);
    document.body.appendChild(lupe);
  }

  // ---- Lesen ---------------------------------------------------------------

  async function zeigeAnsicht(n) {
    const urls = await signiere(n.bilder || []);
    const bilder = (n.bilder || [])
      .map((p) => (urls[p] ? `<img class="nb-bild auf" src="${urls[p]}" alt="" tabindex="0">` : '')).join('');
    inhalt.innerHTML = `
      <div class="card nb-karte">
        <h2 class="nb-titel">${escape(n.titel) || '<i>Ohne Titel</i>'}</h2>
        ${n.text ? `<p class="nb-text">${verlinke(n.text)}</p>` : ''}
        ${bilder ? `<div class="nb-bilder">${bilder}</div>` : ''}
        <div class="nb-leiste">
          <button class="nb-chip pink nb-edit">Bearbeiten</button>
          <button class="nb-chip nb-zu">Zurück</button>
        </div>
      </div>`;
    inhalt.querySelectorAll('.nb-bild.auf').forEach((b) => {
      b.onclick = () => zeigeBild(b.src);
      b.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zeigeBild(b.src); } };
    });
    inhalt.querySelector('.nb-edit').onclick = () => { bearbeitet = true; zeichne(); };
    inhalt.querySelector('.nb-zu').onclick = () => { offen = null; zeichne(); };
  }

  // ---- Bearbeiten ----------------------------------------------------------

  async function zeigeEditor(n) {
    const urls = await signiere(n.bilder || []);
    inhalt.innerHTML = `
      <div class="card nb-karte">
        <label class="fld-l">Titel</label>
        <input class="input nb-in-titel" value="${escape(n.titel)}" placeholder="Worum geht es?" maxlength="120">
        <label class="fld-l">Text</label>
        <textarea class="input nb-in-text" rows="9" placeholder="Gedanken, Links, Cues…">${escape(n.text)}</textarea>
        <div class="nb-bilder nb-bilder-edit">
          ${(n.bilder || []).map((p) => `
            <span class="nb-slot">
              <img class="nb-bild" src="${urls[p] || ''}" alt="">
              <button class="nb-bildweg" data-pfad="${p}" aria-label="Bild entfernen">×</button>
            </span>`).join('')}
        </div>
        <div class="nb-leiste">
          <label class="nb-chip nb-upload">+ Bild<input type="file" accept="image/*" hidden multiple></label>
          <button class="nb-chip pink nb-ok">Sichern</button>
          <button class="nb-chip nb-ab">Abbrechen</button>
          ${n.neu ? '' : '<button class="nb-chip nb-weg">Löschen</button>'}
        </div>
      </div>`;

    const el = inhalt.querySelector('.nb-karte');
    const titelIn = el.querySelector('.nb-in-titel');
    const textIn = el.querySelector('.nb-in-text');
    let bilder = [...(n.bilder || [])];

    const bildWegBinden = (b) => {
      b.onclick = () => {
        bilder = bilder.filter((p) => p !== b.dataset.pfad);
        b.closest('.nb-slot').remove();
        // Aus dem Bucket erst beim Sichern – sonst ist das Bild weg, wenn du
        // den Vorgang abbrichst.
      };
    };
    el.querySelectorAll('.nb-bildweg').forEach(bildWegBinden);

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
          bildWegBinden(el.querySelector(`.nb-bildweg[data-pfad="${pfad}"]`));
        } catch (e) {
          alert('Bild konnte nicht hochgeladen werden: ' + e.message);
        }
      }
    };

    // Abbrechen laesst nichts zurueck.
    //
    // Frueher legte "+ Neue Notiz" die Zeile sofort an und Abbrechen zeichnete
    // nur neu – die leere Notiz blieb stehen. Jetzt entsteht ein Entwurf, der
    // erst beim Sichern in die Datenbank geht.
    //
    // Bilder wandern beim Hochladen sofort in den Bucket (anders geht es nicht,
    // die Vorschau braucht eine Adresse). Beim Abbrechen muessen die in dieser
    // Sitzung hochgeladenen also wieder weg, sonst bleiben Waisen liegen.
    el.querySelector('.nb-ab').onclick = async () => {
      const waisen = bilder.filter((p) => !(n.bilder || []).includes(p));
      if (waisen.length) await supabase.storage.from(BUCKET).remove(waisen);
      // Ein verworfener Entwurf fuehrt zurueck ins Raster, eine bestehende
      // Notiz zurueck in ihre Leseansicht – dorthin, wo man hergekommen ist.
      if (n.neu) offen = null; else bearbeitet = false;
      await zeichne();
    };

    el.querySelector('.nb-ok').onclick = async () => {
      // Geschrieben wird nur online. Ohne diesen Riegel liefe der Aufruf in
      // einen Timeout und meldete dann etwas Technisches – gesagt gehoert aber,
      // dass der Text noch im Feld steht und nichts verloren ist.
      if (!navigator.onLine) {
        alert('Keine Verbindung. Dein Text bleibt stehen – sichere ihn, sobald du wieder online bist.');
        return;
      }
      const felder = { titel: titelIn.value.trim(), text: textIn.value, bilder };
      if (n.neu) {
        const { error } = await supabase.from('notizen').insert({ user_id: userId, ...felder });
        if (error) { alert('Nicht gesichert: ' + error.message); return; }
        await laden();
        return;
      }
      // Beim Sichern die tatsaechlich entfernten Bilder aus dem Bucket werfen,
      // sonst waechst er mit Karteileichen voll.
      const weg = (n.bilder || []).filter((p) => !bilder.includes(p));
      if (weg.length) await supabase.storage.from(BUCKET).remove(weg);
      const { error } = await supabase.from('notizen')
        .update({ ...felder, updated_at: new Date().toISOString() })
        .eq('id', n.id);
      if (error) { alert('Nicht gesichert: ' + error.message); return; }
      await laden();
    };

    const weg = el.querySelector('.nb-weg');
    if (weg) weg.onclick = async () => {
      if (!confirm(`Notiz „${n.titel || 'Ohne Titel'}" löschen?`)) return;
      if ((n.bilder || []).length) await supabase.storage.from(BUCKET).remove(n.bilder);
      const { error } = await supabase.from('notizen').delete().eq('id', n.id);
      if (error) { alert('Nicht gelöscht: ' + error.message); return; }
      await laden();
    };
  }

  // Nicht auf den Server warten, bevor main.js den Seitenwechsel abschliessen
  // kann. laden() zeichnet einen vorhandenen lokalen Spiegel synchron bis zum
  // ersten await und ersetzt ihn spaeter still durch den aktuellen Serverstand.
  laden();
}
