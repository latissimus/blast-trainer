import { escapeHtml } from './html.js';

// Diese Angaben stehen bewusst an genau einer Stelle. Vor der oeffentlichen
// Freigabe muessen nur noch die reale Anschrift, Kontaktadresse und der fuer
// Auth-Mails eingesetzte SMTP-Dienst eingetragen werden.
export const RECHTSDATEN = Object.freeze({
  name: 'Florian Rau',
  anschrift: '[LADUNGSFÄHIGE ANSCHRIFT ERGÄNZEN]',
  email: '[KONTAKT-E-MAIL ERGÄNZEN]',
  smtp: '[SMTP-ANBIETER ERGÄNZEN]',
});

export const RECHTSSEITEN = Object.freeze(['nutzung', 'datenschutz', 'impressum']);

const extern = (url, text) =>
  `<a href="${url}" target="_blank" rel="noreferrer">${text}</a>`;

const kontakt = () => `
  <address>
    <b>${escapeHtml(RECHTSDATEN.name)}</b><br>
    <span class="recht-fehlt">${escapeHtml(RECHTSDATEN.anschrift)}</span><br>
    E-Mail: <span class="recht-fehlt">${escapeHtml(RECHTSDATEN.email)}</span>
  </address>`;

function datenschutzInhalt() {
  return `
    <section class="recht-karte recht-wichtig">
      <h2>Das Wichtigste kurz</h2>
      <p>LOGMAN speichert deine Angaben, damit du deinen Trainingsplan führen,
        offline verwenden und zwischen deinen Geräten synchronisieren kannst.
        Wir verkaufen keine Daten und setzen keine Werbung oder
        Reichweitenanalyse ein.</p>
      <p>Trainingsdaten werden zuerst auf deinem Gerät gespeichert. Sobald eine
        Verbindung besteht, werden sie deinem persönlichen Konto bei Supabase
        zugeordnet.</p>
    </section>

    <section class="recht-karte">
      <h2>1. Verantwortlicher</h2>
      ${kontakt()}
    </section>

    <section class="recht-karte">
      <h2>2. Welche Daten verarbeitet werden</h2>
      <h3>Konto und Profil</h3>
      <p>E-Mail-Adresse, Name, der beim Authentifizierungsdienst gespeicherte
        Passwort-Hash und – falls freiwillig gewählt – ein
        Profilbild. Das Klartext-Passwort ist für LOGMAN nicht einsehbar.</p>

      <h3>Training und Einstellungen</h3>
      <p>Ausgewählte Übungen, Gewichte, Wiederholungen, RIR, Satzzahlen,
        Trainingsdaten, Cycles, Prioritäten, eigene Übungen, Übungsnotizen,
        Darstellungs- und Tutorialeinstellungen sowie der aktuelle
        Synchronisationsstand.</p>

      <h3>Notizbuch</h3>
      <p>Frei eingegebene Titel, Texte und Links sowie freiwillig hochgeladene
        Bilder. Bitte trage dort keine Diagnosen oder Informationen über andere
        Personen ein, die für dein Training nicht erforderlich sind.</p>

      <h3>Feedback und Benachrichtigungen</h3>
      <p>Abgesendete Rückmeldungen mit Kategorie, Text und Zeitpunkt. Wenn du
        Benachrichtigungen aktivierst, werden außerdem technische Push-Endpunkte,
        Schlüssel, Timerdaten und Zustellversuche verarbeitet.</p>

      <h3>Technische Daten</h3>
      <p>Beim Aufruf können Hosting- und Backendanbieter insbesondere
        IP-Adresse, Zeitpunkt, Browser-/Geräteinformationen und angeforderte
        Dateien in technischen Protokollen verarbeiten.</p>
    </section>

    <section class="recht-karte">
      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <p>Kontoführung, Trainingslog, Offlinebetrieb, Synchronisation,
        Datenexport und Support dienen der Bereitstellung von LOGMAN
        (Art. 6 Abs. 1 lit. b DSGVO).</p>
      <p>Fehleranalyse, Missbrauchsschutz und der sichere Betrieb beruhen auf
        unserem berechtigten Interesse an einer stabilen und sicheren App
        (Art. 6 Abs. 1 lit. f DSGVO). Gesetzlich erforderliche Verarbeitung
        erfolgt nach Art. 6 Abs. 1 lit. c DSGVO.</p>
      <p>Push-Mitteilungen werden nur nach deiner aktiven Freigabe versendet.
        Die Freigabe kannst du in den Systemeinstellungen deines Geräts
        jederzeit widerrufen (Art. 6 Abs. 1 lit. a DSGVO).</p>
    </section>

    <section class="recht-karte">
      <h2>4. Lokale Speicherung und Offlinebetrieb</h2>
      <p>LOGMAN verwendet Local Storage, Session Storage und den Cache des
        Service Workers. Darin liegen unter anderem die Anmeldung, ein lokaler
        Trainingsstand, noch nicht übertragene Änderungen, Anzeigeeinstellungen
        und Teile der App für den Offlinebetrieb.</p>
      <p>Diese Speicherung ist erforderlich, damit die ausdrücklich gewünschte
        App zuverlässig und ohne Empfang funktioniert. Es werden keine
        Marketing-Cookies und keine Analyse-Tracker eingesetzt.</p>
    </section>

    <section class="recht-karte">
      <h2>5. Empfänger und Dienstleister</h2>
      <ul>
        <li><b>Supabase, Inc.</b> – Anmeldung, Datenbank, Synchronisation,
          Dateispeicher und serverseitige Funktionen.</li>
        <li><b>GitHub, Inc.</b> – Auslieferung der Web-App über GitHub Pages.</li>
        <li><b class="recht-fehlt">${escapeHtml(RECHTSDATEN.smtp)}</b> – Versand
          von Bestätigungs- und Passwort-E-Mails.</li>
        <li>Der zum Gerät gehörende Push-Dienst, beispielsweise von Apple,
          Google oder Mozilla – nur wenn Benachrichtigungen aktiviert werden.</li>
      </ul>
      <p>Es gibt keinen Adminzugang zu Kundendaten innerhalb der App. Der
        Betreiber kann über den geschützten Backendzugang auf gespeicherte
        Daten zugreifen, soweit dies für technischen Betrieb, Support oder die
        Bearbeitung von Feedback erforderlich ist.</p>
      <p>Soweit Dienstleister Daten außerhalb des Europäischen Wirtschaftsraums
        verarbeiten, erfolgt die Übermittlung nur auf Grundlage eines zulässigen
        Übermittlungsmechanismus, insbesondere eines Angemessenheitsbeschlusses
        oder von EU-Standardvertragsklauseln.</p>
    </section>

    <section class="recht-karte">
      <h2>6. Speicherdauer und Löschung</h2>
      <p>Konto- und Trainingsdaten werden grundsätzlich bis zur Löschung des
        Kontos gespeichert. Notizen, Bilder und Feedback bleiben gespeichert,
        bis du sie löschst, dein Konto löschst oder ihre weitere Speicherung
        für den jeweiligen Zweck nicht mehr erforderlich ist. Gesetzliche
        Aufbewahrungspflichten bleiben unberührt.</p>
      <p>Über <b>Profil → Account löschen</b> kannst du dein Konto und die damit
        verbundenen App-Daten löschen. Lokal gespeicherte App-Daten können nach
        der Kontolöschung zusätzlich durch Entfernen der App beziehungsweise
        Löschen der Website-Daten des Browsers beseitigt werden.</p>
    </section>

    <section class="recht-karte">
      <h2>7. Deine Rechte</h2>
      <p>Du hast im gesetzlichen Rahmen das Recht auf Auskunft, Berichtigung,
        Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und
        Widerspruch. Eine erteilte Einwilligung kannst du mit Wirkung für die
        Zukunft widerrufen.</p>
      <p>Im Profil kannst du deine Trainings- und Kontodaten exportieren. Für
        weitere Anfragen verwende bitte die oben genannte Kontaktadresse. Du
        kannst dich außerdem bei einer Datenschutzaufsichtsbehörde beschweren,
        insbesondere an deinem gewöhnlichen Aufenthaltsort oder am Sitz des
        Verantwortlichen.</p>
    </section>

    <section class="recht-karte">
      <h2>8. Sicherheit und automatisierte Entscheidungen</h2>
      <p>Die Übertragung erfolgt verschlüsselt. Zugriffsregeln trennen die Daten
        verschiedener Konten. LOGMAN verwendet deine Daten nicht für
        automatisierte Entscheidungen oder Profiling im Sinne von Art. 22
        DSGVO.</p>
    </section>

    <section class="recht-karte">
      <h2>9. Weitere Informationen</h2>
      <p>Weitere Informationen findest du bei ${extern('https://supabase.com/privacy', 'Supabase')}
        und ${extern('https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement', 'GitHub')}.
        Diese Erklärung wird angepasst, wenn sich Funktionen, Anbieter oder die
        Rechtslage ändern.</p>
    </section>`;
}

