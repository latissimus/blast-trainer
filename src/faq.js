// FAQ als Nachschlagewerk für das rollierende LOGMAN-Cycle-System.

// 500x689 WebP statt der 1148x1581-Kameradatei: Angezeigt wird das Bild mit
// 250x300 CSS-Pixeln, die Vorlage lieferte also gut das Zehnfache der noetigen
// Flaeche (261 KB gegen 50 KB). Die Breite reicht fuer 2x-Displays.
import floFotoUrl from './assets/flo.webp?url';

export function mountFaq(container) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Hilfe</span>
        <h1 class="section-title">FAQ</h1>
      </div>
      <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
    </div>

    <div class="faq-suche" role="search">
      <label for="faq-suche-input">FAQ durchsuchen</label>
      <div class="faq-suche-zeile">
        <input id="faq-suche-input" type="search" placeholder="z. B. Cycle, RIR oder Priorität" autocomplete="off">
        <button type="button" id="faq-suche-loeschen" aria-label="Suche löschen" hidden>×</button>
      </div>
      <p id="faq-suche-kein" hidden>Keine passende FAQ-Antwort gefunden.</p>
    </div>

    <p class="faq-sektion" id="faq-start">Schnellstart</p>

    <section class="faq-startkarte" aria-labelledby="faq-starttitel">
      <span class="faq-start-kicker">Start in 60 Sekunden</span>
      <h2 id="faq-starttitel">So legst du los</h2>
      <ol>
        <li><b>Tutorial starten</b> und deine festen HEAVYS- und MIDDLES-Übungen auswählen.</li>
        <li><b>Cycle, Einheit und Level</b> unten im Log prüfen.</li>
        <li><b>Gewicht, Wiederholungen und bei HEAVYS/MIDDLES RIR</b> eintragen – gespeichert wird automatisch.</li>
      </ol>
    </section>

    <details class="faq" open><summary>Wie starte ich mein erstes Training?</summary>
      <div class="faq-a">
        <p><b>Starte im Log das kurze Tutorial.</b> Es erklärt den rollierenden Split und führt dich durch die feste Übungsauswahl für OK/UK HEAVYS sowie OK/UK MIDDLES. PUMPS wählst du später direkt im Training frei.</p>
        <p>Danach beginnst du mit <b>Cycle 1 · OK HEAVYS</b>. Einen Speichern-Knopf brauchst du nicht: Jede Eingabe wird sofort auf dem Gerät gesichert und bei Verbindung hochgeladen.</p>
        <a class="faq-tutorial-start" href="#log" data-tutorial-start>Tutorial starten</a>
      </div>
    </details>

    <details class="faq"><summary>Was muss ich pro Satz eintragen?</summary>
      <div class="faq-a">
        <p><b>Gewicht und Wiederholungen.</b> Bei HEAVYS und MIDDLES kommt <b>RIR</b> hinzu. Das steht für <i>Reps in Reserve</i>, also Wiederholungen in Reserve. RIR 1 bedeutet: Eine saubere Wiederholung wäre noch möglich gewesen.</p>
        <p>Die App speichert automatisch. Beim nächsten vergleichbaren Cycle stehen deine letzten HEAVYS- und MIDDLES-Werte direkt über der Eingabe.</p>
      </div>
    </details>

    <details class="faq"><summary>Welches Level soll ich wählen?</summary>
      <div class="faq-a">
        <p>Das Level regelt die <b>Satzanzahl der aktuellen Einheit</b>. Die ausgeführten Sätze bleiben auf jedem Level produktiv und ausreichend nah am Versagen.</p>
        <p><b>Level I – Kompakt · weniger Volumen:</b> für den Einstieg, schwächere Tage, geringe Erholung oder Erhalt.<br>
        <b>Level II – Standard · normales Volumen:</b> die Vorauswahl und der vollständige Standardplan.<br>
        <b>Level III – Selektiv · Volumen selbst erhöhen:</b> startet mit Level II. Über den + Satz-Chip ergänzt du nur bei einzelnen Übungen Volumen.</p>
        <p>Wähle nach Leistung und Erholung, nicht nach Ehrgeiz. Erhöhe einzelne Muskeln schrittweise; wenn Technik, Zielmuskel oder Leistung unter späteren Sätzen leiden, entferne die Zusatzsätze wieder.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie finde ich mich in der App zurecht?</summary>
      <div class="faq-a">
        <p><b>Im Log</b> stellst du unten Cycle, Einheit, Level und Datum ein. Das violette Menü führt zu Notizbuch, Set-O-Meter, Progression und FAQs. Auf Unterseiten bringt dich „← Log“ zurück.</p>
        <p>Der Speicherstatus neben dem Profilbild bedeutet: <b>✓</b> gespeichert · <b>↻</b> speichert · <b>↑</b> wartet auf Verbindung · <b>⚠</b> Upload fehlgeschlagen. Deine Eingabe liegt auch in den letzten beiden Fällen bereits auf dem Gerät.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie exportiere oder lösche ich meine Daten?</summary>
      <div class="faq-a">
        <p>Tippe oben rechts auf dein Profilbild. Unter <b>„Meine Daten“</b> kannst du Profil, Trainingslog und Notizen als JSON-Datei exportieren.</p>
        <p>Dort kannst du auch Account und App-Daten endgültig löschen. Zur Sicherheit musst du das Wort <b>LÖSCHEN</b> vollständig bestätigen.</p>
      </div>
    </details>

    <p class="faq-sektion" id="faq-training">Im Training</p>

    <details class="faq"><summary>Wie trainiere ich HEAVYS?</summary>
      <div class="faq-a">
        <p><b>A-Tage · 6–10 Wiederholungen.</b> HEAVYS nutzen feste Übungen. Ziel sind technisch standardisierte Leistungsprogression, hohe mechanische Belastung und zuverlässige Logbuchvergleiche.</p>
        <p><b>Zielnähe:</b> Comp-Übungen werden mit 0–3 RIR, Iso-Übungen mit 0–2 RIR ausgeführt. 0 RIR bedeutet, dass keine weitere saubere Wiederholung möglich gewesen wäre.</p>
        <p>Du nutzt <b>Double Progression</b>: Steigere zuerst die Wiederholungen innerhalb des Bereichs. Erreichst du das obere Ende mit passender Technik und Ziel-RIR, erhöhst du die Last und beginnst wieder weiter unten im Bereich.</p>
        <p>Die Übung bleibt, solange sie <b>schmerzfrei, technisch reproduzierbar und progressierbar</b> ist. Nicht jede Übung muss in jedem Cycle besser werden.</p>
        <p><b>Evidenz:</b> Muskelaufbau ist über verschiedene Lastbereiche möglich, wenn Sätze ausreichend anstrengend sind. Schwerere Lasten machen die Leistung zusätzlich gut vergleichbar und fördern besonders die Maximalkraft.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie trainiere ich MIDDLES?</summary>
      <div class="faq-a">
        <p><b>B-Tage · 10–15 Wiederholungen.</b> MIDDLES sind feste, vollständig geloggte Übungen und bilden das progressiv getrackte Fundament dieser Einheiten.</p>
        <p><b>Zielnähe:</b> 0–2 RIR.</p>
        <p>Sie nutzen dieselbe <b>Double Progression</b> wie HEAVYS: erst Wiederholungen innerhalb des Bereichs steigern, danach die Last erhöhen. Auch MIDDLES bleiben im Plan, solange sie schmerzfrei, technisch reproduzierbar und progressierbar sind.</p>
        <p><b>Evidenz:</b> Moderate Lasten verbinden wirksame Versagensnähe mit gut kontrollierbarer Technik und meist geringerer absoluter Belastung als HEAVYS. Der eigene Name beschreibt die Rolle im Plan, keinen eigenen Wachstumsmechanismus.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie trainiere ich PUMPS?</summary>
      <div class="faq-a">
        <p><b>B-Tage · 15–25 Wiederholungen mit leichterer Last, aber versagensnah.</b> PUMPS ergänzen die festen MIDDLES um produktive Arbeit mit geringeren absoluten Lasten. Die Übungen dürfen freier wechseln.</p>
        <p><b>Zielnähe:</b> 0–1 RIR.</p>
        <p>Die Mischung aus MIDDLES und PUMPS dient <b>Volumenverteilung, Gelenkverträglichkeit, Übungsvielfalt und langfristiger Adhärenz</b> – nicht der Kombination zweier unabhängiger Wachstumsmechanismen.</p>
        <p><b>Lengthened Partials sind optional</b> und nur bei passenden, sicheren Übungen sinnvoll – nicht automatisch nach jedem Satz.</p>
        <p><b>Evidenz:</b> Leichtere Lasten können ähnlich Muskelmasse aufbauen wie schwere, wenn die Sätze nah genug ans Versagen geführt werden.</p>
      </div>
    </details>

    <details class="faq"><summary>Was heißen Comp und Iso?</summary>
      <div class="faq-a">
        <p><b>Comp = Verbundübung:</b> mehrere Gelenke und Muskeln arbeiten zusammen, zum Beispiel Bankdrücken. <b>Iso = Isolationsübung:</b> ein Muskel wird möglichst gezielt über meist ein Gelenk trainiert, zum Beispiel Fliegende oder Curls.</p>
        <p>Die App zeigt im jeweiligen Feld nur Übungen an, die zu Muskelgruppe und Rolle passen.</p>
      </div>
    </details>

