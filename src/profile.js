import { supabase } from './supabase.js';
import { signOut } from './auth.js';
import { toast } from './log.js';
import { escapeHtml } from './html.js';
import { getTheme, setTheme } from './theme.js';
import { readLog, writeLog, readNotizen, clearUserData } from './localstore.js';
import { synchronisiereTraining } from './trainingssync.js';
import {
  aktualisiereEigeneZuordnung,
  benenneEigeneUebungUm,
  normalisiereEigeneUebungen,
  setzeEigeneUebungAktiv,
} from './eigene-uebungen.js';
import { KONTEN } from './katalog.js';

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

  // --- top: avatar + account ---
  const top = document.createElement('div');
  top.className = 'profile-top';
  const avSlot = document.createElement('div');
  avSlot.appendChild(avatarNode(profile, email));
  const meta = document.createElement('div');
  meta.className = 'profile-meta';
  meta.innerHTML = `
    <div class="profile-name">${escapeHtml(profile.full_name || '—')}</div>
    <div class="profile-email">${escapeHtml(email)}</div>`;
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

  const logCard = profilSektion('Log-Einstellungen');
  const logKontext = document.createElement('label');
  logKontext.className = 'profile-schalter';
  logKontext.innerHTML = `<input type="checkbox"><span><b>Gym-/Infofeld anzeigen</b><small>Oben im Log · bleibt für alle Cycles erhalten</small></span>`;
  const logKontextSchalter = logKontext.querySelector('input');
  logKontextSchalter.checked = localStorage.getItem(`blast:log-kontext-sichtbar:${session.user.id}`) !== '0';
  logKontextSchalter.onchange = () => {
    localStorage.setItem(`blast:log-kontext-sichtbar:${session.user.id}`, logKontextSchalter.checked ? '1' : '0');
    toast(logKontextSchalter.checked ? 'Gym-/Infofeld eingeblendet' : 'Gym-/Infofeld ausgeblendet');
  };
  logCard.appendChild(logKontext);

  // Persönliche Übungen liegen absichtlich im Trainings-Payload: So sind sie
  // zusammen mit dem Log offline verfügbar und auf jedem Gerät identisch. Im
  // Profil werden sie nur verwaltet; neu angelegt werden sie direkt dort, wo
  // man sie braucht – im Übungskatalog eines Muskelblocks.
  const eigeneCard = profilSektion('Eigene Übungen');
  const eigeneHinweis = document.createElement('p');
  eigeneHinweis.className = 'profile-hinweis';
  eigeneHinweis.textContent = 'Varianten und eigene Übungen legst du im Übungskatalog an.';
  const eigeneListe = document.createElement('div');
  eigeneListe.className = 'profile-eigene-liste';
  const eigeneStatus = document.createElement('div');
  eigeneStatus.className = 'profile-daten-status';
  eigeneStatus.setAttribute('aria-live', 'polite');
  eigeneCard.append(eigeneHinweis, eigeneListe, eigeneStatus);

  let eigenerStand = readLog(session.user.id);
  let eigenesPayload = eigenerStand?.payload || { v: 4, week: 1, day: 'OK-H' };
  eigenesPayload.eigeneUebungen = normalisiereEigeneUebungen(eigenesPayload.eigeneUebungen);

  const eigeneSpeichern = async () => {
    eigenerStand = readLog(session.user.id);
    writeLog(session.user.id, eigenesPayload, true, !!eigenerStand?.replace);
    eigeneStatus.textContent = 'Auf diesem Gerät gespeichert · synchronisiert…';
    const result = await synchronisiereTraining(session.user.id, eigenesPayload);
    if (result.status === 'saved') eigeneStatus.textContent = 'Gespeichert';
    else if (result.status === 'offline') eigeneStatus.textContent = 'Auf diesem Gerät gespeichert · wartet auf Verbindung';
    else if (result.status === 'error') eigeneStatus.textContent = 'Auf diesem Gerät gespeichert · Upload fehlgeschlagen';
  };

  const eigeneZeichnen = () => {
    eigeneListe.innerHTML = '';
    const alle = normalisiereEigeneUebungen(eigenesPayload.eigeneUebungen);
    if (!alle.length) {
      eigeneListe.innerHTML = '<p class="profile-eigene-leer">Noch keine eigenen Übungen angelegt.</p>';
      return;
    }
    alle.forEach((eintrag) => {
      const zeile = document.createElement('div');
      zeile.className = `profile-eigene${eintrag.aktiv ? '' : ' inaktiv'}`;
      zeile.innerHTML = `<div><b>${escapeHtml(eintrag.n)}</b><small>${eintrag.art === 'variante' ? `Variante von ${escapeHtml(eintrag.basis)}` : 'Eigene Übung'} · ${escapeHtml(eintrag.haupt)} · ${escapeHtml(eintrag.typ)}</small></div>`;
      const aktionen = document.createElement('span');
      if (eintrag.aktiv) {
        const umbenennen = document.createElement('button');
        umbenennen.type = 'button';
        umbenennen.textContent = 'Umbenennen';
        umbenennen.onclick = async () => {
          const name = prompt('Neuer Name der Übung:', eintrag.n);
          if (name == null || name.trim() === eintrag.n) return;
          const result = benenneEigeneUebungUm(eigenesPayload, eintrag.id, name);
          if (result.fehler) { toast(result.fehler); return; }
          eigeneZeichnen();
          await eigeneSpeichern();
        };
        if (eintrag.art === 'eigen') {
          const zuordnung = document.createElement('button');
          zuordnung.type = 'button';
          zuordnung.textContent = 'Zuordnung';
          zuordnung.onclick = () => {
            const vorhanden = zeile.querySelector('.profile-eigene-editor');
            if (vorhanden) { vorhanden.remove(); return; }
            const editor = document.createElement('div');
            editor.className = 'profile-eigene-editor';
            editor.innerHTML = `
              <label><span>Hauptmuskel</span><select data-haupt>${KONTEN.map((konto) => `<option value="${escapeHtml(konto)}"${konto === eintrag.haupt ? ' selected' : ''}>${escapeHtml(konto)}</option>`).join('')}</select></label>
              <label><span>Art</span><select data-typ><option value="Comp"${eintrag.typ === 'Comp' ? ' selected' : ''}>Comp</option><option value="Iso"${eintrag.typ === 'Iso' ? ' selected' : ''}>Iso</option></select></label>
              <details><summary>Indirekte Belastung · optional</summary><div data-neben></div></details>
              <button type="button" data-zuordnung-speichern>Zuordnung speichern</button>`;
            const haupt = editor.querySelector('[data-haupt]');
            const neben = editor.querySelector('[data-neben]');
            const gewaehlteNeben = new Set(eintrag.neben || []);
            const nebenZeichnen = () => {
              gewaehlteNeben.delete(haupt.value);
              neben.innerHTML = KONTEN.filter((konto) => konto !== haupt.value).map((konto) => `
                <label><input type="checkbox" value="${escapeHtml(konto)}"${gewaehlteNeben.has(konto) ? ' checked' : ''}><span>${escapeHtml(konto)}</span></label>`).join('');
              neben.querySelectorAll('input').forEach((box) => {
                box.onchange = () => box.checked ? gewaehlteNeben.add(box.value) : gewaehlteNeben.delete(box.value);
              });
            };
            nebenZeichnen();
            haupt.onchange = nebenZeichnen;
            editor.querySelector('[data-zuordnung-speichern]').onclick = async () => {
              const result = aktualisiereEigeneZuordnung(eigenesPayload.eigeneUebungen, eintrag.id, {
                haupt: haupt.value,
                typ: editor.querySelector('[data-typ]').value,
                neben: [...gewaehlteNeben],
              });
              if (result.fehler) { toast(result.fehler); return; }
              eigenesPayload.eigeneUebungen = result.liste;
              eigeneZeichnen();
              await eigeneSpeichern();
            };
            zeile.appendChild(editor);
          };
          aktionen.appendChild(zuordnung);
        }
        const entfernen = document.createElement('button');
        entfernen.type = 'button';
        entfernen.textContent = 'Ausblenden';
        entfernen.onclick = async () => {
          if (!confirm(`„${eintrag.n}“ aus der zukünftigen Auswahl entfernen? Alte Logs bleiben erhalten.`)) return;
          eigenesPayload.eigeneUebungen = setzeEigeneUebungAktiv(eigenesPayload.eigeneUebungen, eintrag.id, false);
          eigeneZeichnen();
          await eigeneSpeichern();
        };
        aktionen.append(umbenennen, entfernen);
      } else {
        const wieder = document.createElement('button');
        wieder.type = 'button';
        wieder.textContent = 'Wieder einblenden';
        wieder.onclick = async () => {
          eigenesPayload.eigeneUebungen = setzeEigeneUebungAktiv(eigenesPayload.eigeneUebungen, eintrag.id, true);
          eigeneZeichnen();
          await eigeneSpeichern();
        };
        aktionen.appendChild(wieder);
      }
      zeile.appendChild(aktionen);
      eigeneListe.appendChild(zeile);
    });
  };
  eigeneZeichnen();

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
    if (error) { pwMsg.innerHTML = `<div class="msg err">${escapeHtml(error.message)}</div>`; return; }
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

  // Rechtliche Informationen bleiben auch nach der Registrierung jederzeit
  // mit wenigen Tipps erreichbar. Vor der Anmeldung stehen dieselben Links
  // direkt unter dem Formular.
  const rechtCard = profilSektion('Rechtliches');
  rechtCard.innerHTML = `
    <p class="profile-hinweis">Nutzungsbedingungen, Datenschutz, Anbieterangaben und Hinweise zur sicheren Nutzung von LOGMAN.</p>
    <div class="profile-recht-links">
      <a class="btn" href="#nutzung">Nutzung</a>
      <a class="btn" href="#datenschutz">Datenschutz</a>
      <a class="btn" href="#impressum">Impressum &amp; Hinweise</a>
    </div>`;

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

  container.appendChild(wrap);
}
