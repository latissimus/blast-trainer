import { supabase } from './supabase.js';
import { signOut } from './auth.js';
import { toast } from './log.js';
import { getTheme, setTheme } from './theme.js';
import { readLog, readNotizen, clearUserData } from './localstore.js';

const initials = (name, email) => {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

// Verkleinert ein Bild im Browser auf ein quadratisches Thumbnail und gibt
// ein komprimiertes JPEG-Data-URL zurueck (~15-40 KB). Wird direkt im
// profiles-Datensatz gespeichert (kein Storage-Bucket noetig).
function compressToThumbnail(file, size = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function avatarNode(profile, email) {
  if (profile.avatar_url) {
    const img = document.createElement('img');
    img.className = 'avatar'; img.src = profile.avatar_url; img.alt = 'Profilbild';
    return img;
  }
  const div = document.createElement('div');
  div.className = 'avatar avatar-fallback';
  div.textContent = initials(profile.full_name, email);
  return div;
}

function downloadJson(name, daten) {
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountProfile(container, { session, profile, onProfileUpdated }) {
  const email = session.user.email;
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <h1 class="section-title">Mein Profil</h1>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>`;

  const card = document.createElement('div');
  card.className = 'card';

  // --- top: avatar + role ---
  const top = document.createElement('div');
  top.className = 'profile-top';
  const avSlot = document.createElement('div');
  avSlot.appendChild(avatarNode(profile, email));
  const meta = document.createElement('div');
  meta.innerHTML = `
    <div style="font-weight:800;font-size:16px">${profile.full_name || '—'}</div>
    <div style="font-size:12px;color:var(--muted)">${email}</div>
    <span class="role-tag ${profile.role === 'admin' ? 'admin' : ''}">${profile.role === 'admin' ? 'Admin' : 'Trainee'}</span>`;
  top.appendChild(avSlot); top.appendChild(meta);
  card.appendChild(top);

  // --- avatar upload ---
  const upWrap = document.createElement('div');
  upWrap.innerHTML = `<label class="fld-l">Profilbild ändern</label>`;
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/png,image/jpeg,image/webp,image/gif';
  fileIn.className = 'input';
  upWrap.appendChild(fileIn);
  card.appendChild(upWrap);

  fileIn.onchange = async () => {
    const file = fileIn.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Bitte eine Bilddatei wählen'); fileIn.value = ''; return; }
    if (file.size > 15 * 1024 * 1024) { toast('Bild zu groß (max 15 MB)'); fileIn.value = ''; return; }
    toast('Verarbeite Bild…');
    let dataUrl;
    try {
      dataUrl = await compressToThumbnail(file);
    } catch (e) {
      toast('Bild konnte nicht gelesen werden');
      fileIn.value = '';
      return;
    }
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', session.user.id);
    if (updErr) { toast('Konnte Bild nicht speichern'); return; }
    profile.avatar_url = dataUrl;
    avSlot.innerHTML = ''; avSlot.appendChild(avatarNode(profile, email));
    fileIn.value = '';
    toast('Profilbild aktualisiert');
    onProfileUpdated?.(profile);
  };

  // --- name ---
  const nameWrap = document.createElement('div');
  nameWrap.innerHTML = `<label class="fld-l" for="pf-name">Name</label>`;
  const nameIn = document.createElement('input');
  nameIn.id = 'pf-name'; nameIn.className = 'input'; nameIn.value = profile.full_name || '';
  nameIn.placeholder = 'Dein Name';
  nameWrap.appendChild(nameIn);
  card.appendChild(nameWrap);

  // --- email (read-only) ---
  const emWrap = document.createElement('div');
  emWrap.innerHTML = `<label class="fld-l">E-Mail (nicht änderbar)</label>`;
  const emIn = document.createElement('input');
  emIn.className = 'input'; emIn.value = email; emIn.disabled = true;
  emWrap.appendChild(emIn);
  card.appendChild(emWrap);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = 'Profil speichern';
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    const { error } = await supabase.from('profiles').update({ full_name: nameIn.value.trim() || null }).eq('id', session.user.id);
    saveBtn.disabled = false;
    if (error) { toast('Speichern fehlgeschlagen'); return; }
    profile.full_name = nameIn.value.trim();
    meta.querySelector('div').textContent = profile.full_name || '—';
    if (!profile.avatar_url) { avSlot.innerHTML = ''; avSlot.appendChild(avatarNode(profile, email)); }
    toast('Profil gespeichert');
    onProfileUpdated?.(profile);
  };
  card.appendChild(saveBtn);
  wrap.appendChild(card);

  // --- Passwort aendern -------------------------------------------------
  const pwCard = document.createElement('div');
  pwCard.className = 'card';
  pwCard.innerHTML = `<h2 class="section-title" style="font-size:18px;margin:0 0 4px">Passwort ändern</h2>`;
  const pwMsg = document.createElement('div');
  pwCard.appendChild(pwMsg);

  const pw1Wrap = document.createElement('div');
  pw1Wrap.innerHTML = `<label class="fld-l" for="pf-pw1">Neues Passwort</label>`;
  const pw1 = document.createElement('input');
  pw1.id = 'pf-pw1'; pw1.className = 'input'; pw1.type = 'password';
  pw1.autocomplete = 'new-password'; pw1.minLength = 6; pw1.placeholder = '••••••••';
  pw1Wrap.appendChild(pw1); pwCard.appendChild(pw1Wrap);

  const pw2Wrap = document.createElement('div');
  pw2Wrap.innerHTML = `<label class="fld-l" for="pf-pw2">Wiederholen</label>`;
  const pw2 = document.createElement('input');
  pw2.id = 'pf-pw2'; pw2.className = 'input'; pw2.type = 'password';
  pw2.autocomplete = 'new-password'; pw2.minLength = 6; pw2.placeholder = '••••••••';
  pw2Wrap.appendChild(pw2); pwCard.appendChild(pw2Wrap);

  const pwBtn = document.createElement('button');
  pwBtn.className = 'btn btn-block';
  pwBtn.textContent = 'Passwort speichern';
  pwBtn.onclick = async () => {
    pwMsg.innerHTML = '';
    if (pw1.value.length < 6) { pwMsg.innerHTML = `<div class="msg err">Mindestens 6 Zeichen.</div>`; return; }
    if (pw1.value !== pw2.value) { pwMsg.innerHTML = `<div class="msg err">Die beiden Passwörter stimmen nicht überein.</div>`; return; }
    pwBtn.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: pw1.value });
    pwBtn.disabled = false;
    if (error) { pwMsg.innerHTML = `<div class="msg err">${error.message}</div>`; return; }
    pw1.value = ''; pw2.value = '';
    pwMsg.innerHTML = `<div class="msg ok">Passwort geändert.</div>`;
    toast('Passwort geändert');
  };
  pwCard.appendChild(pwBtn);
  wrap.appendChild(pwCard);

  // --- Darstellung -------------------------------------------------------
  const thCard = document.createElement('div');
  thCard.className = 'card';
  thCard.innerHTML = `<h2 class="section-title" style="font-size:18px;margin:0 0 16px">Darstellung</h2>`;
  const seg = document.createElement('div');
  seg.className = 'themeseg';
  [['retro', 'Retro'], ['dark', 'Dark']].forEach(([wert, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'themebtn' + (getTheme() === wert ? ' on' : '');
    b.textContent = label;
    b.onclick = () => {
      setTheme(wert);
      seg.querySelectorAll('.themebtn').forEach((x) => x.classList.toggle('on', x === b));
    };
    seg.appendChild(b);
  });
  thCard.appendChild(seg);
  wrap.appendChild(thCard);

  // --- Eigene Daten -------------------------------------------------------
  // Bewusst unten im Profil statt im Hauptmenue: wichtig fuer Kontrolle und
  // Datenschutz, aber keine Handlung waehrend des Trainings.
  const dataCard = document.createElement('div');
  dataCard.className = 'card profile-daten';
  dataCard.innerHTML = `
    <h2 class="section-title" style="font-size:18px;margin:0 0 6px">Meine Daten</h2>
    <p class="profile-hinweis">Exportiert Profil, Trainingslog und Notizen als JSON-Datei.</p>
    <button class="btn btn-block" type="button" data-export>Daten exportieren</button>
    <div class="profile-gefahr">
      <p><b>Account löschen</b><br>Entfernt Account, Trainingsdaten und Notizbuch endgültig.</p>
      <button class="btn btn-block btn-danger" type="button" data-account-weg>Account und Daten löschen</button>
    </div>
    <div class="profile-daten-status" aria-live="polite"></div>`;
  wrap.appendChild(dataCard);

  const datenStatus = dataCard.querySelector('.profile-daten-status');
  dataCard.querySelector('[data-export]').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    datenStatus.textContent = 'Export wird erstellt…';
    try {
      const lokalLog = readLog(session.user.id)?.payload || null;
      const lokalNotizen = readNotizen(session.user.id) || null;
      const [logRes, notizRes] = await Promise.all([
        supabase.from('training_logs').select('payload, updated_at').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('notizen').select('id, titel, text, bilder, created_at, updated_at').order('updated_at', { ascending: false }),
      ]);
      if (logRes.error && !lokalLog) throw logRes.error;
      if (notizRes.error && !lokalNotizen) throw notizRes.error;
      const heute = new Date().toISOString().slice(0, 10);
      downloadJson(`logman-export-${heute}.json`, {
        exportiert_am: new Date().toISOString(),
        profil: {
          id: session.user.id,
          email,
          name: profile.full_name || '',
          rolle: profile.role,
          darstellung: getTheme(),
        },
        training: logRes.data || (lokalLog ? { payload: lokalLog, lokal: true } : null),
        notizen: notizRes.data || lokalNotizen || [],
      });
      datenStatus.textContent = 'Export heruntergeladen.';
    } catch (err) {
      datenStatus.textContent = 'Export fehlgeschlagen. Bitte Verbindung prüfen.';
    } finally {
      btn.disabled = false;
    }
  };

  dataCard.querySelector('[data-account-weg]').onclick = async (e) => {
    const bestaetigung = prompt('Der Account und alle Daten werden endgültig gelöscht.\n\nTippe LÖSCHEN zum Bestätigen:');
    if (bestaetigung !== 'LÖSCHEN') return;
    const btn = e.currentTarget;
    btn.disabled = true;
    datenStatus.textContent = 'Account wird gelöscht…';
    let bilderEntfernt = false;
    try {
      // Vor dem Entfernen der separat gespeicherten Bilder pruefen, ob die
      // serverseitige Loeschfunktion bereits ausgerollt und erreichbar ist.
      const { error: bereitFehler } = await supabase.rpc('delete_own_account', { nur_pruefen: true });
      if (bereitFehler) throw bereitFehler;
      // Storage-Objekte haben keinen Fremdschluessel zu auth.users und muessen
      // deshalb vor dem Account geloescht werden. Tabellenzeilen fallen danach
      // ueber ON DELETE CASCADE.
      const { data: notizen, error: notizFehler } = await supabase
        .from('notizen').select('bilder').eq('user_id', session.user.id);
      if (notizFehler) throw notizFehler;
      const bilder = (notizen || []).flatMap((n) => Array.isArray(n.bilder) ? n.bilder : []);
      if (bilder.length) {
        const { error: bildFehler } = await supabase.storage.from('notizbuch').remove(bilder);
        if (bildFehler) throw bildFehler;
        bilderEntfernt = true;
      }
      const { error } = await supabase.rpc('delete_own_account', { nur_pruefen: false });
      if (error) throw error;
      clearUserData(session.user.id);
      await supabase.auth.signOut({ scope: 'local' });
      location.hash = '';
      location.reload();
    } catch (err) {
      btn.disabled = false;
      datenStatus.textContent = bilderEntfernt
        ? 'Der Account blieb bestehen; Notizbuchbilder wurden bereits entfernt.'
        : 'Löschen fehlgeschlagen. Es wurden keine Kontodaten gelöscht.';
    }
  };

  // --- Abmelden ----------------------------------------------------------
  // Frueher stand der Knopf dauerhaft in der Kopfleiste. Dort war er staendig
  // sichtbar, obwohl man ihn selten braucht – im Profil liegt er naeher an den
  // uebrigen Kontoeinstellungen.
  const outCard = document.createElement('div');
  outCard.className = 'card';
  const outBtn = document.createElement('button');
  outBtn.className = 'btn btn-block';
  outBtn.textContent = 'Abmelden';
  outBtn.onclick = () => signOut();
  outCard.appendChild(outBtn);
  wrap.appendChild(outCard);

  // Die Heavy-Progression stand frueher hier. Sie liegt jetzt im Set-O-Meter-
  // Blatt, direkt unter der Wochenverteilung: Beide beantworten Fragen zum
  // Training, und dort ist sie waehrend der Einheit mit einem Tipp erreichbar –
  // statt zwei Ansichten weit weg.

  // --- Version ----------------------------------------------------------
  // Zur Bauzeit eingebrannt. Der Service Worker liefert die App aus dem Cache:
  // Beim ersten Oeffnen nach einem Push sieht man noch den alten Stand. Ohne
  // diese Zeile raet man bei jedem Fehler, ob der Code oder der Cache schuld ist.
  const ver = document.createElement('p');
  ver.className = 'buildinfo';
  ver.textContent = `Version ${__BUILD_COMMIT__} · ${__BUILD_TIME__}`;
  wrap.appendChild(ver);

  container.appendChild(wrap);
}