<details class="faq"><summary>Wie soll ich die einzelnen Sätze der Übungen trainieren?</summary>
  <div class="faq-a">
    <p><b>Ablauf & Reihenfolge:</b><br>
    Du kannst deine Übungen ganz normal Satz für Satz abarbeiten oder zeiteffizient als <b>Antagonisten-Supersätze</b> (Wechsel zwischen Gegenspielern oder nicht-konkurrierenden Muskeln) trainieren.</p>

    <p><b>Mögliche Supersatz-Muster:</b><br>
    • <b>Compound → Isolation → Compound → Isolation</b><br>
    • <b>Bizeps → Trizeps → Bizeps → Trizeps</b><br>
    • <b>Schultern → Bauch → Schultern → Bauch</b></p>

    <p><b>Eiserne Regel für Supersätze:</b><br>
    Sobald der Supersatz deine Wiederholungsleistung oder dein Gewicht in einer Übung stark nach unten zieht (ZNS-/Herz-Kreislauf-Limit), werden die Übungen getrennt und einzeln ausgeführt!</p>
  </div>
</details>

    <details class="faq"><summary>Welche Pausenzeiten gelten?</summary>
      <div class="faq-a">
        <p>Die Pause steht direkt im jeweiligen Muskelblock und passt zur Übung: große HEAVYS-Comps meist <b>3 Minuten</b>, HEAVYS-Isos meist <b>2–2.5 Minuten</b>, MIDDLES meist <b>2 Minuten</b> und PUMPS meist <b>1–2 Minuten</b>.</p>
        <p>Ein Tipp auf den Uhr-Chip startet den Timer. Wenn deine Leistung trotz passender Anstrengung deutlich einbricht, darfst du etwas länger pausieren.</p>
        <p><b>Evidenz:</b> Sehr kurze Pausen sind für Muskelaufbau nicht überlegen. Ausreichende Pausen helfen, Wiederholungen und Satzqualität zu erhalten.</p>
      </div>
    </details>

    <details class="faq"><summary>Wofür sind die Übungsnotizen?</summary>
      <div class="faq-a">
        <p>Die Notiz unter einer Übung ist für dauerhafte Einstellungen und Cues wie Sitzhöhe, Griff oder Fußposition. Bei HEAVYS und MIDDLES wird sie zusammen mit der festen Übung in allen Cycles angezeigt.</p>
        <p>Das getrennte <b>Notizbuch</b> sammelt allgemeine Gedanken, Links und Bilder und bleibt bei einer neuen Phase erhalten.</p>
      </div>
    </details>

    <details class="faq"><summary>Wo notiere ich Griffvarianten oder studiospezifische Maschinen?</summary>
      <div class="faq-a">
        <p>Wähle im Übungskatalog den <b>allgemeinen Übungsnamen</b>. Die konkrete Griffbreite, Handstellung oder Griffart trägst du direkt darunter in die <b>Übungsnotiz</b> ein.</p>
        <p>Dasselbe gilt für Maschinen, die nur in deinem Studio stehen: Notiere zum Beispiel Hersteller, Modell, Sitzhöhe, Hebelstellung oder Studio. So bleibt der Katalog übersichtlich, während deine Ausführung eindeutig reproduzierbar ist.</p>
        <p>Bei festen HEAVYS und MIDDLES werden diese Angaben automatisch in allen Cycles übernommen.</p>
      </div>
    </details>

   <details class="faq"><summary>Kann ich Intensitätstechniken verwenden?</summary>
  <div class="faq-a">
    <p><b>Intensitätstechniken sind optional und ersetzen reguläre Sätze.</b> Sie sind wissenschaftlich nicht als mehr oder weniger effektiv als reguläre Sätze erwiesen, können allerdings eingesetzt werden, um Zeiteffizienz zu erzeugen.</p>

    <p><b>Rest-Pause</b><br>
    • Geeignet für: Maschinen, Kabel, Isolationen.<br>
    • Beispiel: Aktivierungssatz mit 10–15 Reps bis etwa 1 RIR → 15–25 Sekunden Pause → 3–5 Wiederholungen → erneut kurze Pause → 3–5 Wiederholungen.<br>
    • Maximal ein Rest-Pause-Satz pro Muskel und Einheit als Ausgangspunkt.</p>

    <p><b>Cluster-Sätze</b><br>
    • Geeignet für Maschinen oder ausgewählte Mehrgelenksübungen.<br>
    • Beispielsweise 4×4 bis 6×4 mit 10–15 Sekunden Pause innerhalb des Clusters (kein verpflichtendes mehrfaches Versagen).<br>
    • 1–2 Durchgänge primär zur Zeitersparnis. Können innerhalb einer Einheit die Übungen einer Muskelgruppe ersetzen.</p>

    <p><b>Drop-Sätze</b><br>
    • Nur bei sicheren Übungen.<br>
    • Ein normaler Satz, anschließend einmalige Lastreduktion.<br>
    • Nicht zusätzlich zu bereits maximalem Volumen.</p>

    <p><b>Lengthened Partials</b><br>
    • Nur bei sicherer Übung.<br>
    • Nach vollständiger Ausführung aller regulären Wiederholungen in der gedehnten Hälfte (wenige Zusatzwiederholungen).<br>
    • Nicht notwendig, wenn der Satz bereits 0–1 RIR erreicht hat.</p>
  </div>
