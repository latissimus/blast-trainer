import './styles.css';
import { supabase } from './supabase.js';
import { signIn, signUp, signOut, loadProfile, resetPassword, updatePassword } from './auth.js';
import { readProfile, writeProfile } from './localstore.js';
import { brandSvg } from './brand.js';
import { mountLog } from './log.js';
import { mountProfile } from './profile.js';
import { mountAdmin } from './admin.js';

const app = document.getElementById('app');
let session = null;
let profile = null;
let active = null;          // current view's { destroy } handle
let routeToken = 0;         // guards against stale async mounts
let authMode = 'login';     // 'login' | 'signup'
let recovery = false;       // aus der Zuruecksetzen-Mail gekommen: neues Passwort faellig

// Laufband – nur auf den abgemeldeten Ansichten (Login, neues Passwort, Laden,
// Fehler). In der App selbst bleibt es draussen: Dort willst du eintragen, nicht
// angesprochen werden.
//
// Inhalt ist bewusst die These hinter der App und keine Werbung – hier gibt es
// nichts zu verkaufen. Zwei identische Haelften, damit die Schleife nahtlos
// laeuft; jede muss breiter als der Bildschirm sein.
const MQ_TEXT = [
  'SCHLAG DEIN LETZTES MAL',
  'LOADING · PUMP · MUSCLE ROUNDS',
  '6 WOCHEN BLAST · 2 WOCHEN CRUISE',
  'TIER NACH TAGESFORM, NICHT NACH EHRGEIZ',
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
      <h1 class="auth-title">${isLogin ? 'Login' : 'Registrieren'}</h1>
      <p class="auth-sub">${isLogin ? 'Melde dich mit E-Mail und Passwort an.' : 'Erstelle deinen Trainings-Account.'}</p>
      <div id="auth-msg"></div>
      <form id="auth-form" class="card">
        ${isLogin ? '' : `<label class="fld-l" for="af-name">Name</label>
          <input class="input" id="af-name" type="text" autocomplete="name" placeholder="Dein Name">`}
        <label class="fld-l" for="af-email">E-Mail</label>
        <input class="input" id="af-email" type="email" autocomplete="email" required placeholder="du@mail.de">
        <label class="fld-l" for="af-pass">Passwort</label>
        <input class="input" id="af-pass" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required minlength="6" placeholder="••••••••">
        <button class="btn btn-primary btn-block" type="submit" id="af-submit">${isLogin ? 'Einloggen' : 'Account erstellen'}</button>
      </form>
      <div class="auth-switch">
        ${isLogin ? 'Noch keinen Account?' : 'Schon registriert?'}
        <button id="auth-toggle">${isLogin ? 'Registrieren' : 'Zum Login'}</button>
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
  const isAdmin = profile?.role === 'admin';
  app.innerHTML = `
    <header class="topbar">
      <div class="wrap">
        <span class="brand">${brandSvg()}</span>
        <nav class="nav">
          <button class="nav-btn" data-view="log">Log</button>
          ${isAdmin ? '<button class="nav-btn pink" data-view="admin">Admin</button>' : ''}
          <button class="nav-btn" id="nav-logout">Logout</button>
          ${navAvatar()}
        </nav>
      </div>
    </header>
    <main id="view"></main>`;

  app.querySelectorAll('nav [data-view]').forEach((b) => {
    b.onclick = () => { location.hash = b.dataset.view; };
  });
  app.querySelector('#nav-logout').onclick = async () => { await signOut(); };
}

function setNavActive(view) {
  app.querySelectorAll('nav [data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
}

async function routeView() {
  cleanupActive();
  const view = document.getElementById('view');
  if (!view) return;
  let hash = (location.hash.replace('#', '') || 'log');
  if (hash === 'admin' && profile?.role !== 'admin') hash = 'log';
  if (!['log', 'profile', 'admin'].includes(hash)) hash = 'log';
  setNavActive(hash);

  const token = ++routeToken;
  const guard = (v) => { if (token !== routeToken) { v?.destroy?.(); return; } active = v; };

  view.innerHTML = '';
  try {
    if (hash === 'log') {
      const v = await mountLog(view, { userId: session.user.id, readOnly: false });
      guard(v);
    } else if (hash === 'profile') {
      mountProfile(view, { session, profile, onProfileUpdated: (p) => { profile = p; } });
    } else if (hash === 'admin') {
      const v = await mountAdmin(view, { session });
      guard(v);
    }
  } catch (e) {
    view.innerHTML = `<div class="wrap" style="padding-top:20px"><div class="msg err">Fehler: ${e.message}</div></div>`;
  }
}

/* ------------------------------------------------------------ top-level render */
async function render() {
  cleanupActive();
  if (!session) { profile = null; recovery = false; renderAuth(); return; }
  if (recovery) { renderRecovery(); return; }

  if (!profile || profile.id !== session.user.id) {
    app.innerHTML = `${MARQUEE}<div class="wrap" style="padding-top:40px;text-align:center"><div class="brand" style="font-size:30px">${brandSvg()}</div><p class="auth-sub">lädt…</p></div>`;
    try {
      profile = await loadProfile(session.user.id);
      if (profile) writeProfile(session.user.id, profile);
    } catch (e) {
      // Ohne Netz auf das zuletzt bekannte Profil zurueckfallen. Sonst kaeme man
      // im Studio nie bis zum Log – obwohl die Trainingsdaten dort lokal liegen.
      profile = readProfile(session.user.id);
      if (!profile) {
        app.innerHTML = `${MARQUEE}<div class="auth-shell"><div class="msg err">Profil konnte nicht geladen werden: ${e.message}</div><button class="btn btn-block" id="lo">Logout</button></div>`;
        app.querySelector('#lo').onclick = () => signOut();
        return;
      }
    }
    if (!profile) {
      app.innerHTML = `${MARQUEE}<div class="auth-shell"><div class="msg err">Kein Profil gefunden. Bitte neu einloggen.</div><button class="btn btn-block" id="lo">Logout</button></div>`;
      app.querySelector('#lo').onclick = () => signOut();
      return;
    }
  }
  renderChrome();
  await routeView();
}

/* ------------------------------------------------------------ boot */
window.addEventListener('hashchange', () => { if (session && profile) routeView(); });

supabase.auth.onAuthStateChange((event, newSession) => {
  const prevUser = session?.user?.id;
  session = newSession;
  // Der Link aus der Zuruecksetzen-Mail legt bereits eine Sitzung an. Ohne
  // dieses Flag ginge es direkt ins Log – und das Passwort bliebe unbekannt.
  if (event === 'PASSWORD_RECOVERY') { recovery = true; render(); return; }
  if (session?.user?.id !== prevUser) render();
});

(async function boot() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  await render();
})();
