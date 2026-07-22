import './styles.css';
import { supabase } from './supabase.js';
import { signIn, signUp, signOut, loadProfile, resetPassword, updatePassword } from './auth.js';
import { readProfile, writeProfile } from './localstore.js';
import { brandSvg } from './brand.js';
import { getTheme, applyTheme } from './theme.js';
import { registriereSW, abonniereStill, pushHinweisZeigen, pushHinweisWegwischen, erlaubnisFragen } from './push.js';
import { mountLog, toast } from './log.js';
import { mountProfile } from './profile.js';
import { mountFaq } from './faq.js';
import { mountMeter } from './meter.js';
import { mountProg } from './prog.js';
import { mountNotizbuch } from './notizbuch.js';
import { mountAdmin } from './admin.js';

// Vor dem ersten Rendern setzen, sonst blitzt das helle Theme kurz auf.
applyTheme(getTheme());

// Service Worker gleich beim Start registrieren – er liefert die App im
// Funkloch aus. Haengt bewusst an keiner Oberflaeche: Frueher hing er am
// Test-Knopf im Profil, und mit dessen Wegfall waere die Offline-Faehigkeit
// still gestorben. Fehler hier duerfen die App nicht aufhalten.
registriereSW().catch(() => {});

// Tipp auf eine Mitteilung mit Ziel: Der Worker kann das laufende Fenster nicht
// selbst umlenken, also sagt er uns nur, wohin. Der Falten-Wecker schickt so ins
// Profil – direkt zur Eingabe, statt irgendwo zu landen.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.typ === 'gehe-zu' && e.data.url) location.hash = e.data.url.replace(/^#/, '');
  });
}

const app = document.getElementById('app');
let session = null;
let profile = null;
let active = null;          // current view's { destroy } handle
let routeToken = 0;         // guards against stale async mounts
let authMode = 'login';     // 'login' | 'signup'
let recovery = false;       // aus der Zuruecksetzen-Mail gekommen: neues Passwort faellig
let splash = false;         // frisch eingeloggt: einmal das Logo zeigen
let topbarObserver = null;   // liefert Unterseiten die echte Sticky-Header-Hoehe
let aktiveAnsicht = null;    // fuer die Rueckkehr an dieselbe Stelle im Log
let logScrollY = 0;
let somPeekGezeigt = false;   // pro App-Start genau ein kurzer Hinweis

// Laufband – nur auf den abgemeldeten Ansichten (Login, neues Passwort, Laden,
// Fehler). In der App selbst bleibt es draussen: Dort willst du eintragen, nicht
// angesprochen werden.
//
// Inhalt ist bewusst die These hinter der App und keine Werbung – hier gibt es
// nichts zu verkaufen. Zwei identische Haelften, damit die Schleife nahtlos
// laeuft; jede muss breiter als der Bildschirm sein.
const MQ_TEXT = [
  'SCHLAG DEIN LETZTES MAL',
  'HEAVY · PUMP · CLUSTERS',
  '6 WOCHEN OVERREACH · OPTIONAL 1 WOCHE DELOAD',
  'LEVEL NACH TAGESFORM, NICHT NACH EHRGEIZ',
].join(' ◆ ') + ' ◆ ';
const MARQUEE = `<div class="marquee" aria-hidden="true"><span>${MQ_TEXT.repeat(2)}</span><span>${MQ_TEXT.repeat(2)}</span></div>`;

function cleanupActive() {
  if (active && active.destroy) active.destroy();
  active = null;
}