</details>

    <p class="faq-sektion" id="faq-plan">Plan verstehen</p>

    <details class="faq"><summary>Was ist ein CYCLE?</summary>
      <div class="faq-a">
        <p>Ein Cycle besteht aus vier Einheiten: <b>OK HEAVYS → UK HEAVYS → OK MIDDLES &amp; PUMPS → UK MIDDLES &amp; PUMPS</b>. Danach beginnt der nächste Cycle wieder mit OK HEAVYS.</p>
        <p>Der Split rolliert unabhängig von Kalenderwochen. Du setzt je nach Erholung Pausentage und machst beim nächsten Training einfach mit der nächsten Einheit weiter.</p>
      </div>
    </details>

    <details class="faq"><summary>Warum ein rollierender OK/UK-Split?</summary>
      <div class="faq-a">
        <p>In jeder Einheit konzentrierst du dich nur auf Ober- oder Unterkörper. Dadurch bleiben Fokus, technische Qualität und Motivation höher, ohne nach schwerer Arbeit noch die andere Körperhälfte abarbeiten zu müssen.</p>
        <p>Die meisten Muskeln erhalten ungefähr zwei Kontakte pro Cycle. Die Verteilung hält einzelne Einheiten praktikabel und trennt systemisch ermüdende Belastungen.</p>
        <p><b>Evidenz:</b> Bei vergleichbarem Gesamtvolumen zeigt die Forschung keinen klaren Muskelaufbau-Vorteil einer bestimmten Frequenz. Die Aufteilung dient hier vor allem Qualität, Erholung und Umsetzbarkeit.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie lange läuft ein Trainingsblock?</summary>
      <div class="faq-a">
        <p>Standardmäßig trainierst du bis zu <b>sieben Cycles</b>. Das ist keine starre Zahl an Kalenderwochen: Ein Cycle ist erst beendet, wenn seine vier Einheiten absolviert wurden.</p>
        <p>Nach Cycle 7 kannst du direkt eine neue Phase beginnen oder den empfohlenen Deload wählen.</p>
      </div>
    </details>

    <details class="faq"><summary>Was passiert im Deload?</summary>
      <div class="faq-a">
        <p>Der Deload dauert ungefähr eine Woche und enthält <b>ein OK- und ein UK-Training</b>. Die Übungen und Lasten bleiben, die Sätze sinken ungefähr um 50 Prozent und du hältst 3–5 RIR.</p>
        <p>Es gibt kein Muskelversagen und keine Intensitätstechniken. Danach beginnt die nächste Phase wieder auf Level II.</p>
        <p><b>Evidenz:</b> Für eine exakt beste Deload-Methode gibt es wenig direkte Forschung. Die reduzierte Woche ist deshalb eine praktische Ermüdungssteuerung, keine starre biologische Pflicht.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie kommen die Satzzahlen zustande?</summary>
      <div class="faq-a">
        <p>Level II entspricht dem voreingestellten Standardplan. Große Muskelgruppen erhalten ihre Arbeit über HEAVYS, MIDDLES und PUMPS; kleinere Muskeln sammeln zusätzlich indirekte Belastung.</p>
        <p><b>Evidenz:</b> Mehr harte Sätze führen im Durchschnitt zu mehr Muskelaufbau, der Zusatznutzen wird aber kleiner und unterscheidet sich stark zwischen Muskeln und Personen. Außerdem zählen Versagensnähe und indirekte Arbeit mit – deshalb liegt der Standard bewusst unter pauschalen „10–20 direkte Sätze“-Vorgaben.</p>
        <p>Level I reduziert die Dosis. Level III startet mit denselben Satzzahlen wie Level II und zeigt an jeder Übung einen <b>+ Satz</b>-Chip. So erhöhst du nur dort, wo Entwicklung und Erholung tatsächlich mehr Volumen erlauben.</p>
      </div>
    </details>

    <details class="faq"><summary>Wie funktioniert ein Prioritätsmuskel?</summary>
      <div class="faq-a">
        <p>Öffne im Set-O-Meter einen Muskel und setze ihn auf Priorität. Der Muskel steht dann <b>am Anfang jeder passenden Einheit</b>, solange du noch frisch bist. Du kannst ihn dort ohne Zusatzvolumen trainieren oder <b>1–2 Sätze je Einheit</b> ergänzen.</p>
        <p><b>Keine Extras:</b> LOGMAN verschiebt den bereits vorhandenen Muskelblock nur nach oben. Ist der Muskel noch nicht regulär eingeplant – etwa Unterarme –, braucht er mindestens einen Zusatzsatz, damit überhaupt eine Übungskarte entsteht.</p>
        <p>Beispiel Unterarme mit zwei Sätzen: +2 in OK HEAVYS und +2 in OK MIDDLES &amp; PUMPS. Du kannst das Volumen <b>aufschlagen</b> oder dieselbe Satzanzahl von einem geeigneten Muskel derselben Körperhälfte <b>umverteilen</b>.</p>
        <p>Bei mehreren Prioritäten stehen alle oben – in der Reihenfolge, in der du sie priorisiert hast. Danach folgt der übrige Plan unverändert.</p>
        <p><b>Evidenz:</b> Früher ausgeführte Übungen erlauben meist mehr Wiederholungen und zeigen tendenziell größere Kraftzuwächse. Für zusätzlichen Muskelaufbau allein durch die Reihenfolge ist dagegen kein klarer Vorteil belegt. Kleine Volumenerhöhungen um ein bis zwei Sätze bleiben besser kontrollierbar als große Sprünge.</p>
      </div>
    </details>

    <details class="faq"><summary>Muss ich das Set-O-Meter benutzen?</summary>
      <div class="faq-a">
        <p><b>Nein.</b> Der Standardplan ist ohne Änderung vollständig. Das Set-O-Meter zeigt nur die Verteilung innerhalb des aktuellen Cycles und ermöglicht gezielte Prioritäten.</p>
        <p>Direkte Sätze treffen den Muskel als Hauptziel. Indirekte Sätze belasten ihn unterstützend; sie werden als 1 angezeigt, im Vergleichsbalken aber mit 0,5 gewichtet.</p>
      </div>
    </details>

    <details class="faq"><summary>Was zeigt die Progression?</summary>
      <div class="faq-a">
        <p>Die Kurve zeigt getrennt den <b>Trend deiner HEAVYS- und MIDDLES-Leistung</b>. Dafür berechnet LOGMAN aus dem besten Satz jedes Cycles ein geschätztes <b>1RM</b>. Das steht für <i>One-Repetition Maximum</i>, also das geschätzte Gewicht für eine maximale Wiederholung.</p>
        <p>Es ist eine Rechengröße, kein echter Maximalkrafttest und kein direkter Beweis für Muskelwachstum. Einzelne schwächere Einheiten sind normal; entscheidend ist der Trend über mehrere Cycles.</p>
      </div>
    </details>

    <details class="faq"><summary>Was ist der PUMPS-Übungspool?</summary>
      <div class="faq-a">
        <p>PUMPS dürfen frei rotieren. Deshalb merkt sich der Pool zu jedem Übungsnamen das zuletzt verwendete Gewicht und die Wiederholungen – unabhängig davon, in welchem Cycle du die Übung wieder auswählst.</p>
        <p>Der Pool bleibt beim Start einer neuen Phase erhalten und dient nur als Orientierung. PUMPS werden nicht als eigene Progressionskurve bewertet.</p>
      </div>
    </details>

  <details class="faq"><summary>Wann sollte ich Volumen verändern?</summary>
      <div class="faq-a">
        <p><b>Erhöhen:</b> Wenn Entwicklung über mehrere Cycles ausbleibt, Technik und Progression stabil sind und du vollständig erholt bist. Ergänze zunächst 1–2 Sätze und beobachte mindestens zwei bis drei Cycles.</p>
        
