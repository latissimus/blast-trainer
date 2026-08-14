import { feedbackSynchronisieren, feedbackVormerken, feedbackWartend } from './feedbacksync.js';

const KATEGORIEN = {
  idee: 'Verbesserung',
  fehler: 'Fehler',
  verstaendlichkeit: 'Unklar oder schwer verständlich',
};

export async function mountFeedback(container, { session }) {
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
    </form>`;
  container.appendChild(wrap);

  const form = wrap.querySelector('.feedback-form');
  const text = wrap.querySelector('#feedback-text');
  const kategorie = wrap.querySelector('#feedback-kategorie');
  const zaehler = wrap.querySelector('.feedback-zaehler b');
  const status = wrap.querySelector('.feedback-status');
  const senden = form.querySelector('button[type="submit"]');

  text.addEventListener('input', () => { zaehler.textContent = `${text.value.length} / 2000`; });

  if (feedbackWartend(session.user.id)) {
    status.innerHTML = '<div class="msg wait">Feedback wartet auf Verbindung.</div>';
    feedbackSynchronisieren(session.user.id).then((result) => {
      if (result.status === 'gesendet') {
        status.innerHTML = '<div class="msg ok">Vorgemerktes Feedback wurde gesendet.</div>';
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
    } else {
      status.innerHTML = '<div class="msg wait">Auf diesem Gerät gespeichert · wird bei Verbindung gesendet.</div>';
    }
  });

}
