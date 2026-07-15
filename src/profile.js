import { supabase } from './supabase.js';
import { toast } from './log.js';

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
  wrap.className = 'wrap';
  wrap.style.paddingTop = '18px';
  wrap.style.paddingBottom = '40px';
  wrap.innerHTML = `<h1 class="section-title">Mein Profil</h1>`;

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
    <span class="role-tag ${profile.role === 'admin' ? 'admin' : ''}">${profile.role === 'admin' ? 'Admin' : 'Kunde'}</span>`;
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
  container.appendChild(wrap);
}