function impressumInhalt() {
  return `
    <section class="recht-karte recht-wichtig">
      <h2>Angaben gemäß § 5 DDG</h2>
      ${kontakt()}
    </section>

    <section class="recht-karte">
      <h2>Verantwortlich für den Inhalt</h2>
      <p>${escapeHtml(RECHTSDATEN.name)}<br>
        <span class="recht-fehlt">${escapeHtml(RECHTSDATEN.anschrift)}</span></p>
    </section>

    <section class="recht-karte">
      <h2>Hinweis zum Training</h2>
      <p>LOGMAN ist ein Trainingslog und stellt keine medizinische Beratung,
        Diagnose oder Behandlung bereit. Training erfolgt eigenverantwortlich.
        Bei Schmerzen, Verletzungen, Erkrankungen oder Unsicherheit sollte das
        Training unterbrochen und fachlicher medizinischer Rat eingeholt werden.</p>
      <p>Trainingsvorschläge und wissenschaftliche Informationen ersetzen keine
        individuelle Untersuchung. Übungen, Lasten, Bewegungsumfang und
        Trainingsnähe zum Muskelversagen müssen zur eigenen Erfahrung und
        gesundheitlichen Situation passen.</p>
    </section>

    <section class="recht-karte">
      <h2>Externe Links</h2>
      <p>LOGMAN verweist im FAQ und im Notizbuch auf externe Inhalte. Für deren
        Inhalt und Verfügbarkeit sind die jeweiligen Anbieter verantwortlich.
        Beim Öffnen gelten deren Datenschutzbestimmungen.</p>
    </section>

    <section class="recht-karte">
      <h2>Urheberrecht</h2>
      <p>Inhalte, Trainingssystem, Gestaltung und Quellcode von LOGMAN sind
        urheberrechtlich geschützt. Eine Nutzung außerhalb der vorgesehenen App
        bedarf der vorherigen Zustimmung des Rechteinhabers, soweit keine
        gesetzliche Erlaubnis besteht.</p>
    </section>`;
}

