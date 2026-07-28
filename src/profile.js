import { supabase } from './supabase.js';
import { signOut } from './auth.js';
import { toast } from './log.js';
import { getTheme, setTheme } from './theme.js';
import { readLog, readNotizen, clearUserData } from './localstore.js';
import { ladeFeedbackEingang } from './feedback.js';
import { sondeLesen, sondeSetzen } from './sonde.js';   // VORUEBERGEHEND

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
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Konto</span>
        <h1 class="section-title">Mein Profil</h1>
      </div>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>
    <section class="seiten-einstieg">
      <b>Alles zu deinem Konto</b>
      <span>Profil, Darstellung und Daten übersichtlich verwalten.</span>
    </section>`;

  const profilSektion = (titel, offen = false, klasse = '') => {
    const details = document.createElement('details');
    details.className = `profile-abschnitt${klasse ? ` ${klasse}` : ''}`;
    details.open = offen;
    const summary = document.createElement('summary');
    summary.textContent = titel;
    const inhalt = document.createElement('div');
    inhalt.className = 'profile-abschnitt-inhalt';
    details.append(summary, inhalt);
    wrap.appendChild(details);
    return inhalt;
  };

  const card = profilSektion('Konto', true);

  // --- top: avatar + role ---
  const top = document.createElement('div');
  top.className = 'profile-top';
  const avSlot = document.createElement('div');
  avSlot.appendChild(avatarNode(profile, email));
  const meta = document.createElement('div');
  meta.className = 'profile-meta';
  meta.innerHTML = `
    <div class="profile-name">${profile.full_name || '—'}</div>
    <div class="profile-email">${email}</div>
    <span class="role-tag ${profile.role === 'admin' ? 'admin' : ''}">${profile.role === 'admin' ? 'Admin' : 'Trainee'}</span>`;
  top.appendChild(avSlot); top.appendChild(meta);
  card.appendChild(top);

  // --- avatar upload ---
  const upWrap = document.createElement('div');
  upWrap.innerHTML = `<label class="fld-l">Profilbild ändern</label>`;
  const fileLabel = document.createElement('label');
  fileLabel.className = 'profile-datei';
  const fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'image/png,image/jpeg,image/webp,image/gif';
  const fileKnopf = document.createElement('span');
  fileKnopf.className = 'profile-datei-knopf';
  fileKnopf.textContent = 'Bild wählen';
  const fileName = document.createElement('span');
  fileName.className = 'profile-dateiname';
  fileName.textContent = 'Kein Bild gewählt';
  fileLabel.append(fileKnopf, fileName, fileIn);
  upWrap.appendChild(fileLabel);
  card.appendChild(upWrap);

  fileIn.onchange = async () => {
    const file = fileIn.files?.[0];
    if (!file) return;
    fileName.textContent = file.name;
    if (!file.type.startsWith('image/')) {
      toast('Bitte eine Bilddatei wählen'); fileIn.value = ''; fileName.textContent = 'Kein Bild gewählt'; return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast('Bild zu groß (max 15 MB)'); fileIn.value = ''; fileName.textContent = 'Kein Bild gewählt'; return;
    }
    toast('Verarbeite Bild…');
    let dataUrl;
    try {
      dataUrl = await compressToThumbnail(file);
    } catch (e) {
      toast('Bild konnte nicht gelesen werden');
      fileIn.value = '';
      fileName.textContent = 'Kein Bild gewählt';
      return;
    }
    const { error: updErr } = await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', session.user.id);
    if (updErr) {
      toast('Konnte Bild nicht speichern');
      fileIn.value = '';
      fileName.textContent = 'Kein Bild gewählt';
      return;
    }
    profile.avatar_url = dataUrl;
    avSlot.innerHTML = ''; avSlot.appendChild(avatarNode(profile, email));
    fileIn.value = '';
    fileName.textContent = 'Kein Bild gewählt';
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
    meta.querySelector('.profile-name').textContent = profile.full_name || '—';
    if (!profile.avatar_url) { avSlot.innerHTML = ''; avSlot.appendChild(avatarNode(profile, email)); }
    toast('Profil gespeichert');
    onProfileUpdated?.(profile);
  };
  card.appendChild(saveBtn);

  // --- Passwort aendern -------------------------------------------------
  const pwCard = profilSektion('Passwort ändern');
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

  // --- Darstellung -------------------------------------------------------
  const thCard = profilSektion('Darstellung');
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

  // --- Eigene Daten -------------------------------------------------------
  // Bewusst unten im Profil statt im Hauptmenue: wichtig fuer Kontrolle und
  // Datenschutz, aber keine Handlung waehrend des Trainings.
  const dataCard = profilSektion('Meine Daten');
  dataCard.innerHTML = `
    <p class="profile-hinweis">Exportiert Profil, Trainingslog und Notizen als JSON-Datei.</p>
    <button class="btn btn-block" type="button" data-export>Daten exportieren</button>
    <div class="profile-daten-status" aria-live="polite"></div>`;

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

  const dangerCard = profilSektion('Account löschen', false, 'gefahr');
  dangerCard.innerHTML = `
    <p class="profile-hinweis">Entfernt Account, Trainingsdaten und Notizbuch endgültig.</p>
    <button class="btn btn-block btn-danger" type="button" data-account-weg>Account und Daten löschen</button>
    <div class="profile-daten-status" aria-live="polite"></div>`;
  const dangerStatus = dangerCard.querySelector('.profile-daten-status');

  dangerCard.querySelector('[data-account-weg]').onclick = async (e) => {
    const bestaetigung = prompt('Der Account und alle Daten werden endgültig gelöscht.\n\nTippe LÖSCHEN zum Bestätigen:');
    if (bestaetigung !== 'LÖSCHEN') return;
    const btn = e.currentTarget;
    btn.disabled = true;
    dangerStatus.textContent = 'Account wird gelöscht…';
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
      const serverFunktionFehlt =
        err?.code === 'PGRST202' ||
        /delete_own_account|could not find the function|schema cache/i.test(err?.message || '');
      dangerStatus.textContent = bilderEntfernt
        ? 'Der Account blieb bestehen; Notizbuchbilder wurden bereits entfernt.'
        : serverFunktionFehlt
          ? 'Die Kontolöschung ist auf dem Server noch nicht aktiviert. Es wurden keine Daten gelöscht.'
          : 'Der Account konnte nicht gelöscht werden. Es wurden keine Daten gelöscht. Bitte Verbindung prüfen und erneut versuchen.';
    }
  };

  // Der Admin sieht den Eingang auch direkt im eigenen Profil. Die separate
  // Feedback-Seite bleibt als öffentlicher Abgabeort erhalten.
  if (profile.role === 'admin') {
    const feedbackCard = profilSektion('Kundenfeedback', true);
    feedbackCard.innerHTML = `
      <p class="profile-hinweis">Die neuesten Vorschläge und Hinweise aus der App.</p>
      <div data-feedback-liste><p class="feedback-laden">Feedback wird geladen…</p></div>`;
    ladeFeedbackEingang(feedbackCard.querySelector('[data-feedback-liste]'));
  }

  // --- Abmelden ----------------------------------------------------------
  // Frueher stand der Knopf dauerhaft in der Kopfleiste. Dort war er staendig
  // sichtbar, obwohl man ihn selten braucht – im Profil liegt er naeher an den
  // uebrigen Kontoeinstellungen.
  const outCard = document.createElement('div');
  outCard.className = 'profile-ausloggen';
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

  // ===== VORUEBERGEHENDE SONDEN – samt CSS-Block wieder entfernen! =====
  // Das Flackern tritt nur in der installierten Web-App auf, dort laesst sich
  // aber keine URL mit ?sonde=… aufrufen. Deshalb dieser Schalter: Die Wahl
  // liegt im localStorage, wirkt sofort und ueberlebt einen Neustart der App.
  const sondenKarte = profilSektion('Sonden · Header-Flackern');
  sondenKarte.innerHTML = `
    <p class="profile-hinweis">Nur zur Fehlersuche. Sonde wählen, dann zwischen
      Log und Unterseiten wechseln und schauen, ob es noch flackert. Unten links
      steht, welche gerade läuft.</p>
    <div class="sondenwahl" role="group" aria-label="Sonde wählen">
      <button type="button" data-sonde="">Aus</button>
      <button type="button" data-sonde="a">A</button>
      <button type="button" data-sonde="b">B</button>
      <button type="button" data-sonde="c">C</button>
      <button type="button" data-sonde="d">D</button>
      <button type="button" data-sonde="e">E</button>
      <button type="button" data-sonde="f">F</button>
      <button type="button" data-sonde="g">G</button>
      <button type="button" data-sonde="h">H</button>
      <button type="button" data-sonde="i">I</button>
      <button type="button" data-sonde="j">J</button>
      <button type="button" data-sonde="m">Messen</button>
      <button type="button" data-sonde="n">Nachweis</button>
    </div>
    <p class="profile-hinweis" id="sonden-info"></p>`;
  const SONDEN_TEXT = {
    '': 'Alles unverändert.',
    a: 'A · Fläche über dem Header nur 120px statt volle Bildschirmhöhe.',
    b: 'B · Deckfläche unter dem Logo transparent. Der Zurück-Chip wird dabei sichtbar – das ist normal.',
    c: 'C · Kopfzeile ohne eigenen Stapelkontext (isolation).',
    d: 'D · Silhouette hinter dem Schriftzug aus. Das Logo sieht dabei nackt aus – das ist beabsichtigt.',
    e: 'E · Alle Milchglas-Effekte (backdrop-filter) aus: Zurück-Chip, untere Leiste, Übungskatalog. Flächen wirken flach – gewollt.',
    f: 'F · Nur der Zurück-Chip ohne Milchglas. Er ist der einzige, der beim Seitenwechsel in die Kopfzeile eingehängt wird.',
    g: 'G · Kein Scroll-Sprung mehr: Jeder Wechsel beginnt und endet ganz oben. Das Log merkt sich seine Position dabei NICHT – nur zum Test.',
    h: 'H · Kopfzeile fest statt klebend. Der wahrscheinlichste Kandidat: Eine klebende Leiste haengt an der Dokumenthoehe, und die aendert sich beim Wechsel schlagartig.',
    i: 'I · Seitenwechsel erst, wenn das native Auswahlrad zu ist (0,35 s spaeter). Der Wechsel wirkt dadurch traeger – nur zum Test.',
    j: 'J · Eigene GPU-Ebene fuer die Kopfzeile – der Kandidat aus der Messung. Der Zurueck-Chip verliert dabei sein Milchglas und wird schlicht deckend.',
    m: 'Messen · Ändert nichts am Aussehen. Zeichnet bei jedem Seitenwechsel 1,5 s lang die Bildabstände auf und zeigt sie unten links.',
    n: 'Nachweis · Ändert nichts. Beobachtet 30 Bilder nach dem Wechsel, was mit der Kopfzeile passiert: neu gebaut, aus dem Bild gerutscht oder nur nicht gezeichnet.',
  };
  const sondenInfo = sondenKarte.querySelector('#sonden-info');
  const sondenZeigen = () => {
    const aktiv = sondeLesen();
    sondenKarte.querySelectorAll('[data-sonde]').forEach((b) => {
      b.classList.toggle('on', b.dataset.sonde === aktiv);
    });
    sondenInfo.textContent = SONDEN_TEXT[aktiv] || SONDEN_TEXT[''];
  };
  sondenKarte.querySelectorAll('[data-sonde]').forEach((b) => {
    b.onclick = () => { sondeSetzen(b.dataset.sonde); sondenZeigen(); };
  });
  sondenZeigen();

  container.appendChild(wrap);
}