<p><b>Indikation für eine Drosselung:</b><br>
    • Hoher Alltagsstress oder schwierige Lebensphasen.<br>
    • Urlaub oder fehlende Motivation.<br>
    • Aufkeimende Gelenkschmerzen oder schlechte Regeneration.</p>

    <p><b>Konkrete Maßnahmen:</b><br>
    • <b>Volumenstufe Level I wählen</b> (Erhaltung / Basis-Reiz).<br>
    • <b>Weniger systemisch ermüdende Übungen:</b> Freie Mehrgelenksübungen reduzieren, häufiger auf Maschinen ausweichen.<br>
    • <b>Keine starre Progressionspflicht:</b> Das Training dient in diesen Phasen dem Krafterhalt und der Stressbewältigung, nicht dem Erzwingen neuer Rekorde.</p>
      </div>
    </details>

<details class="faq"><summary>Wie soll ein Übungswechsel aussehen?</summary>
  <div class="faq-a">
    <p><b>Übung bleibt im Plan, wenn:</b><br>
    • Sie vollkommen schmerzfrei ist.<br>
    • Die Technik stabil sitzt und der Zielmuskel klar beteiligt ist.<br>
    • Sie kontinuierlich progressierbar ist (HEAVYS und MIDDLES).<br>
    • Ermüdung und Bewegungsumfang (ROM) angemessen sind.</p>

    <p><b>Übung wird modifiziert, wenn:</b><br>
    • Geräteeinstellung, Griff oder Stand Beschwerden verursachen.<br>
    • Die verfügbaren Lastsprünge zu groß sind.<br>
    • Die Reihenfolge innerhalb der Einheit die Leistung unnötig begrenzt.</p>

    <p><b>Übung wird ersetzt, wenn:</b><br>
    • Wiederkehrende Schmerzen auftreten.<br>
    • Über mehrere vergleichbare Einheiten keine Progression möglich ist (HEAVYS und MIDDLES).<br>
    • Der Zielmuskel trotz sauberer Technikarbeit nicht der limitierende Faktor ist.<br>
    • Die systemische Ermüdung unverhältnismäßig hoch ist.</p>

    <p><b>Wichtig:</b> Übungen werden niemals allein wegen fehlendem Muskelkater oder fehlendem Pump ausgetauscht!</p>
  </div>
