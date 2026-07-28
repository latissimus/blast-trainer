import './styles.css';
import { supabase } from './supabase.js';
import { signIn, signUp, signOut, loadProfile, resetPassword, updatePassword } from './auth.js';
import { readProfile, writeProfile } from './localstore.js';
import { brandSvg, actionTitleSvg } from './brand.js';
import { getTheme, applyTheme, statusleisteAnSeite, setStatusleistenOverlay } from './theme.js';
import { registriereSW, abonniereStill, pushHinweisZeigen, pushHinweisWegwischen, erlaubnisFragen } from './push.js';
import { mountLog, toast } from './log.js';
import { mountProfile } from './profile.js';
import { mountFaq } from './faq.js';
import { mountMeter } from './meter.js';
import { mountProg } from './prog.js';
import { mountNotizbuch } from './notizbuch.js';
import { mountAdmin } from './admin.js';
import { mountFeedback } from './feedback.js';
import { verbindePausenAnzeige, stoppePause } from './pause.js';
import { sondeAnwenden, sondeLesen } from './sonde.js';   // VORUEBERGEHEND

// Vor dem ersten Rendern setzen, sonst blitzt das helle Theme kurz auf.
applyTheme(getTheme());

// ===== VORUEBERGEHEND – zusammen mit src/sonde.js wieder entfernen! =====
sondeAnwenden();

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
let willkommen = false;     // frisch registriert: vor dem Tutorial willkommen heissen
let topbarObserver = null;   // liefert Unterseiten die echte Sticky-Header-Hoehe
let aktiveAnsicht = null;    // fuer die Rueckkehr an dieselbe Stelle im Log
let logScrollY = 0;
const WILLKOMMEN_EMAIL = 'blast:willkommen-email';

