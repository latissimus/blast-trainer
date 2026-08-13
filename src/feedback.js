import { supabase } from './supabase.js';
import { feedbackSynchronisieren, feedbackVormerken, feedbackWartend } from './feedbacksync.js';

const KATEGORIEN = {
  idee: 'Verbesserung',
  fehler: 'Fehler',
  verstaendlichkeit: 'Unklar oder schwer verständlich',
};

const datumText = (wert) => new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(wert));

// Gemeinsamer Admin-Eingang fuer die Feedback-Seite und die Verwaltung.
// Die Abfrage bleibt zentral, damit beide Ansichten exakt dieselbe RLS- und
// Profilauflösung verwenden.
export async function ladeFeedbackEingang(ziel) {
  if (!ziel) return;
  ziel.innerHTML = '<p class="feedback-laden">Feedback wird geladen…</p>';
  const { data: eintraege, error } = await supabase
    .from('feedback')
    .select('id,user_id,kategorie,nachricht,status,created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    const meldung = document.createElement('p');
    meldung.className = 'feedback-laden';
    meldung.textContent = `Feedback konnte nicht geladen werden: ${error.message || 'Unbekannter Fehler'}`;
    ziel.replaceChildren(meldung);
    return;
  }
  const ids = [...new Set((eintraege || []).map((e) => e.user_id).filter(Boolean))];
  let personen = [];
  if (ids.length) {
    const antwort = await supabase.from('profiles').select('id,full_name,email').in('id', ids);
    personen = antwort.data || [];
  }
  const personVon = new Map(personen.map((p) => [p.id, p]));
  ziel.replaceChildren();
  if (!eintraege?.length) {
    ziel.innerHTML = '<p class="feedback-laden">Noch kein Feedback.</p>';
    return;
  }
  eintraege.forEach((eintrag) => {
    const person = personVon.get(eintrag.user_id);
    const karte = document.createElement('article');
    karte.className = 'feedback-eintrag';
    const kopf = document.createElement('div');
    kopf.className = 'feedback-eintrag-kopf';
    const art = document.createElement('b');
    art.textContent = KATEGORIEN[eintrag.kategorie] || eintrag.kategorie;
    const zeit = document.createElement('time');
    zeit.dateTime = eintrag.created_at;
    zeit.textContent = datumText(eintrag.created_at);
    kopf.append(art, zeit);
    const autor = document.createElement('small');
    autor.textContent = person?.full_name || person?.email || eintrag.user_id;
    const nachricht = document.createElement('p');
    nachricht.textContent = eintrag.nachricht;
    karte.append(kopf, autor, nachricht);
    ziel.appendChild(karte);
  });
}

export async function mountFeedback(container, { session, profile }) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom feedback-seite';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Deine Idee</span>
        <h1 class="section-title">Feedback</h1>
      </div>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>
    <section class="feedback-intro">
      <p>Was würde LOGMAN einfacher, verständlicher oder praktischer machen?</p>
      <span>Dein Vorschlag landet direkt beim Entwickler.</span>
    </section>
    <form class="feedback-form">
      <label class="fld-l" for="feedback-kategorie">Worum geht es?</label>
      <select class="input" id="feedback-kategorie">
        ${Object.entries(KATEGORIEN).map(([wert, text]) => `<option value="${wert}">${text}</option>`).join('')}
      </select>
      <label class="fld-l" for="feedback-text">Dein Vorschlag</label>
      <textarea class="input feedback-text" id="feedback-text" minlength="10" maxlength="2000"
        placeholder="Zum Beispiel: Ich habe nicht verstanden, wie … Einfacher wäre es, wenn …" required></textarea>
      <div class="feedback-zaehler"><span>Mindestens 10 Zeichen</span><b>0 / 2000</b></div>
      <button class="btn btn-primary btn-block" type="submit">Feedback senden</button>
      <div class="feedback-status" aria-live="polite"></div>
    </form>
    ${profile?.role === 'admin' ? `
      <section class="feedback-eingang">
        <h2 class="section-title">Eingänge</h2>
        <div data-feedback-liste><p class="feedback-laden">Feedback wird geladen…</p></div>
      </section>` : ''}`;
  container.appendChild(wrap);

  const form = wrap.querySelector('.feedback-form');
  const text = wrap.querySelector('#feedback-text');
  const kategorie = wrap.querySelector('#feedback-kategorie');
  const zaehler = wrap.querySelector('.feedback-zaehler b');
  const status = wrap.querySelector('.feedback-status');
  const senden = form.querySelector('button[type="submit"]');

  text.addEventListener('input', () => { zaehler.textContent = `${text.value.length} / 2000`; });

  const feedbackLaden = () => ladeFeedbackEingang(wrap.querySelector('[data-feedback-liste]'));

  if (feedbackWartend(session.user.id)) {
    status.innerHTML = '<div class="msg wait">Feedback wartet auf Verbindung.</div>';
    feedbackSynchronisieren(session.user.id).then((result) => {
      if (result.status === 'gesendet') {
        status.innerHTML = '<div class="msg ok">Vorgemerktes Feedback wurde gesendet.</div>';
        if (profile?.role === 'admin') feedbackLaden();
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nachricht = text.value.trim();
    if (nachricht.length < 10) {
      status.innerHTML = '<div class="msg err">Bitte beschreibe deinen Vorschlag etwas genauer.</div>';
      text.focus();
      return;
    }
    feedbackVormerken(session.user.id, { kategorie: kategorie.value, nachricht });
    text.value = '';
    zaehler.textContent = '0 / 2000';
    senden.disabled = true;
    status.textContent = 'Wird gesendet…';
    const result = await feedbackSynchronisieren(session.user.id);
    senden.disabled = false;
    if (result.status === 'gesendet') {
      status.innerHTML = '<div class="msg ok">Danke – dein Vorschlag ist angekommen.</div>';
      if (profile?.role === 'admin') feedbackLaden();
    } else {
      status.innerHTML = '<div class="msg wait">Auf diesem Gerät gespeichert · wird bei Verbindung gesendet.</div>';
    }
  });

  if (profile?.role === 'admin') feedbackLaden();
}
