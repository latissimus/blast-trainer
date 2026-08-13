import { supabase } from './supabase.js';
import { mountLog } from './log.js';
import { ladeFeedbackEingang } from './feedback.js';
import { escapeHtml, sichereBildUrl } from './html.js';

const initials = (name, email) => {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

export async function mountAdmin(container, { session }) {
  let currentLog = null;

  async function showList() {
    if (currentLog) { currentLog.destroy(); currentLog = null; }
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'wrap pad-bottom';
    wrap.innerHTML = `
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">Verwaltung</span>
          <h1 class="section-title">Alle Nutzer</h1>
        </div>
      </div>`;
    container.appendChild(wrap);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, avatar_url')
      .order('role', { ascending: true })
      .order('email', { ascending: true });

    if (error) { wrap.insertAdjacentHTML('beforeend', `<div class="msg err">Konnte Nutzer nicht laden: ${escapeHtml(error.message)}</div>`); return; }
    if (!profiles || profiles.length === 0) wrap.insertAdjacentHTML('beforeend', `<div class="empty">Noch keine Nutzer.</div>`);

    (profiles || []).forEach((p) => {
      const row = document.createElement('button');
      row.className = 'cust-row';
      const isSelf = p.id === session.user.id;
      const avatarUrl = sichereBildUrl(p.avatar_url);
      const av = avatarUrl
        ? `<img class="av" src="${escapeHtml(avatarUrl)}" alt="">`
        : `<div class="av avatar-fallback" style="display:flex;align-items:center;justify-content:center;font-size:16px">${escapeHtml(initials(p.full_name, p.email))}</div>`;
      row.innerHTML = `
        ${av}
        <div>
          <div class="nm">${escapeHtml(p.full_name || '(kein Name)')}${isSelf ? ' · du' : ''}
            <span class="role-tag ${p.role === 'admin' ? 'admin' : ''}" style="margin-left:6px">${p.role === 'admin' ? 'Admin' : 'Trainee'}</span>
          </div>
          <div class="em">${escapeHtml(p.email || p.id)}</div>
        </div>
        <span class="chev">›</span>`;
      row.onclick = () => showCustomer(p);
      wrap.appendChild(row);
    });

    const feedback = document.createElement('section');
    feedback.className = 'feedback-eingang admin-feedback-eingang';
    feedback.innerHTML = `
      <h2 class="section-title">Kundenfeedback</h2>
      <div class="feedback-intro">
        <p>Vorschläge und Hinweise aus der App</p>
        <span>Die neuesten 50 Einträge werden hier angezeigt.</span>
      </div>
      <div data-feedback-liste><p class="feedback-laden">Feedback wird geladen…</p></div>`;
    wrap.appendChild(feedback);
    await ladeFeedbackEingang(feedback.querySelector('[data-feedback-liste]'));
  }

  async function showCustomer(p) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">Kundenlog</span>
          <h1 class="section-title">${escapeHtml(p.full_name || p.email || 'Nutzer')}</h1>
        </div>
      </div>
      <button class="back-link" id="ad-back">← Zurück zur Liste</button>
      <div class="readonly-note">Nur-Lese-Ansicht · Log von ${escapeHtml(p.email || p.id)}</div>`;
    container.appendChild(wrap);
    wrap.querySelector('#ad-back').onclick = showList;

    const logMount = document.createElement('div');
    container.appendChild(logMount);
    try {
      currentLog = await mountLog(logMount, { userId: p.id, readOnly: true });
    } catch (e) {
      logMount.innerHTML = `<div class="wrap"><div class="msg err">Log konnte nicht geladen werden: ${escapeHtml(e.message)}</div></div>`;
    }
  }

  await showList();

  return {
    destroy() { if (currentLog) { currentLog.destroy(); currentLog = null; } },
  };
}