/* ------------------------------------------------------------ auth UI */
function renderAuth() {
  cleanupActive();
  const isLogin = authMode === 'login';
  app.innerHTML = `
    ${MARQUEE}
    <div class="auth-shell">
      <div style="text-align:center;margin-bottom:30px"><span class="brand" style="font-size:46px">${brandSvg()}</span></div>
      ${isLogin ? '' : '<h1 class="auth-title">Registrieren</h1>'}
      <p class="auth-sub">${isLogin ? 'Melde dich mit E-Mail und Passwort an.' : 'Erstelle deinen Trainings-Account.'}</p>
      <div id="auth-msg"></div>
      <form id="auth-form" class="card">
        ${isLogin ? '' : `<label class="fld-l" for="af-name">Name</label>
          <input class="input" id="af-name" type="text" autocomplete="name" placeholder="Dein Name">`}
        <label class="fld-l" for="af-email">E-Mail</label>
        <input class="input" id="af-email" type="email" autocomplete="email" required placeholder="du@mail.de">
        <label class="fld-l" for="af-pass">Passwort</label>
        <input class="input" id="af-pass" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="6" placeholder="••••••••">
        <button class="btn btn-primary btn-block" type="submit" id="af-submit">${isLogin ? 'Anmelden' : 'Account erstellen'}</button>
      </form>
      <div class="auth-switch">
        ${isLogin ? 'Noch keinen Account?' : 'Schon registriert?'}
        <button id="auth-toggle">${isLogin ? 'Registrieren' : 'Zur Anmeldung'}</button>
      </div>
      ${isLogin ? '<div class="auth-switch"><button id="auth-forgot">Passwort vergessen?</button></div>' : ''}
    </div>`;

  const msg = app.querySelector('#auth-msg');
  const showMsg = (text, kind) => { msg.innerHTML = `<div class="msg ${kind}">${text}</div>`; };

  app.querySelector('#auth-toggle').onclick = () => { authMode = isLogin ? 'signup' : 'login'; renderAuth(); };

  const forgotBtn = app.querySelector('#auth-forgot');
  if (forgotBtn) forgotBtn.onclick = async () => {
    const email = app.querySelector('#af-email').value.trim();
    if (!email) { showMsg('Trag oben deine E-Mail ein, dann schicken wir dir einen Link.', 'err'); return; }
    forgotBtn.disabled = true;
    try {
      await resetPassword(email);
      // Bewusst neutral: Ob es die Adresse gibt, verraten wir nicht.
      showMsg(`Wenn es einen Account für ${email} gibt, ist ein Link zum Zurücksetzen unterwegs. Schau auch im Spam nach.`, 'ok');
    } catch (err) {
      showMsg(translateErr(err), 'err');
    }
    forgotBtn.disabled = false;
  };

  app.querySelector('#auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = app.querySelector('#af-submit');
    const email = app.querySelector('#af-email').value.trim();
    const pass = app.querySelector('#af-pass').value;
    const name = app.querySelector('#af-name')?.value.trim() || '';
    btn.disabled = true;
    try {
      if (isLogin) {
        // Muss VOR signIn stehen: onAuthStateChange feuert waehrend des Aufrufs,
        // nicht danach – danach gesetzt kaeme das Flag zu spaet fuer render().
        splash = true;
        await signIn(email, pass);
        // onAuthStateChange handles the rest
      } else {
        const data = await signUp(email, pass, name);
        if (!data.session) {
          showMsg('Fast geschafft! Bitte bestätige deine E-Mail über den Link, den wir dir geschickt haben, und logge dich dann ein.', 'ok');
          authMode = 'login';
          setTimeout(renderAuth, 50);
        }
        // if a session exists (confirmations disabled), onAuthStateChange takes over
      }
    } catch (err) {
      splash = false;   // Login gescheitert: kein Logo zeigen
      showMsg(translateErr(err), 'err');
      btn.disabled = false;
    }
  };
}

// Nach dem Klick auf den Link aus der Zuruecksetzen-Mail: Supabase hat bereits
// eine Sitzung angelegt, es fehlt nur noch das neue Passwort. Ohne diese Maske
// landete man direkt im Log – mit dem alten, unbekannten Passwort.
function renderRecovery() {
  cleanupActive();
  app.innerHTML = `
    ${MARQUEE}
    <div class="auth-shell">
      <div style="text-align:center;margin-bottom:30px"><span class="brand" style="font-size:46px">${brandSvg()}</span></div>
      <h1 class="auth-title">Neues Passwort</h1>
      <p class="auth-sub">Wähle ein neues Passwort für deinen Account.</p>
      <div id="rc-msg"></div>
      <form id="rc-form" class="card">
        <label class="fld-l" for="rc-pass">Neues Passwort</label>
        <input class="input" id="rc-pass" type="password" autocomplete="new-password" required minlength="6" placeholder="••••••••">
        <label class="fld-l" for="rc-pass2">Wiederholen</label>
        <input class="input" id="rc-pass2" type="password" autocomplete="new-password" required minlength="6" placeholder="••••••••">
        <button class="btn btn-primary btn-block" type="submit" id="rc-submit">Passwort speichern</button>
      </form>
    </div>`;

  const msg = app.querySelector('#rc-msg');
  const showMsg = (t, k) => { msg.innerHTML = `<div class="msg ${k}">${t}</div>`; };

  app.querySelector('#rc-form').onsubmit = async (e) => {
    e.preventDefault();
    const p1 = app.querySelector('#rc-pass').value;
    const p2 = app.querySelector('#rc-pass2').value;
    if (p1 !== p2) { showMsg('Die beiden Passwörter stimmen nicht überein.', 'err'); return; }
    const btn = app.querySelector('#rc-submit');
    btn.disabled = true;
    try {
      await updatePassword(p1);
      recovery = false;
      await render();          // ab jetzt normal weiter, Sitzung besteht schon
    } catch (err) {
      showMsg(translateErr(err), 'err');
      btn.disabled = false;
    }
  };
}

