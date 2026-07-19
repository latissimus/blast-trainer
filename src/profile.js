import { supabase } from './supabase.js';
import { signOut } from './auth.js';
import { toast } from './log.js';
import { getTheme, setTheme } from './theme.js';

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

  // --- Diagnose: Benachrichtigungen und Ton -------------------------------
  //
  // Entstanden, weil der Pausentimer schwieg und sich vom Schreibtisch aus
  // nicht klaeren liess: Die Edge Function antwortete mit 200, das Abo stand,
  // und trotzdem kam nichts an. Alle verbleibenden Verdachte waren
  // Geraetezustaende, die man nur AUF dem Geraet sieht – und auf einem iPhone
  // tippt man keine Konsolenbefehle.
  //
  // Die zwei Knoepfe pruefen genau die beiden Wege, die der Timer benutzt,
  // einzeln und in Sekunden statt in einer Trainingspause.
  const diagCard = document.createElement('div');
  diagCard.className = 'card';
  diagCard.innerHTML = `
    <h2 class="section-title" style="font-size:18px;margin:0 0 12px">Benachrichtigungen</h2>
    <dl class="diag" id="pf-diag"></dl>`;

  const diagEl = diagCard.querySelector('#pf-diag');
  const zeile = (k, v, gut) =>
    `<dt>${k}</dt><dd class="${gut ? 'gut' : 'schlecht'}">${v}</dd>`;

  // Die bekannten Werte SOFORT schreiben, das Abo danach nachtragen.
  //
  // Wichtig: navigator.serviceWorker.ready loest NIE auf, wenn kein Worker
  // registriert ist – es haengt endlos, ohne zu werfen. Stuende der Aufruf
  // vor dem Zeichnen, bliebe die Liste ausgerechnet dann leer, wenn der
  // Service Worker das Problem IST. Darum der Wettlauf gegen eine Frist.
  function diagnose() {
    const homescreen = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    const erlaubnis = 'Notification' in window ? Notification.permission : '—';

    const zeichne = (aboText, aboGut) => {
      diagEl.innerHTML =
        zeile('Vom Homescreen', homescreen ? 'ja' : 'nein – iOS liefert so keinen Push', homescreen)
        + zeile('Erlaubnis', erlaubnis, erlaubnis === 'granted')
        + zeile('Push-Abo', aboText, aboGut);
    };
    zeichne('prüfe…', true);

    const frist = new Promise((r) => setTimeout(() => r('kein Service Worker'), 3000));
    const suche = (async () => {
      if (!('serviceWorker' in navigator)) return 'nicht unterstützt';
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.getSubscription();
      return s ? 'vorhanden' : 'fehlt';
    })().catch((e) => 'Fehler: ' + e.message);

    Promise.race([suche, frist]).then((t) => zeichne(t, t === 'vorhanden'));
  }
  diagnose();

  // Ton: weckt einen AudioContext und spielt sofort dieselben zwei Toene wie
  // der Timer. Bleibt es hier still, liegt es nicht am Timer, sondern an iOS.
  const tonBtn = document.createElement('button');
  tonBtn.className = 'btn btn-block';
  tonBtn.textContent = '🔊 Ton testen';
  tonBtn.onclick = async () => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { toast('Kein Audio auf diesem Gerät'); return; }
      const ctx = new AC();
      // await: resume() ist asynchron. Ohne das ist der Zustand direkt danach
      // noch "suspended" und der Ton bliebe aus – genau der Fehler im Timer.
      if (ctx.state !== 'running') await ctx.resume();
      if (ctx.state !== 'running') { toast('Ton blockiert: ' + ctx.state); return; }
      [0, 0.22].forEach((off) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        const t0 = ctx.currentTime + off;
        osc.frequency.setValueAtTime(880, t0);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.2);
      });
      toast('Ton gespielt – gehört?');
    } catch (e) {
      toast('Ton-Fehler: ' + e.message);
    }
  };
  diagCard.appendChild(tonBtn);

  // Push: bestellt einen echten Pausentimer ueber 5 Sekunden. Derselbe Weg wie
  // im Training, nur ohne zwei Minuten zu warten.
  const pushBtn = document.createElement('button');
  pushBtn.className = 'btn btn-block';
  pushBtn.style.marginTop = '8px';
  pushBtn.textContent = '🔔 Push testen (5 Sekunden)';
  pushBtn.onclick = async () => {
    if (!('Notification' in window)) { toast('Keine Mitteilungen auf diesem Gerät'); return; }
    if (Notification.permission !== 'granted') {
      const a = await Notification.requestPermission();
      diagnose();
      if (a !== 'granted') { toast('Erlaubnis: ' + a); return; }
    }
    const { error } = await supabase.functions
      .invoke('pausentimer', { body: { aktion: 'start', sekunden: 5, label: 'Test' } });
    if (error) { toast('Fehler: ' + error.message); return; }
    toast('Bildschirm sperren – kommt in 5 s');
  };
  diagCard.appendChild(pushBtn);
  wrap.appendChild(diagCard);

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