</details>

    <details class="faq"><summary>Worauf kommt es beim Muskelaufbau an?</summary>
      <div class="faq-a">
        <p>Wichtig sind <b>produktive Sätze nahe genug am Versagen, langfristige Leistungsentwicklung und ausreichende Erholung</b>. Nicht der maximal mögliche Reiz einer einzelnen Einheit zählt, sondern der höchste wiederholbar produktive Reiz.</p>
        <p>Volumen ist der Dosisregler. Die häufig genannten 10–20 Sätze sind eine grobe Faustregel, kein persönlicher Pflichtbereich. Direkte und indirekte Arbeit sowie unterschiedliche Versagensnähe müssen im Zusammenhang betrachtet werden.</p>
        <p><b>Muskelkater ist kein verlässliches Maß</b> für Trainingsqualität oder Muskelwachstum.</p>
      </div>
    </details>

    <details class="faq"><summary>Soll ich stretchen?</summary>
      <div class="faq-a">
        <p>Für Muskelaufbau und allgemeinen Verletzungsschutz ist zusätzliches langes Dehnen nicht notwendig. Krafttraining über eine kontrollierte, möglichst volle Bewegungsamplitude trainiert Beweglichkeit bereits mit.</p>
        <p>Dehnen ist sinnvoll, wenn eine konkrete Bewegungseinschränkung deine Übungstechnik stört. Vor dem Training eher kurz und dynamisch.</p>
      </div>
    </details>

    <p class="faq-sektion" id="faq-hintergrund">Hintergrund & Weiteres</p>

    <details class="faq"><summary>Was ist LOGMAN?</summary>
      <div class="faq-a">
	<p>LOGMAN ist aus dem Anspruch heraus entstanden, ein evidenzbasiertes Werkzeug für intelligentes Krafttraining mit dem Ziel der Hypertrophie zu schaffen – mit maximalem Fokus auf Progression und Regeneration 👊🏼</p>

        <p>Im Ergebnis ist LOGMAN ein <b>Trainingstagebuch im Retro-Look für ein festes, aber anpassbares Muskelaufbau-System</b>. Es verbindet progressiv dokumentierte HEAVYS und MIDDLES, ergänzende versagensnahe PUMPS, individuell erholbares Volumen und einen rollierenden OK/UK-Split.</p>
        
	<p>Die App funktioniert auch ohne Empfang. Trainingsdaten werden zuerst lokal gespeichert und später synchronisiert.</p>
      </div>
    </details>