function nutzungsbedingungenInhalt() {
  return `
    <section class="recht-karte recht-wichtig">
      <h2>Kostenlos trainieren mit LOGMAN</h2>
      <p>LOGMAN wird derzeit kostenlos bereitgestellt. Es gibt keine
        kostenpflichtige Mitgliedschaft, keine In-App-Käufe und keine
        automatische Vertragsverlängerung.</p>
      <p>Diese Nutzungsbedingungen regeln die Verwendung der App und des
        persönlichen LOGMAN-Kontos. Gesetzliche Rechte, insbesondere zwingende
        Verbraucherrechte für digitale Produkte, bleiben unberührt.</p>
    </section>

    <section class="recht-karte">
      <h2>1. Anbieter und Geltungsbereich</h2>
      <p>Anbieter von LOGMAN ist:</p>
      ${kontakt()}
      <p>Die Bedingungen gelten für die Registrierung und Nutzung von LOGMAN.
        Mit dem Erstellen eines Kontos kommt der Nutzungsvertrag zustande.</p>
    </section>

    <section class="recht-karte">
      <h2>2. Konto und Zugang</h2>
      <p>Für persönliche Funktionen wird ein Konto benötigt. Die bei der
        Registrierung gemachten Angaben müssen zutreffen. Zugangsdaten dürfen
        nicht an andere Personen weitergegeben werden. Wenn ein unbefugter
        Zugriff vermutet wird, sollte das Passwort sofort geändert und der
        Anbieter informiert werden.</p>
      <p>Die Nutzung ist nur im Rahmen der eigenen rechtlichen
        Handlungsfähigkeit zulässig. Wer dafür die Zustimmung einer
        sorgeberechtigten Person benötigt, darf LOGMAN nur mit dieser
        Zustimmung verwenden.</p>
    </section>

    <section class="recht-karte">
      <h2>3. Leistung und Offlinebetrieb</h2>
      <p>LOGMAN unterstützt die Planung, Dokumentation und Auswertung des
        Trainings. Dazu gehören insbesondere Trainingslog, Cycles,
        Fortschrittsanzeige, Set-O-Meter, Notizen, eigene Übungen und
        Synchronisation.</p>
      <p>Teile der App funktionieren offline. Änderungen werden zunächst auf
        dem Gerät gespeichert und bei verfügbarer Verbindung synchronisiert.
        Bei sehr schwacher oder unterbrochener Verbindung kann sich die
        Synchronisation verzögern. Vor einem Gerätewechsel oder dem Löschen von
        Website-Daten sollte geprüft werden, ob alle Änderungen übertragen
        wurden.</p>
    </section>

    <section class="recht-karte">
      <h2>4. Training und Gesundheit</h2>
      <p>LOGMAN ist ein Trainingswerkzeug und keine medizinische Beratung,
        Diagnose oder Behandlung. Die angezeigten Pläne, Satzzahlen,
        Belastungsbereiche und Informationen sind allgemeine Trainingshilfen
        und keine individuelle gesundheitliche Freigabe.</p>
      <p>Übungen, Lasten, Wiederholungen und die Nähe zum Muskelversagen müssen
        zur eigenen Erfahrung und gesundheitlichen Situation passen. Bei
        Schmerzen, Verletzungen, Erkrankungen oder Unsicherheit sollte das
        Training beendet und medizinischer beziehungsweise fachlicher Rat
        eingeholt werden.</p>
    </section>

    <section class="recht-karte">
      <h2>5. Zulässige Nutzung</h2>
      <p>LOGMAN darf nur gesetzeskonform und für persönliche Trainingszwecke
        verwendet werden. Nicht erlaubt sind insbesondere:</p>
      <ul>
        <li>Angriffe, Manipulationsversuche oder eine Umgehung von
          Sicherheits- und Zugriffsbeschränkungen,</li>
        <li>automatisierte Zugriffe, die den Betrieb unangemessen belasten,</li>
        <li>das Hochladen rechtswidriger Inhalte oder von Inhalten, an denen
          keine erforderlichen Rechte bestehen,</li>
        <li>die Nutzung fremder Konten oder das Auslesen fremder Daten.</li>
      </ul>
      <p>Bei erheblichen oder wiederholten Verstößen kann der Zugang nach
        vorherigem Hinweis vorübergehend gesperrt oder der Nutzungsvertrag aus
        wichtigem Grund beendet werden. Bei akuter Gefahr für die Sicherheit
        oder andere Personen kann eine sofortige Sperre erforderlich sein.</p>
    </section>

    <section class="recht-karte">
      <h2>6. Eigene Inhalte</h2>
      <p>Notizen, Bilder, Links, Übungsvarianten und sonstige eigene Inhalte
        bleiben den Nutzenden zugeordnet. Sie räumen dem Anbieter nur die
        technisch erforderlichen, nicht ausschließlichen Rechte ein, diese
        Inhalte zu speichern, zu verarbeiten und auf ihren Geräten anzuzeigen,
        soweit dies für LOGMAN erforderlich ist.</p>
      <p>Nutzende sind dafür verantwortlich, dass eigene Inhalte keine Rechte
        Dritter verletzen und keine rechtswidrigen Informationen enthalten.
        Eigene Übungen werden ausschließlich im jeweiligen Kundenkonto
        gespeichert und nicht automatisch für andere Personen veröffentlicht.</p>
    </section>

    <section class="recht-karte">
      <h2>7. Verfügbarkeit, Updates und Änderungen</h2>
      <p>LOGMAN wird mit angemessener Sorgfalt betrieben. Eine jederzeitige,
        vollständig störungsfreie Verfügbarkeit kann insbesondere wegen
        Wartung, Updates, Gerätebedingungen oder Störungen von Netz- und
        Drittanbietern nicht versprochen werden.</p>
      <p>Erforderliche Updates einschließlich Sicherheitsupdates werden im
        gesetzlichen Umfang bereitgestellt. Sie sollten zeitnah installiert
        werden. LOGMAN darf aus triftigem Grund weiterentwickelt werden, etwa
        zur Sicherheit, Fehlerbehebung, Anpassung an technische oder rechtliche
        Anforderungen oder zur Verbesserung von Funktionen. Änderungen
        erfolgen ohne zusätzliche Kosten. Über Änderungen, die die Nutzung
        mehr als nur unerheblich beeinträchtigen, wird im gesetzlich
        erforderlichen Umfang vorab informiert; gesetzliche Kündigungsrechte
        bleiben bestehen.</p>
    </section>

    <section class="recht-karte">
      <h2>8. Haftung</h2>
      <p>Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit,
        bei Verletzung von Leben, Körper oder Gesundheit, nach dem
        Produkthaftungsgesetz sowie im Umfang ausdrücklich übernommener
        Garantien.</p>
      <p>Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht
        ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden
        begrenzt. Eine wesentliche Vertragspflicht ist eine Pflicht, deren
        Erfüllung die ordnungsgemäße Nutzung von LOGMAN erst ermöglicht und auf
        deren Einhaltung regelmäßig vertraut werden darf. Im Übrigen ist die
        Haftung für leichte Fahrlässigkeit ausgeschlossen. Zwingende
        gesetzliche Ansprüche bleiben unberührt.</p>
    </section>

    <section class="recht-karte">
      <h2>9. Dauer und Beendigung</h2>
      <p>Der Nutzungsvertrag läuft auf unbestimmte Zeit und kann jederzeit über
        <b>Profil → Account löschen</b> beendet werden. Dabei werden das Konto
        und die zugehörigen App-Daten gelöscht, soweit keine gesetzlichen
        Gründe eine weitere Speicherung verlangen.</p>
      <p>Das Recht beider Seiten zur außerordentlichen Kündigung aus wichtigem
        Grund bleibt bestehen. Sollte LOGMAN dauerhaft eingestellt werden,
        wird darüber nach Möglichkeit rechtzeitig informiert und eine
        Gelegenheit zum Datenexport gegeben.</p>
    </section>

    <section class="recht-karte">
      <h2>10. Schlussbestimmungen</h2>
      <p>Es gilt deutsches Recht. Für Verbraucherinnen und Verbraucher gilt
        diese Rechtswahl nur, soweit dadurch der Schutz zwingender Vorschriften
        des Staates ihres gewöhnlichen Aufenthalts nicht entzogen wird.</p>
      <p>Sollten einzelne Regelungen unwirksam sein, bleiben die übrigen
        Regelungen davon unberührt. An die Stelle der unwirksamen Regelung
        treten die gesetzlichen Vorschriften.</p>
    </section>`;
}