function translateErr(err) {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-Mail oder Passwort falsch.';
  if (m.includes('already registered')) return 'Diese E-Mail ist bereits registriert.';
  if (m.includes('password')) return 'Passwort zu kurz (mind. 6 Zeichen).';
  if (m.includes('email')) return 'Bitte eine gültige E-Mail eingeben.';
  return err?.message || 'Etwas ist schiefgelaufen.';
}

/* Profilbild oben (statt "Profil"-Button); Klick öffnet die Profil-Seite. */
function navAvatar() {
  const email = session.user.email;
  if (profile.avatar_url) {
    return `<button class="nav-av" data-view="profile" aria-label="Profil"><img src="${profile.avatar_url}" alt=""></button>`;
  }
  const src = (profile.full_name || email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const ini = (parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2)).toUpperCase();
  return `<button class="nav-av nav-av-fb" data-view="profile" aria-label="Profil">${ini}</button>`;
}

/* ------------------------------------------------------------ app chrome */
function renderChrome() {
  aktiveAnsicht = null;
  logScrollY = 0;
  somPeekGezeigt = false;
  const isAdmin = profile?.role === 'admin';
  app.innerHTML = `
    <header class="topbar">
      <div class="wrap">
        <span class="brand">${brandSvg()}</span>
        <span class="phasechip" id="app-phase" hidden></span>
        <nav class="nav">
          <span class="save-dot ok" id="app-save" title="gespeichert" hidden>✓</span>
          ${navAvatar()}
        </nav>
      </div>
    </header>
    ${pushHinweisZeigen() ? `
      <div class="wrap"><div class="pushbar" id="pushbar">
        <button class="pb-go" id="pb-go">🔔 Benachrichtigungen aktivieren</button>
        <button class="pb-x" id="pb-x" aria-label="Nicht mehr fragen">×</button>
      </div></div>` : ''}
    <main id="view"></main>
    <div class="ctrlbar">
      <div class="inner">
        <div class="timerfeld" id="app-timer" hidden>
          <span class="mitte">
            <svg class="pausensymbol" viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
              <rect x="3.5" y="2.5" width="4.6" height="15" rx="1.6"/>
              <rect x="11.9" y="2.5" width="4.6" height="15" rx="1.6"/>
            </svg>
            <span id="app-timertxt">0:00</span>
          </span>
          <button class="x" id="app-timerx" aria-label="Timer abbrechen">×</button>
        </div>
        <div class="slots" id="app-slots">
          <label class="ci"><span class="wert" id="ci-wo-w">Wo 1</span><span class="lbl" id="ci-wo-l">Woche</span>
            <select id="lg-woche" aria-label="Woche" disabled></select></label>
          <label class="ci"><span class="wert" id="ci-tag-w">Tag 1</span><span class="lbl" id="ci-tag-l">—</span>
            <select id="lg-tag" aria-label="Tag" disabled></select></label>
          <label class="ci"><span class="wert" id="ci-lvl-w">III</span><span class="lbl" id="ci-lvl-l">Level</span>
            <select id="lg-tier" aria-label="Level" disabled>
              <option value="0">Kompakt · weniger Volumen</option>
              <option value="1">Standard · normales Volumen</option>
              <option value="2">Voll · höchstes Volumen</option>
            </select></label>
          <label class="ci"><span class="wert" id="ci-dat-w">—</span><span class="lbl">Datum</span>
            <input id="lg-datum" type="date" aria-label="Datum der Einheit" disabled></label>
        </div>
        <label class="ci menue"><span class="wert" id="app-menue-i"><svg viewBox="0 0 22 16" width="21" height="15" aria-hidden="true"><rect x="0" y="0" width="22" height="3.6" rx="1.8"/><rect x="0" y="6.2" width="22" height="3.6" rx="1.8"/><rect x="0" y="12.4" width="22" height="3.6" rx="1.8"/></svg></span><span class="lbl" id="app-menue-l">Log</span>
          <select id="app-menue" aria-label="Ansicht"></select></label>
      </div>
    </div>`;

  app.querySelectorAll('nav [data-view]').forEach((b) => {
    b.onclick = () => { location.hash = b.dataset.view; };
  });

  // Der Zurueck-zum-Log-Chip schwebt auf Unterseiten direkt unter dem Header.
  // Seine Position folgt der echten Headerhoehe (inkl. iPhone-Safe-Area), statt
  // sie mit einem geraetabhaengigen Pixelwert zu erraten.
  topbarObserver?.disconnect();
  const topbar = app.querySelector('.topbar');
  const schreibeTopbarHoehe = () => {
    document.documentElement.style.setProperty('--topbar-h', topbar.offsetHeight + 'px');
  };
  schreibeTopbarHoehe();
  topbarObserver = new ResizeObserver(schreibeTopbarHoehe);
  topbarObserver.observe(topbar);

  // Das Menue unten rechts. Inzwischen sind alle Ziele eigene Seiten – auch das
  // Set-O-Meter, das frueher ein Fenster ueber dem Log war.
  //
  // Grossbuchstaben stehen hier ausgeschrieben statt per text-transform: In
  // nativen <option>-Elementen setzt iOS die CSS-Auszeichnung nicht um.
  const menue = app.querySelector('#app-menue');
  menue.innerHTML = `
    <option value="log">LOG</option>
    <option value="notizbuch">NOTIZBUCH</option>
    <option value="meter">SET-O-METER</option>
    <option value="prog">PROGRESSION</option>
    <option value="faq">FAQs</option>
    ${isAdmin ? '<option value="admin">ADMIN</option>' : ''}`;
  menue.onchange = () => {
    const w = menue.value;
    location.hash = w;
  };

  // Einmaliger Hinweis. Eine native App darf beim ersten Start selbst fragen,
  // eine Web-App nicht – Apple verlangt einen echten Tipp. Nach dem Tippen ist
  // er fuer immer weg, egal wie die Antwort ausfiel.
  const pb = app.querySelector('#pushbar');
  if (pb) {
    app.querySelector('#pb-x').onclick = () => { pushHinweisWegwischen(); pb.remove(); };
    app.querySelector('#pb-go').onclick = async () => {
      const ok = await erlaubnisFragen(session.user.id);
      pb.remove();
      if (ok) toast('Benachrichtigungen aktiv');
    };
  }
}