<details class="faq"><summary>Evidenz der Trainingsrezeptur von LOGMAN</summary>
      <div class="faq-a">
	<p><b>Studien & Quellen:</b></p>
  <p><a href="https://www.sciencedirect.com/science/article/pii/S2095254625000869" target="_blank" rel="noopener noreferrer">Mechanismen zu Hypertrophie</a></p>
  <p><a href="https://journals.physiology.org/doi/full/10.1152/physrev.00039.2022" target="_blank" rel="noopener noreferrer">Mechanismen zu Hypertrophie 2</a></p>
  <p><a href="https://www.fisiologiadelejercicio.com/wp-content/uploads/2025/12/The-Resistance-Training-Dose-Response.pdf" target="_blank" rel="noopener noreferrer">Metastudie zu Volumen</a></p>
  <p><a href="https://fitchef.com/shorts/best-rep-range-muscle-growth/" target="_blank" rel="noopener noreferrer">Last & Wiederholungsbereich</a></p>
  <p><a href="https://sportrxiv.org/index.php/server/preprint/view/782" target="_blank" rel="noopener noreferrer">Last & Wiederholungsbereich 2</a></p>
  <p><a href="https://www.strengthscience.co/p/closer-to-failure-bigger-muscles" target="_blank" rel="noopener noreferrer">Nähe zum Muskelversagen (RIR)</a></p>
  <p><a href="https://getfitcraft.com/science/training-to-failure-vs-reps-in-reserve" target="_blank" rel="noopener noreferrer">Nähe zum Muskelversagen (RIR) 2</a></p>
  <p><a href="https://www.fisiologiadelejercicio.com/wp-content/uploads/2025/12/The-Resistance-Training-Dose-Response.pdf" target="_blank" rel="noopener noreferrer">Trainingsfrequenz</a></p>
  <p><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9528903/" target="_blank" rel="noopener noreferrer">Progressive Überladung</a></p>
  <p><a href="https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1429789/full" target="_blank" rel="noopener noreferrer">Satzpausen</a></p>
  <p><a href="https://peerj.com/articles/16777/" target="_blank" rel="noopener noreferrer">Regeneration & Deload</a></p>
  <p><a href="https://www.researchgate.net/publication/391802156_A_Practical_Approach_to_Deloading_Recommendations_and_Considerations_for_Strength_and_Physique_Sports" target="_blank" rel="noopener noreferrer">Regeneration & Deload 2</a></p>

  <p><b>Zusammengefasst:</b></p>
  <p>Spannung ist alles → Last ist zweitrangig (5–30 Reps, nah ans Versagen) → Volumen steigern trägt zu Muskelwachstum bei mit abnehmenden Erträgen pro weiterem Satz ab einer gewissen Anzahl pro Muskel und Einheit (~10–20 Sätze/Muskel/Woche als Korridor) → Frequenz nach Praktikabilität → progressiv überladen (egal ob Gewicht oder Reps) → Deload nach Bedarf, nicht aus Prinzip.</p>