export function rechtlicherInhalt(seite) {
  if (seite === 'nutzung') return nutzungsbedingungenInhalt();
  if (seite === 'datenschutz') return datenschutzInhalt();
  if (seite === 'impressum') return impressumInhalt();
  throw new Error('Unbekannte Rechtsseite');
}

export function mountRechtliches(container, { seite, angemeldet = false } = {}) {
  const seitendaten = {
    nutzung: ['Nutzung', 'Nutzungsbedingungen'],
    datenschutz: ['Deine Daten', 'Datenschutz'],
    impressum: ['Anbieter', 'Impressum'],
  };
  const [kicker, titel] = seitendaten[seite];
  const zurueckZiel = angemeldet ? '#log' : '#';
  const zurueckText = angemeldet ? 'Log' : 'Anmeldung';

  container.innerHTML = `
    <div class="wrap pad-bottom recht-seite">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">${kicker}</span>
          <h1 class="section-title">${titel}</h1>
        </div>
        <a class="zurueck" href="${zurueckZiel}"><span class="pf">←</span> ${zurueckText}</a>
      </div>
      <p class="recht-stand">Stand: 14. August 2026</p>
      <div class="recht-inhalt">${rechtlicherInhalt(seite)}</div>
      <nav class="recht-nav" aria-label="Rechtliche Informationen">
        <a href="#nutzung"${seite === 'nutzung' ? ' aria-current="page"' : ''}>Nutzung</a>
        <a href="#datenschutz"${seite === 'datenschutz' ? ' aria-current="page"' : ''}>Datenschutz</a>
        <a href="#impressum"${seite === 'impressum' ? ' aria-current="page"' : ''}>Impressum</a>
      </nav>
    </div>`;
}