// Laufband – nur auf den abgemeldeten Ansichten (Login, neues Passwort, Laden,
// Fehler). In der App selbst bleibt es draussen: Dort willst du eintragen, nicht
// angesprochen werden.
//
// Inhalt ist bewusst die These hinter der App und keine Werbung – hier gibt es
// nichts zu verkaufen. Zwei identische Haelften, damit die Schleife nahtlos
// laeuft; jede muss breiter als der Bildschirm sein.
const MQ_TEXT = [
  'SCHLAG DEIN LETZTES MAL',
  'HEAVYS · MIDDLES · PUMPS · CYCLES',
  '7 CYCLES · DANACH OPTIONAL 1 WOCHE DELOAD',
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
  stoppePause(false);
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
        const wartendeAdresse = localStorage.getItem(WILLKOMMEN_EMAIL);
        willkommen = wartendeAdresse === email.toLowerCase();
        splash = !willkommen;
        await signIn(email, pass);
        // onAuthStateChange handles the rest
      } else {
        // Auch dieses Flag muss vor signUp stehen: Bei deaktivierter
        // Mail-Bestaetigung liefert Supabase sofort eine Sitzung und feuert das
        // Auth-Ereignis noch waehrend des Aufrufs.
        willkommen = true;
        localStorage.setItem(WILLKOMMEN_EMAIL, email.toLowerCase());
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
      willkommen = false;
      if (!isLogin) localStorage.removeItem(WILLKOMMEN_EMAIL);
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
          <label class="ci"><span class="wert" id="ci-wo-w">1</span><span class="lbl" id="ci-wo-l">Cycle</span>
            <select id="lg-woche" aria-label="Cycle" disabled></select></label>
          <label class="ci"><span class="wert" id="ci-tag-w">OK</span><span class="lbl" id="ci-tag-l">HEAVYS</span>
            <select id="lg-tag" aria-label="Einheit" disabled></select></label>
          <label class="ci"><span class="wert" id="ci-lvl-w">II</span><span class="lbl" id="ci-lvl-l">Standard</span>
            <select id="lg-tier" aria-label="Level" disabled>
              <option value="0">Kompakt · weniger Volumen</option>
              <option value="1">Standard · normales Volumen</option>
              <option value="2">Selektiv · Volumen selbst erhöhen</option>
            </select></label>
          <label class="ci"><span class="wert" id="ci-dat-w">—</span><span class="lbl">Datum</span>
            <input id="lg-datum" type="date" aria-label="Datum der Einheit" disabled></label>
        </div>
        <label class="ci menue">
          <span class="menue-computer" aria-hidden="true">
            <svg viewBox="0 0 62 55" preserveAspectRatio="none">
              <defs>
                <mask id="menue-fenster-ausschnitt" maskUnits="userSpaceOnUse">
                  <rect width="62" height="55" fill="#FFFFFF"/>
                  <rect x="7" y="21" width="43" height="23" rx="5" fill="#000000"/>
                </mask>
              </defs>
              <rect x="6" y="5" width="53" height="47" rx="7" fill="#7560E6" mask="url(#menue-fenster-ausschnitt)"/>
              <rect x="2" y="2" width="54" height="47" rx="7" fill="#F2A5DA" stroke="#8968FF" stroke-width="2.3" mask="url(#menue-fenster-ausschnitt)"/>
              <path d="M9 2h40a7 7 0 0 1 7 7v8H2V9a7 7 0 0 1 7-7Z" fill="#AEEBFA"/>
              <path d="M2 17h54" fill="none" stroke="#8968FF" stroke-width="2.3"/>
              <path d="M31 11h4" fill="none" stroke="#8968FF" stroke-width="1.8" stroke-linecap="round"/>
              <rect x="38" y="7.5" width="5" height="5" fill="none" stroke="#8968FF" stroke-width="1.5"/>
              <path d="m46 7.5 5 5m0-5-5 5" fill="none" stroke="#8968FF" stroke-width="1.5" stroke-linecap="round"/>
              <rect x="7" y="21" width="43" height="23" rx="5" fill="none" stroke="#8968FF" stroke-width="1.8"/>
              <text class="menue-computer-text" x="28.5" y="32.5" fill="#111111" font-family="'Helvetica Neue',Arial,system-ui,sans-serif" font-size="9.6" font-style="italic" font-weight="900" text-anchor="middle" dominant-baseline="middle">MENÜ</text>
            </svg>
          </span>
          <select id="app-menue" aria-label="Ansicht"></select>
        </label>
      </div>
    </div>`;
  verbindePausenAnzeige();

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

  // Das native Auswahlmenü ist auf dem Telefon zuverlässig und sofort
  // verständlich. Es bleibt bewusst nur im Log sichtbar; Unterseiten führen
  // über den bereits vorhandenen Zurück-zum-Log-Button zurück.
  const menue = app.querySelector('#app-menue');
  menue.innerHTML = `
    <option value="log">LOG</option>
    <option value="notizbuch">NOTIZBUCH</option>
    <option value="meter">SET-O-METER</option>
    <option value="prog">PROGRESSION</option>
    <option value="feedback">FEEDBACK</option>
    <option value="faq">FAQs</option>
    ${isAdmin ? '<option value="admin">ADMIN</option>' : ''}`;
  menue.onchange = () => {
    // ===== VORUEBERGEHENDE SONDE I – mit src/sonde.js wieder entfernen! =====
    // Die Bildschirmfotos zeigen den Fehler in einem Zustand, den keine der
    // bisherigen Sonden abgedeckt hat: Das native iOS-Auswahlrad ist noch
    // sichtbar, die neue Seite steht bereits, und die Kopfzeile fehlt. Der
    // Platz ist da, nur die Pixel fehlen.
    //
    // onchange feuert auf iOS, WAEHREND das Rad noch zufaehrt. Der Seitenwechsel
    // faellt damit mitten in die Schliessanimation eines System-Overlays – und
    // waehrend Safari die animiert, verliert die klebende Kopfzeile ihre Ebene.
    // Diese Sonde wartet, bis das Rad weg ist, und wechselt erst danach.
    // Der Wechsel fuehlt sich dadurch traeger an; das ist der Preis der Probe.
    if (sondeLesen() === 'i') {
      const ziel = menue.value;
      setTimeout(() => { location.hash = ziel; }, 350);
      return;
    }
    location.hash = menue.value;
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
  //
  // AUCH auf <html>, nicht nur auf <body>: Die Leinwand hinter der Seite nimmt
  // die Farbe von <html>. Stand --bg nur auf <body>, blieb <html> beim
  // Grundton des Logs – auf der Progression war unterhalb des Inhalts und beim
  // Ueberscrollen deshalb ein hellblauer Streifen zu sehen.
  document.documentElement.dataset.seite = view;
  document.body.dataset.seite = view;
  // Erst jetzt steht das --bg dieser Seite fest – die Systemleiste oben zieht
  // mit. Eine Regel fuer alle Ansichten, ohne Sonderfaelle.
  statusleisteAnSeite();
  // Die Log-Leiste gehoert dem Log. Auf Unterseiten verschwindet sie komplett,
  // weil der Zurueck-zum-Log-Button oben bereits den eindeutigen Rueckweg
  // anbietet. Der Admin behaelt seine Trainingsfelder, aber nicht das Menue.
  const leiste = document.querySelector('.ctrlbar');
  leiste?.classList.toggle('nur-menue', view !== 'log' && view !== 'admin');
  leiste?.classList.toggle('ohne-menue', view !== 'log');
}

async function routeView() {
  if (aktiveAnsicht === 'log') logScrollY = window.scrollY;
  const view = document.getElementById('view');
  if (!view) return;
  let hash = (location.hash.replace('#', '') || 'log');
  if (hash === 'admin' && profile?.role !== 'admin') hash = 'log';
  if (!['log', 'profile', 'admin', 'faq', 'meter', 'prog', 'feedback', 'notizbuch'].includes(hash)) hash = 'log';
  setNavActive(hash);

  // ===== VORUEBERGEHENDE SONDE P – mit src/sonde.js wieder entfernen! =====
  // HALBIERUNG statt naechster Verdaechtiger. Zwoelf Einzelproben haben nichts
  // gebracht, also wird der Seitenwechsel in seine zwei Haelften zerlegt:
  //   1. Umschalten   – Farben, data-seite, Klassen der Bedienleiste, Chip weg
  //   2. Inhaltstausch – alte Seite raus, neue rein
  // Diese Sonde fuehrt NUR Teil 1 aus und bricht davor ab. Der Bildschirm zeigt
  // danach den alten Inhalt in den neuen Farben – sichtbar falsch, aber genau
  // das ist der Zweck.
  //   Flackert es weiter -> die Ursache steckt im Umschalten
  //   Flackert es nicht  -> die Ursache steckt im Inhaltstausch
  // Beide Ausgaenge halbieren den Suchraum; bisher konnte keine Sonde das.
  //
  // NIEMALS auf dem Profil: Dort sitzt der Schalter, mit dem man die Sonde
  // wieder ausmacht. Ohne diese Ausnahme sperrt sie sich selbst ein – genau
  // das ist passiert, und es war ein vermeidbarer Fehler.
  if (sondeLesen() === 'p' && hash !== 'profile') return;

  cleanupActive();

  // ===== VORUEBERGEHENDE SONDE G – mit src/sonde.js wieder entfernen! =====
  // Prueft die Vermutung, dass der SPRUNG der Scrollposition das Flackern
  // ausloest, nicht dessen Zeitpunkt. Nachgemessen: Beim Wechsel von einer
  // runtergescrollten FAQ (scrollY 1200) ins Log stand der Inhalt schon auf
  // Log, waehrend scrollY noch 1200 war – danach sprang es auf 700.
  //
  // Diese Sonde beseitigt JEDEN Sprung: Erst wird die alte, noch sichtbare
  // Seite nach oben gescrollt (ein gewoehnlicher Scrollvorgang, kein
  // Zwischenbild), dann getauscht, und die Zielposition bleibt 0. Damit
  // beginnt und endet jeder Wechsel bei 0. Der Preis: Das Log merkt sich
  // seine Position nicht mehr – genau deshalb ist es eine Sonde und kein Fix.
  const sondeOhneSprung = sondeLesen() === 'g';
  if (sondeOhneSprung) window.scrollTo({ top: 0, behavior: 'instant' });

  // Der Zurueck-Chip haengt physisch am Sticky-Header. Vor dem
  // Ansichtswechsel alte angedockte Elemente entfernen.
  app.querySelectorAll('.topbar > .zurueck')
    .forEach((el) => el.remove());

  const token = ++routeToken;
  const guard = (v) => { if (token !== routeToken) { v?.destroy?.(); return; } active = v; };

  // Unterseiten zunächst außerhalb des sichtbaren Views aufbauen und erst
  // vollständig einsetzen. Das bisherige sofortige Leeren zeigte auf iOS für
  // einen Frame nur den Seitenhintergrund – sichtbar als kurzes Flackern.
  // Das Log bleibt wegen seiner festen Tutorial-/Picker-Ebenen am echten View.
  // ===== VORUEBERGEHENDE SONDE Q – mit src/sonde.js wieder entfernen! =====
  // Haelt die Dokumenthoehe waehrend des Tauschs fest.
  // Sonde P hat das Umschalten entlastet, es liegt am Inhaltstausch. Und der
  // Nebenbefund vom Geraet nennt den Mechanismus: Auch das Zuklappen eines
  // <details> laesst die Kopfzeile flackern. Beides hat nur eines gemeinsam –
  // die Dokumenthoehe aendert sich schlagartig (beim Wechsel gemessen:
  // 7829 -> 5103 Pixel). Eine klebende Leiste haengt genau daran.
  // Diese Sonde friert die bisherige Hoehe ein, bis der Tausch durch ist, und
  // gibt sie erst im naechsten Bild wieder frei. Schrumpfen kann das Dokument
  // dadurch waehrend des Tauschs nicht mehr.
  const sondeHoeheHalten = sondeLesen() === 'q';
  if (sondeHoeheHalten) view.style.minHeight = `${view.getBoundingClientRect().height}px`;

  const ziel = hash === 'log' ? view : document.createElement('div');
  if (ziel === view) view.innerHTML = '';
  try {
    if (hash === 'log') {
      const v = await mountLog(ziel, {
        userId: session.user.id,
        readOnly: false,
      });
      guard(v);
    } else if (hash === 'profile') {
      mountProfile(ziel, { session, profile, onProfileUpdated: (p) => { profile = p; } });
    } else if (hash === 'faq') {
      mountFaq(ziel);
    } else if (hash === 'meter') {
      const v = await mountMeter(ziel, { userId: session.user.id });
      guard(v);
    } else if (hash === 'prog') {
      await mountProg(ziel, { userId: session.user.id });
    } else if (hash === 'feedback') {
      await mountFeedback(ziel, { session, profile });
    } else if (hash === 'notizbuch') {
      // Die Huelle und der lokale Spiegel erscheinen sofort; der Serverstand
      // wird innerhalb der Seite nachgeladen und blockiert den Wechsel nicht.
      mountNotizbuch(ziel, { userId: session.user.id });
    } else if (hash === 'admin') {
      const v = await mountAdmin(ziel, { session });
      guard(v);
    }
  } catch (e) {
    ziel.innerHTML = `<div class="wrap" style="padding-top:20px"><div class="msg err">Fehler: ${e.message}</div></div>`;
  }
  if (token !== routeToken) return;
  if (ziel !== view) view.replaceChildren(...ziel.childNodes);
  const topbar = app.querySelector('.topbar');
  if (topbar) {
    const zurueck = view.querySelector('.zurueck');
    if (zurueck) topbar.appendChild(zurueck);
  }
  aktiveAnsicht = hash;
  const zielY = sondeOhneSprung ? 0 : (hash === 'log' ? logScrollY : 0);

  // SYNCHRON, nicht im naechsten Bild. Genau hier sass das kurze Flackern der
  // Kopfzeile: Der Inhalt war schon getauscht, die Scrollposition aber noch die
  // der alten Seite – nachgemessen stand die Seite bereits auf "prog", waehrend
  // scrollY noch bei 600 lag. Der Browser durfte diesen Zwischenstand zeichnen,
  // erst ein Bild spaeter sprang er an die richtige Stelle.
  //
  // Deshalb trat es auch nur nach dem Scrollen auf: Ohne Scrollen sind alte und
  // neue Position beide 0, und es gibt nichts zu springen.
  //
  // Ein offenes Tutorial/Overlay haelt iOS-Fenster und Body bewusst bei 0 und
  // scrollt nur den Seiteninhalt #view. Sonst wuerde dieser Routen-Scroll die
  // Sperre direkt nach dem Mounten wieder aushebeln.
  const scrollSetzen = () => {
    if (token !== routeToken) return;
    if (document.documentElement.classList.contains('overlay-scroll-gesperrt')) {
      view.scrollTo({ top: zielY, behavior: 'instant' });
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: zielY, behavior: 'instant' });
    }
  };
  scrollSetzen();
  // Nachfassen im naechsten Bild: Wird die Seite durch spaet fertige Bilder
  // oder Schriften noch hoeher, war das Ziel eben noch nicht erreichbar. Steht
  // die Position schon richtig, ist der zweite Aufruf wirkungslos.
  requestAnimationFrame(() => {
    scrollSetzen();
    // Sonde Q: Hoehensperre erst jetzt loesen – der Tausch ist durch.
    if (sondeHoeheHalten) view.style.minHeight = '';
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

// Direkt nach der Registrierung fuehrt ein kurzer eigener Auftakt in das
// Tutorial. Er laeuft parallel zum Laden des Profils und verlaengert den Start
// deshalb nur dann, wenn das Profil schneller als die Animation da ist.
function showWillkommen() {
  cleanupActive();
  localStorage.removeItem(WILLKOMMEN_EMAIL);
  app.innerHTML = '';
  const fx = document.createElement('div');
  fx.className = 'tutorial-startfx willkommen-fx';
  fx.setAttribute('role', 'status');
  fx.setAttribute('aria-live', 'polite');
  fx.innerHTML = `
      <div class="tutorial-startfx-strahlen" aria-hidden="true"></div>
      <div class="tutorial-startfx-inhalt">
        <small>Dein LOGMAN ist bereit</small>
        ${actionTitleSvg('PLAN EINRICHTEN')}
        <span>Als Nächstes erklärt das Tutorial deinen Plan und führt dich durch die Übungsauswahl.</span>
      </div>`;
  // GEFUNDENES WETTRENNEN: Diese Funktion faerbte die Statusleiste frueher
  // selbst wieder zurueck, auf einem eigenen, von aussen unabhaengigen Timer
  // (~8s). render() setzt aber laengst VORHER (bei "bereit", ~6.35s) die
  // naechste Seite und ggf. einstiegHervorheben(), das die Leiste bewusst
  // dunkel haelt. Der spaete Timer hier ueberschrieb diese Absicht wieder mit
  // Hell – die Karte "LOGMAN einrichten" zeigte deshalb eine helle Leiste,
  // obwohl ihr eigener Dimmer laengst aktiv war. Die Statusleiste ist jetzt
  // Sache von render() (siehe applyTheme(getTheme()) dort): Diese Funktion
  // fasst sie fuer die Dauer des Auftakts nur an und ruehrt sie danach nicht
  // mehr an.
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  themeMeta?.setAttribute('content', '#B1E7FF');
  document.body.appendChild(fx);
  requestAnimationFrame(() => fx.classList.add('an'));
  const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bereit = new Promise((r) => setTimeout(r, reduziert ? 3000 : 6350));
  const fertig = new Promise((r) => setTimeout(() => { fx.remove(); r(); }, reduziert ? 3200 : 8050));
  return { bereit, fertig };
}

function einstiegHervorheben() {
  const karte = app.querySelector('.log-einstieg');
  if (!karte) return;
  document.body.classList.add('einstieg-fokus');
  setStatusleistenOverlay('einstieg', true);
  karte.classList.add('willkommen-fokus');
  const verlassen = () => {
    document.body.classList.remove('einstieg-fokus');
    karte.classList.remove('willkommen-fokus');
    setStatusleistenOverlay('einstieg', false);
  };
  // "Tutorial starten" behaelt die dunkle Leiste bewusst bei: Die naechste
  // Karte (Setup-Schritt) braucht exakt dieselbe Abdunklung, log.js uebernimmt
  // sie nahtlos. Sie hier kurz auszuschalten wuerde nur ein Aufblitzen der
  // hellen Farbe zwischen den beiden Karten erzeugen.
  karte.querySelector('.log-einstieg-los')?.addEventListener('click', () => {
    document.body.classList.remove('einstieg-fokus');
    karte.classList.remove('willkommen-fokus');
    setStatusleistenOverlay('einstieg', false);
  }, { once: true });
  // Ueberspringen oder der FAQ-Link verlassen die Einrichtung ganz – hier MUSS
  // die Statusleiste wieder hell werden.
  karte.querySelector('.log-einstieg-skip')?.addEventListener('click', verlassen, { once: true });
  karte.querySelector('a')?.addEventListener('click', verlassen, { once: true });
}

/* ------------------------------------------------------------ top-level render */
async function render() {
  cleanupActive();
  if (!session) { profile = null; recovery = false; splash = false; willkommen = false; renderAuth(); return; }
  if (recovery) { renderRecovery(); return; }

  // Manche Mail-Bestaetigungslinks stellen die Sitzung direkt beim Neuladen
  // her, ohne dass der Nutzer danach noch einmal auf „Anmelden“ tippt.
  const wartendeAdresse = localStorage.getItem(WILLKOMMEN_EMAIL);
  if (wartendeAdresse && wartendeAdresse === session.user.email?.toLowerCase()) willkommen = true;
  const willkommenAblauf = willkommen ? showWillkommen() : null;
  const splashFertig = !willkommenAblauf && splash ? showSplash() : null;
  splash = false;
  willkommen = false;

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
  if (willkommenAblauf) await willkommenAblauf.bereit;
  else if (splashFertig) await splashFertig;
  // Statusleiste auf den korrekten Ausgangswert zuruecksetzen, JEDES Mal, bevor
  // die Seite gebaut wird – nicht per Timer irgendwann spaeter (siehe
  // showWillkommen: genau das erzeugte ein Wettrennen mit
  // einstiegHervorheben() weiter unten und liess die Leiste bei "LOGMAN
  // einrichten" faelschlich hell). applyTheme ist idempotent, ausserhalb des
  // Willkommens-Auftakts aendert dieser Aufruf sichtbar nichts.
  applyTheme(getTheme());
  renderChrome();
  await routeView();
  if (willkommenAblauf) {
    // Der Fokus liegt bereits fertig HINTER der hellblauen Flaeche. Sobald sie
    // herunterfaehrt, wird deshalb direkt die abgedunkelte Seite mit der
    // pulsierenden Einstiegskarte sichtbar – ohne Zwischenbild.
    einstiegHervorheben();
    app.classList.add('willkommen-nachzug');
    setTimeout(() => app.classList.remove('willkommen-nachzug'), 1700);
  }

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