</div>
    </details>

<details class="faq"><summary>Wer steckt hinter LOGMAN?</summary>
  <div class="faq-a">
    <div style="text-align: center; margin-bottom: 15px;">
      <img src="${floFotoUrl}" alt="Florian Rau" style="width: 250px; height: 300px; border-radius: 20px; object-fit: cover; border: 2px solid #001454;">
    </div>

    <p><b>Entwickelt von Florian Rau</b><br>
    • Bachelor Fitnessökonomie<br>
    • 10 Jahre Kraftsport-Praxis</p>
 
<p><b>Ausbildungen</b><br>

    <p><b>Anatomie & Biomechanik:</b><br>
    • Funktionelle Anatomie<br>
    • Gelenkstrukturen und Bewegungsachsen<br>
    • Muskelaktivierungsmuster</p>

    <p><b>Trainingsdesign & Periodisierung:</b><br>
    • Programmdesign Theorie & Praxis<br>
    • Periodisierungskonzepte<br>
    • Fallbeispiel-Anwendungen</p>

    <p><b>Körperkomposition:</b><br>
    • Körperfettassessment<br>
    • Hormone & Körperzusammensetzung<br>
    • Before/After-Erfolgsfaktoren</p>

    <p><b>Ernährung & Supplemente:</b><br>
    • Funktionelle Ernährung (Makro- & Mikronährstoffe)<br>
    • Supplement-Physiologie</p>

    <p><b>Rehabilitation & Mobilität:</b><br>
    • Mobility Tests & Funktionsprüfungen<br>
    • Rehabilitationsprinzipien</p>

    <p><b>Neurotransmitter & Biomarker:</b><br>
    • Neurotransmitter-Physiologie</p>
  </div>