function setNavActive(view) {
  app.querySelectorAll('nav [data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const m = app.querySelector('#app-menue');
  if (!m) return;
  m.value = view;
  // Traegt die Seitenfarbe: Jede Unterseite hat ihren eigenen Grundton, das Log
  // bleibt hellblau. Setzt --bg um, damit Kopfleiste und Bedienleiste von selbst
  // mitgehen, statt jede Flaeche einzeln umfaerben zu muessen.
  document.body.dataset.seite = view;
  const namen = { log: 'Log', faq: 'FAQ', meter: 'Set-O', prog: 'Prog', notizbuch: 'Notizbuch', admin: 'Admin', profile: 'Profil' };
  app.querySelector('#app-menue-l').textContent = namen[view] || 'Log';
  // Die vier Log-Felder bleiben auf jeder Seite sichtbar, damit die Leiste
  // ueberall gleich aussieht. Ohne gemountetes Log sind sie stillgelegt (siehe
  // destroy() in log.js) – sie zeigen dann den zuletzt gesehenen Stand.
}

async function routeView() {
  if (aktiveAnsicht === 'log') logScrollY = window.scrollY;
  cleanupActive();
  // Set-O-Lasche und Zurueck-Chip muessen physisch am Sticky-Header haengen.
  // Auf iOS wandert der Header beim Gummiband nach unten, fixed Elemente aber
  // nicht – dadurch erschienen sie im Header. Vor dem Ansichtswechsel alte
  // angedockte Elemente entfernen; die neue Ansicht wird unten neu angedockt.
  app.querySelectorAll('.topbar > .som-tab, .topbar > .zurueck')
    .forEach((el) => el.remove());
  const view = document.getElementById('view');
  if (!view) return;
  let hash = (location.hash.replace('#', '') || 'log');
  if (hash === 'admin' && profile?.role !== 'admin') hash = 'log';
  if (!['log', 'profile', 'admin', 'faq', 'meter', 'prog', 'notizbuch'].includes(hash)) hash = 'log';
  setNavActive(hash);

  const token = ++routeToken;
  const guard = (v) => { if (token !== routeToken) { v?.destroy?.(); return; } active = v; };

  view.innerHTML = '';
  try {
    if (hash === 'log') {
      const zeigeSomPeek = !somPeekGezeigt;
      somPeekGezeigt = true;
      const v = await mountLog(view, {
        userId: session.user.id,
        readOnly: false,
        zeigeSomPeek,
      });
      guard(v);
    } else if (hash === 'profile') {
      mountProfile(view, { session, profile, onProfileUpdated: (p) => { profile = p; } });
    } else if (hash === 'faq') {
      mountFaq(view);
    } else if (hash === 'meter') {
      await mountMeter(view, { userId: session.user.id });
    } else if (hash === 'prog') {
      await mountProg(view, { userId: session.user.id });
    } else if (hash === 'notizbuch') {
      // Die Huelle und der lokale Spiegel erscheinen sofort; der Serverstand
      // wird innerhalb der Seite nachgeladen und blockiert den Wechsel nicht.
      mountNotizbuch(view, { userId: session.user.id });
    } else if (hash === 'admin') {
      const v = await mountAdmin(view, { session });
      guard(v);
    }
  } catch (e) {
    view.innerHTML = `<div class="wrap" style="padding-top:20px"><div class="msg err">Fehler: ${e.message}</div></div>`;
  }
  if (token !== routeToken) return;
  const topbar = app.querySelector('.topbar');
  if (topbar) {
    const pull = view.querySelector('.som-tab');
    const zurueck = view.querySelector('.zurueck');
    if (pull) {
      topbar.appendChild(pull);
      if (pull.dataset.peek === 'true') requestAnimationFrame(() => {
        if (token !== routeToken) return;
        pull.classList.add('peek');
        // animation-fill-mode wuerde den Peek-Zustand sonst am Element halten.
        // Beim ersten manuellen Ziehen konkurrierte er dann mit der Transition
        // und liess Breite/Hoehe scheinbar in einem Sprung entstehen.
        pull.addEventListener('animationend', () => pull.classList.remove('peek'), { once: true });
      });
    }
    if (zurueck) topbar.appendChild(zurueck);
  }
  aktiveAnsicht = hash;
  const zielY = hash === 'log' ? logScrollY : 0;
  requestAnimationFrame(() => {
    if (token === routeToken) window.scrollTo({ top: zielY, behavior: 'instant' });
  });
}

// Begruessung nach dem Einloggen: nur das Logo, das aufzieht.
// Die 2 Sekunden sind keine Wartezeit, die wir draufschlagen – Profil und Log
// laden waehrenddessen im Hintergrund. Wer schneller fertig ist, wartet auf den
// anderen.
function showSplash() {
  cleanupActive();
  app.innerHTML = `<div class="splash"><span class="brand">${brandSvg()}</span></div>`;
  return new Promise((r) => setTimeout(r, 2000));
}

/* ------------------------------------------------------------ top-level render */
async function render() {
  cleanupActive();
  if (!session) { profile = null; recovery = false; splash = false; renderAuth(); return; }
  if (recovery) { renderRecovery(); return; }

  const splashFertig = splash ? showSplash() : null;
  splash = false;

  if (!profile || profile.id !== session.user.id) {
    // Nur wenn kein Splash laeuft – sonst wuerde er ihn ueberschreiben.
    // Dasselbe aufziehende Logo wie beim Anmelden. Es endet aber nicht, sondern
    // atmet danach weiter: Dieser Schirm steht ohne WLAN deutlich laenger, und
    // ein eingefrorenes Logo sieht aus wie eine haengende App.
    if (!splashFertig) app.innerHTML = `${MARQUEE}<div class="ladebild"><span class="brand">${brandSvg()}</span><p class="auth-sub">lädt…</p></div>`;
    const zwischengespeichert = readProfile(session.user.id);
    if (!navigator.onLine && zwischengespeichert) {
      // Nachweislich offline: gar nicht erst fragen. Der Versuch laeuft nur in
      // einen Timeout, und solange haengt man auf dem Ladebildschirm.
      profile = zwischengespeichert;
    } else try {
      profile = await loadProfile(session.user.id);
      if (profile) writeProfile(session.user.id, profile);
    } catch (e) {
      // Ohne Netz auf das zuletzt bekannte Profil zurueckfallen. Sonst kaeme man
      // im Studio nie bis zum Log – obwohl die Trainingsdaten dort lokal liegen.
      profile = zwischengespeichert;
      if (!profile) {
        app.innerHTML = `${MARQUEE}<div class="auth-shell"><div class="msg err">Profil konnte nicht geladen werden: ${e.message}</div><button class="btn btn-block" id="lo">Abmelden</button></div>`;
        app.querySelector('#lo').onclick = () => signOut();
        return;
      }
    }
    if (!profile) {
      app.innerHTML = `${MARQUEE}<div class="auth-shell"><div class="msg err">Kein Profil gefunden. Bitte neu einloggen.</div><button class="btn btn-block" id="lo">Abmelden</button></div>`;
      app.querySelector('#lo').onclick = () => signOut();
      return;
    }
  }
  // Splash stehen lassen, bis er seine 2 Sekunden hatte – auch wenn das Profil
  // laengst da ist. Die Fehlerpfade oben sind vorher raus, ein Fehler soll nicht
  // hinter dem Logo warten muessen.
  if (splashFertig) await splashFertig;
  renderChrome();
  await routeView();

  // Push-Abo im Hintergrund auffrischen. Ein Abo stirbt, wenn die App vom
  // Homescreen geloescht wird – ohne das hier bliebe die Datenbank auf toten
  // Endpunkten sitzen, die Apple sogar noch mit 201 annimmt.
  if (navigator.onLine) abonniereStill(session.user.id);
}

/* ------------------------------------------------------------ boot */
window.addEventListener('hashchange', () => { if (session && profile) routeView(); });

// Das Zugangstoken laeuft nach einer Stunde ab. Ist man dann ohne Netz, kann
// Supabase es nicht erneuern und gibt gar keine Sitzung zurueck – die App
// warf einen im Funkloch also raus, obwohl die Anmeldung voellig in Ordnung ist.
//
// Die gespeicherte Sitzung liegt dabei unberuehrt im Speicher. Offline brauchen
// wir daraus nur die Nutzer-ID, um den lokalen Spiegel zu lesen; Serveraufrufe
// scheitern ohnehin und holt die Warteschlange nach. Sobald wieder Netz da ist,
// erneuert Supabase von selbst.
function gespeicherteSitzung() {
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
    const roh = localStorage.getItem(`sb-${ref}-auth-token`);
    const s = roh ? JSON.parse(roh) : null;
    return s && s.user && s.user.id ? s : null;
  } catch (e) {
    return null;
  }
}

