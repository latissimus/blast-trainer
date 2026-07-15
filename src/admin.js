import { supabase } from './supabase.js';
import { mountLog } from './log.js';

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
    wrap.className = 'wrap';
    wrap.style.paddingTop = '18px';
    wrap.style.paddingBottom = '40px';
    wrap.innerHTML = `<h1 class="section-title">Admin · Alle Nutzer</h1>`;
    container.appendChild(wrap);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, avatar_url')
      .order('role', { ascending: true })
      .order('email', { ascending: true });

    if (error) { wrap.insertAdjacentHTML('beforeend', `<div class="msg err">Konnte Nutzer nicht laden: ${error.message}</div>`); return; }
    if (!profiles || profiles.length === 0) { wrap.insertAdjacentHTML('beforeend', `<div class="empty">Noch keine Nutzer.</div>`); return; }

    profiles.forEach((p) => {
      const row = document.createElement('button');
      row.className = 'cust-row';
      const isSelf = p.id === session.user.id;
      const av = p.avatar_url
        ? `<img class="av" src="${p.avatar_url}" alt="">`
        : `<div class="av avatar-fallback" style="display:flex;align-items:center;justify-content:center;font-size:16px">${initials(p.full_name, p.email)}</div>`;
      row.innerHTML = `
        ${av}
        <div>
          <div class="nm">${p.full_name || '(kein Name)'}${isSelf ? ' · du' : ''}
            <span class="role-tag ${p.role === 'admin' ? 'admin' : ''}" style="margin-left:6px">${p.role === 'admin' ? 'Admin' : 'Coachee'}</span>
          </div>
          <div class="em">${p.email || p.id}</div>
        </div>
        <span class="chev">›</span>`;
      row.onclick = () => showCustomer(p);
      wrap.appendChild(row);
    });
  }

  async function showCustomer(p) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.style.paddingTop = '18px';
    wrap.innerHTML = `
      <button class="back-link" id="ad-back">← Zurück zur Liste</button>
      <h1 class="section-title" style="margin-bottom:8px">${p.full_name || p.email || 'Nutzer'}</h1>
      <div class="readonly-note">Nur-Lese-Ansicht · Log von ${p.email || p.id}</div>`;
    container.appendChild(wrap);
    wrap.querySelector('#ad-back').onclick = showList;

    const logMount = document.createElement('div');
    container.appendChild(logMount);
    try {
      currentLog = await mountLog(logMount, { userId: p.id, readOnly: true });
    } catch (e) {
      logMount.innerHTML = `<div class="wrap"><div class="msg err">Log konnte nicht geladen werden: ${e.message}</div></div>`;
    }
  }

  await showList();

  return {
    destroy() { if (currentLog) { currentLog.destroy(); currentLog = null; } },
  };
}