</details>

    <p class="src"><b>Grundlagen:</b> LOGMAN-Training · produktive Versagensnähe · progressive Belastung · erholbares Volumen · standardisierte Ausführung.</p>
    <p class="src faq-credit">LOGMAN – Concept &amp; Code by <b>Florian Rau</b></p>`;
  container.appendChild(wrap);

  const faqSuche = wrap.querySelector('#faq-suche-input');
  const faqLoeschen = wrap.querySelector('#faq-suche-loeschen');
  const faqKein = wrap.querySelector('#faq-suche-kein');
  const faqStartkarte = wrap.querySelector('.faq-startkarte');
  const faqBereiche = [];
  let faqBereich = null;
  [...wrap.children].forEach((kind) => {
    if (kind.classList.contains('faq-sektion')) {
      faqBereich = { kopf: kind, fragen: [] };
      faqBereiche.push(faqBereich);
    } else if (faqBereich && kind.matches('details.faq')) {
      faqBereich.fragen.push(kind);
    }
  });

  const normalisiere = (s) => String(s || '').toLocaleLowerCase('de-DE').trim();
  const faqFiltern = () => {
    const suchwort = normalisiere(faqSuche.value);
    let treffer = 0;
    faqBereiche.forEach(({ kopf, fragen }) => {
      let bereichTreffer = 0;
      fragen.forEach((frage) => {
        const passt = !suchwort || normalisiere(frage.textContent).includes(suchwort);
        frage.hidden = !passt;
        if (passt) bereichTreffer += 1;
      });
      kopf.hidden = !!suchwort && bereichTreffer === 0;
      treffer += bereichTreffer;
    });
    if (faqStartkarte) faqStartkarte.hidden = !!suchwort;
    faqKein.hidden = !suchwort || treffer > 0;
    faqLoeschen.hidden = !suchwort;
  };

  faqSuche?.addEventListener('input', faqFiltern);
  faqLoeschen?.addEventListener('click', () => {
    faqSuche.value = '';
    faqFiltern();
    faqSuche.focus();
  });
  wrap.querySelector('[data-tutorial-start]')?.addEventListener('click', () => {
    try { sessionStorage.setItem('blast:tutorial-start', '1'); } catch (e) { /* egal */ }
  });
  wrap.querySelectorAll('details.faq').forEach((frage) => {
    frage.querySelector('summary')?.addEventListener('click', () => {
      frage.dataset.manuellGeoeffnet = '1';
    });
    frage.addEventListener('toggle', () => {
      if (!frage.open || frage.dataset.manuellGeoeffnet !== '1') return;
      delete frage.dataset.manuellGeoeffnet;
      requestAnimationFrame(() => frage.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      }));
    });
  });
}
