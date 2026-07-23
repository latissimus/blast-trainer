// FAQ als Nachschlagewerk mit kurzer Einstiegsebene. Erst kommt, was man beim
// ersten Training braucht; Systembegriffe und Hintergrund folgen spaeter.

export function mountFaq(container) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <h1 class="section-title">💬 FAQ</h1>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>

    <p class="faq-sektion">Schnellstart</p>

    <details class="faq" open><summary>Wie starte ich mein erstes Training?</summary>
      <div class="faq-a">
        <p><b>Starte im Log das kurze Tutorial.</b> Es führt dich nacheinander durch die Heavy-Auswahl für Woche 1 und 2 und erklärt anschließend die Satzeingabe. Du kannst es jederzeit beenden.</p>
        <p>Einen Speichern-Knopf brauchst du nicht. Jede Eingabe wird sofort auf dem Gerät gesichert und bei Verbindung automatisch hochgeladen.</p>
        <a class="faq-tutorial-start" href="#log" data-tutorial-start>Tutorial starten</a>
      </div>
    </details>

    <details class="faq"><summary>Was muss ich pro Satz eintragen?</summary>
      <div class="faq-a">
        <p><b>Gewicht und Wiederholungen.</b> Bei Heavy kommt <b>RIR</b> hinzu. Das steht für <i>Reps in Reserve</i>, also <b>Wiederholungen in Reserve</b>: die Wiederholungen, die mit sauberer Technik noch möglich gewesen wären. RIR 1 bedeutet also: Eine Wiederholung wäre noch gegangen.</p>
        <p>Beim Cluster trägst du das Gewicht und die Wiederholungen im letzten der sechs Minisätze ein.</p>
      </div>
    </details>

    <details class="faq"><summary>Welches Level soll ich wählen?</summary>
      <div class="faq-a">
        <p>Das Level regelt nur die <b>Satzanzahl dieser Einheit</b>. Die ausgeführten Sätze bleiben auf jedem Level produktiv und versagensnah.</p>
        <p><b>Level I – Kompakt · weniger Volumen:</b> für einen schwachen oder bereits ermüdeten Tag.<br>
        <b>Level II – Standard · normales Volumen:</b> die Vorauswahl für normale Trainingstage.<br>
        <b>Level III – Voll · höchstes Volumen:</b> für einen guten Tag mit passender Leistung und Erholung.</p>
        <p>Wähle nach Tagesform, nicht nach Ehrgeiz. Wenn Technik, Zielmuskel oder Leistung unter den späteren Sätzen leiden, nimm beim nächsten Mal weniger Volumen.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie finde ich mich in der App zurecht?</summary>
      <div class="faq-a">
        <p><b>Im Log</b> stellst du unten Woche, Tag, Level und Datum ein. Das violette Menü führt zu Notizbuch, Set-O-Meter, Progression und FAQs. Auf Unterseiten bringt dich „← Log" direkt zurück.</p>
        <p>Das Zeichen neben dem Profilbild zeigt den Speicherstand: <b>✓</b> gespeichert · <b>↻</b> speichert · <b>↑</b> wartet auf Verbindung · <b>⚠</b> Upload fehlgeschlagen. Auch in den letzten beiden Fällen liegt deine Eingabe bereits sicher auf dem Gerät.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie exportiere oder lösche ich meine Daten?</summary>
      <div class="faq-a">
        <p>Tippe oben rechts auf dein Profilbild. Unter <b>„Meine Daten"</b> kannst du Profil, Trainingslog und Notizen als JSON-Datei exportieren.</p>
        <p>Dort kannst du auch Account und App-Daten endgültig löschen. Zur Sicherheit musst du das Wort <b>LÖSCHEN</b> vollständig bestätigen.</p>
      </div>
    </details>

    <p class="faq-sektion">Im Training</p>

    <details class="faq"><summary>Wie trainiere ich Heavy?</summary>
      <div class="faq-a">
        <p><b>6–12 Wiederholungen, 0–2 RIR.</b> Beim Comp-Satz nur der letzte Satz bis zum Versagen; Iso-Sätze dürfen ans Versagen. Pause: Oberkörper 90 Sekunden, Unterkörper 120 Sekunden, Waden 60 Sekunden.</p>
        <p>Heavy ist die vergleichbare Messlatte. Trage diese Sätze deshalb besonders genau ein.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie trainiere ich Pump?</summary>
      <div class="faq-a">
        <p><b>15–25 Wiederholungen mit leichterer Last, aber versagensnah.</b> „Pump" ist kein eigener metabolischer Wachstumsmechanismus. Das leichtere Gewicht erlaubt nur mehr Wiederholungen; entscheidend bleiben die anstrengenden Wiederholungen nahe am Versagen.</p>
        <p><b>Lengthened Partials sind optional.</b> Nutze sie nur bei passenden Übungen und nur im belasteten, gedehnten Bereich – nicht automatisch nach jedem Satz.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie funktionieren Cluster?</summary>
      <div class="faq-a">
        <p>Ein Cluster besteht aus <b>6 Minisätzen mit je 4 Wiederholungen</b> und ungefähr 10 Sekunden Pause dazwischen. Nur der letzte Minisatz geht bis zum Versagen.</p>
        <p>Als Startgewicht dient ungefähr dein 15RM. Die Pause zwischen vollständigen Clustern darf so lang sein, wie du für eine saubere nächste Runde brauchst.</p>
      </div>
    </details>

    <details class="faq"><summary>Was heißen Comp und Iso?</summary>
      <div class="faq-a">
        <p><b>Comp = Verbundübung:</b> mehrere Gelenke und mehrere beteiligte Muskeln, zum Beispiel Bankdrücken. <b>Iso = Isolationsübung:</b> gezielte Arbeit über hauptsächlich ein Gelenk, zum Beispiel Fliegende oder Curls.</p>
        <p>Die App zeigt im jeweiligen Feld nur Übungen an, die zu Muskelgruppe und Rolle passen.</p>
      </div>
    </details>

    <details class="faq"><summary>Wofür sind Timer und Notizen?</summary>
      <div class="faq-a">
        <p>Ein Tipp auf den Uhr-Chip startet die vorgesehene Satzpause. Die <b>Übungsnotiz</b> ist für dauerhafte Einstellungen und Cues wie Sitzhöhe, Griff oder Fußposition.</p>
        <p>Das <b>Notizbuch</b> ist davon getrennt: Dort kannst du allgemeine Gedanken, Links und Bilder sammeln. Es bleibt auch nach dem Start einer neuen Phase erhalten.</p>
      </div>
    </details>

    <p class="faq-sektion">Plan verstehen</p>

    <details class="faq"><summary>Wie sieht die Trainingswoche aus?</summary>
      <div class="faq-a">
        <p><b>Drei Einheiten:</b> Tag 1 Oberkörper Heavy und Unterkörper Pump, Tag 2 Unterkörper Heavy und Oberkörper Pump, Tag 3 Cluster für den ganzen Körper.</p>
        <p>So erhält jeder Muskel mehrere unterschiedliche Reize pro Woche, ohne dass eine einzelne Einheit unnötig groß wird.</p>
      </div>
    </details>

    <details class="faq"><summary>Was bedeutet die A/B-Woche?</summary>
      <div class="faq-a">
        <p>In <b>Woche 1</b> trägst du die Heavy-Übungen für <b>Tag 1 und Tag 2</b> ein. Diese A-Auswahl übernimmt die App automatisch in alle ungeraden Wochen: <b>Woche 1, 3 und 5</b>.</p>
        <p>In <b>Woche 2</b> wählst du Heavy für <b>Tag 1 und Tag 2</b> ein zweites Mal. Diese B-Auswahl gilt automatisch für die geraden Wochen <b>2, 4 und 6</b>. Verglichen wird deshalb immer A mit A und B mit B.</p>
        <p>Pump- und Cluster-Übungen dürfen jede Woche frei wechseln. Zuletzt verwendete Übungen stehen im Suchdialog oben.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie kommen die Satzzahlen zustande?</summary>
      <div class="faq-a">
        <p>Die App kennt die Satzanzahl bereits. Sie hängt vom gewählten Level ab – du musst nichts ausrechnen und kannst nicht versehentlich zusätzliche Heavy- oder Cluster-Sätze anhängen.</p>
        <p>Bei Heavy wird die Satzanzahl auf Comp und Iso verteilt. Bei gekoppelten Pump- und Cluster-Feldern gilt die angezeigte Zahl je Übung.</p>
      </div>
    </details>

    <details class="faq"><summary>Muss ich das Set-O-Meter benutzen?</summary>
      <div class="faq-a">
        <p><b>Nein.</b> Ohne Änderung bleibt dein Trainingsplan vollständig. Das Set-O-Meter ist nur für die Feinverteilung des Wochenvolumens.</p>
        <p>Wenn du einen Muskel priorisieren möchtest: Muskel öffnen, Priorität setzen und zwischen <b>Umverteilen</b> und <b>Aufschlagen</b> wählen. Umverteilen gibt dem Ziel +1 Pump-Satz und nimmt nach deiner Bestätigung −1 Satz aus einem anderen Pumpfeld derselben Einheit. Aufschlagen erhöht das Gesamtvolumen um einen Satz.</p>
        <p>Direkte Sätze treffen den Muskel als Hauptziel. Indirekte Sätze belasten ihn unterstützend; sie werden als 1 angezeigt, im Balken aber mit 0,5 gewichtet.</p>
      </div>
    </details>

    <details class="faq"><summary>Was zeigt die Progression?</summary>
      <div class="faq-a">
        <p>Die Kurve zeigt den <b>Trend deiner Heavy-Leistung</b>. Dafür berechnet die App aus dem besten Heavy-Satz jeder vergleichbaren Woche ein geschätztes <b>1RM</b>. Das steht für <i>One-Repetition Maximum</i>, also das geschätzte Gewicht für eine maximale Wiederholung. Es ist eine Rechengröße, kein echter Maximalkrafttest und kein direkter Beweis für Muskelwachstum.</p>
        <p>Einzelne schwächere Einheiten sind normal. Bleibt der Trend über <b>mehrere vergleichbare Einheiten</b> aus, prüfe zuerst Technik, Schlaf, Ernährung und Erholung. Erst danach ist ein Übungswechsel sinnvoll – nicht automatisch nach zwei Einheiten.</p>
      </div>
    </details>

    <details class="faq"><summary>Was passiert nach Woche 6?</summary>
      <div class="faq-a">
        <p>Du entscheidest zwischen <b>„Weitertrainieren · neue Phase"</b> und standardmäßig <b>1 Woche Deload</b>. Im Deload sinken Volumen und Frequenz; danach beginnt die nächste Phase wieder auf Level II.</p>
        <p>Eine neue Phase leert Übungen, Gewichte, Wiederholungen, RIR und Übungsnotizen. Der Pump- und Cluster-Pool sowie das getrennte Notizbuch bleiben erhalten.</p>
      </div>
    </details>

    <details class="faq"><summary>Was ist der Pump- und Cluster-Pool?</summary>
      <div class="faq-a">
        <p>Pump- und Cluster-Übungen dürfen frei rotieren. Deshalb merkt sich der <b>Pool zu jedem Übungsnamen</b> das zuletzt verwendete Gewicht und die Wiederholungen – unabhängig davon, an welchem Tag du die Übung wieder auswählst.</p>
        <p>Gibt es einen Wert aus der laufenden Phase, zeigt die App die passende Woche an. Stammt der letzte Wert aus einer früheren Phase, steht daneben <b>„Pool"</b>, weil eine alte Wochennummer nach dem Neustart irreführend wäre.</p>
        <p>Der Pool bleibt beim Start einer neuen Phase bewusst erhalten. Er gibt nur eine Orientierung für den Einstieg; Pump und Cluster werden nicht als eigene Progressionskurve bewertet.</p>
      </div>
    </details>

    <p class="faq-sektion">Hintergrund</p>

    <details class="faq"><summary>Was ist LOGMAN?</summary>
      <div class="faq-a">
        <p>LOGMAN ist ein <b>Trainingstagebuch für ein festes Muskelaufbau-System</b>, keine allgemeine Fitness-App. Der Plan, die Satzarten und die Level sind vorgegeben; du wählst Übungen und protokollierst deine Leistung.</p>
        <p>Die App funktioniert auch ohne Empfang. Trainingsdaten werden zuerst lokal gespeichert und später synchronisiert.</p>
      </div>
    </details>

    <details class="faq"><summary>Worauf kommt es beim Muskelaufbau an?</summary>
      <div class="faq-a">
        <p>Wichtig sind <b>produktive Sätze nahe genug am Versagen, langfristige Leistungsentwicklung und ausreichende Erholung</b>. Ein Satz mit größerer Reserve kann trotzdem beitragen, setzt aber meist einen kleineren Reiz als ein vergleichbarer versagensnaher Satz.</p>
        <p>Volumen ist der Dosisregler. Die häufig genannten 10–20 Sätze sind eine grobe Faustregel, kein persönlicher Pflichtbereich. Heavy, leichte versagensnahe Pump-Arbeit und Cluster lassen sich außerdem nicht mit einem festen Faktor ineinander umrechnen.</p>
        <p><b>Muskelkater ist kein verlässliches Maß</b> für Trainingsqualität oder Muskelwachstum. Ungewöhnlich starker Muskelkater kann aber ein Hinweis sein, dass Belastung oder Übung neu beziehungsweise schlecht vertragen war.</p>
      </div>
    </details>

    <details class="faq"><summary>Was sind Overreach und Deload?</summary>
      <div class="faq-a">
        <p><b>Overreach</b> ist die sechswöchige Belastungsphase. Das Volumen darf im Verlauf fordernd werden, soll aber nicht Technik und Leistung dauerhaft zerstören.</p>
        <p>Der anschließende <b>Deload</b> senkt Belastungsmenge und Häufigkeit, damit aufgelaufene Ermüdung zurückgeht. Du kannst ihn überspringen, wenn du dich nach Woche 6 nachweislich erholt und leistungsfähig fühlst.</p>
      </div>
    </details>

    <details class="faq"><summary>Soll ich stretchen?</summary>
      <div class="faq-a">
        <p>Für Muskelaufbau und allgemeinen Verletzungsschutz ist zusätzliches langes Dehnen nicht notwendig. Krafttraining über eine kontrollierte, möglichst volle Bewegungsamplitude trainiert Beweglichkeit bereits mit.</p>
        <p>Dehnen ist sinnvoll, wenn eine konkrete Bewegungseinschränkung deine Übungstechnik stört. Vor dem Training eher kurz und dynamisch; langes statisches Dehnen unmittelbar vor schweren Sätzen kann die Leistung vorübergehend senken.</p>
      </div>
    </details>

    <p class="src">Evidenz: Pelland et al. · Baz-Valle et al. · Schoenfeld et al. · Wolf/Schoenfeld · Bell et al. (Deload).</p>`;
  container.appendChild(wrap);
  wrap.querySelector('[data-tutorial-start]')?.addEventListener('click', () => {
    try { sessionStorage.setItem('blast:tutorial-start', '1'); } catch (e) { /* egal */ }
  });
}