supabase.auth.onAuthStateChange((event, newSession) => {
  // Ein fehlgeschlagener Token-Refresh kann offline als "keine Sitzung"
  // hereinkommen. Das ist kein Logout – nur ausdrueckliches SIGNED_OUT ist einer.
  if (!newSession && event !== 'SIGNED_OUT') return;
  const prevUser = session?.user?.id;
  session = newSession;
  // Der Link aus der Zuruecksetzen-Mail legt bereits eine Sitzung an. Ohne
  // dieses Flag ginge es direkt ins Log – und das Passwort bliebe unbekannt.
  if (event === 'PASSWORD_RECOVERY') { recovery = true; render(); return; }
  if (session?.user?.id !== prevUser) render();
});

(async function boot() {
  // Offline gar nicht erst fragen: getSession() versucht ein abgelaufenes Token
  // zu erneuern und laeuft dabei in einen Timeout. Die gespeicherte Sitzung
  // reicht hier – offline brauchen wir daraus nur die Nutzer-ID.
  if (!navigator.onLine) {
    session = gespeicherteSitzung();
    await render();
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  session = data.session;
  // Nur bei einem Netzfehler zurueckfallen. Supabase unterscheidet das selbst:
  // AuthRetryableFetchError heisst "Netz weg", ein AuthApiError hiesse "Token
  // ungueltig" – dann gehoert man tatsaechlich abgemeldet.
  if (!session && error && error.name === 'AuthRetryableFetchError') {
    session = gespeicherteSitzung();
  }
  await render();
})();
