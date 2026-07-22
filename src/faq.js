// Das FAQ.
//
// Eigene Seite statt Overlay: Es ist lange Lektuere, kein Nachschlagen zwischen
// zwei Saetzen. In einem Blatt las man es durch ein 88%-Fenster mit eigenem
// Scrollbereich, was auf dem Telefon immer etwas hakt.
//
// Reihenfolge: vom Grossen zum Kleinen. Erst was die App ueberhaupt ist und wie
// die Woche aussieht, dann die Bedienung, dann die einzelnen Satzarten, zuletzt
// Hintergrund. Wer zum ersten Mal aufmacht, liest von oben und versteht mit
// jedem Eintrag mehr – statt bei "Wie trainiere ich die Heavy-Saetze?" zu
// starten, ohne zu wissen, was Heavy ist.

export function mountFaq(container) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
      <div class="seitenkopf">
        <h1 class="section-title">💬 FAQ</h1>
        <a class="zurueck" href="#log"><span class="pf">←</span> Log</a>
      </div>
        <p class="faq-sektion">LOGMAN und das Prinzip</p>

        <details class="faq"><summary>Was ist LOGMAN?</summary>
          <div class="faq-a">
            <p>Ein <b>Trainingstagebuch für ein System zum Muskelaufbau</b> — keine allgemeine Fitness-App. Das Ziel ist <b>Hypertrophie</b>, also mehr Muskelmasse. Nicht Maximalkraft, nicht Ausdauer.</p>
            <p><b>Stärker werden ist dabei das Mittel, nicht der Zweck.</b> Muskeln wachsen, wenn sie regelmäßig mehr leisten müssen als zuletzt — das ist die progressive Überlastung. Du kannst von Woche zu Woche nicht sehen, ob ein Muskel gewachsen ist, aber du kannst sehen, ob die Last steigt. Deshalb misst die App das: Über jeder Heavy-Übung steht, was du beim letzten Mal geschafft hast, und auf der Seite „Progression" liegt eine Kurve deiner Entwicklung.</p>
            <p>LOGMAN kennt den Plan bereits: welche Tage es gibt, welche Muskelgruppen wann drankommen und wie viele Sätze bei welchem Level fällig sind. Du trägst nur Gewicht und Wiederholungen ein und wählst die Übungen.</p>
            <p>Die App läuft auch <b>ohne Empfang</b>. Was du eintippst, liegt sofort auf dem Gerät; hochgeladen wird, sobald wieder Netz da ist. Im Keller-Studio kannst du also normal weiterarbeiten.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie sieht die Trainingswoche aus?</summary>
          <div class="faq-a">
            <p><b>Drei Einheiten pro Woche</b>, jede mit einem anderen Schwerpunkt:</p>
            <p><b>Tag 1 — Oberkörper Heavy, Unterkörper Pump.</b><br>
            <b>Tag 2 — genau umgekehrt:</b> Unterkörper Heavy, Oberkörper Pump.<br>
            <b>Tag 3 — Clusters für den ganzen Körper.</b></p>
            <p>Jeder Muskel wird so <b>dreimal pro Woche</b> gereizt — einmal als Heavy, einmal als Pump, einmal als Cluster. Das ist der Kerngedanke: nicht ein großer Reiz pro Woche, sondern drei verschiedene.</p>
            <p><b>„Pump" heißt nicht „locker".</b> Pump ist <b>leichte, aber versagensnahe Arbeit</b>: Das geringere Gewicht erlaubt mehr Wiederholungen, der Wachstumsreiz entsteht jedoch wie bei den anderen Sätzen vor allem durch hohe mechanische Spannung in den letzten anstrengenden Wiederholungen — nicht durch einen eigenen „metabolischen" Mechanismus. <b>Jeder Satz an jedem Tag soll einen Wachstumsreiz setzen</b>; nur Last und Wiederholungsbereich unterscheiden sich.</p>
            <p>Darüber liegt ein größerer Rhythmus: Nach <b>6 Wochen Overreach</b> entscheidest du zwischen einer neuen Phase und standardmäßig <b>1 Woche Deload</b>. Mehr dazu weiter unten.</p>
          </div>
        </details>

        <details class="faq"><summary>Worauf kommt es beim Training an?</summary>
          <div class="faq-a">
            <p><b>1. Progressive Überlastung</b> — mehr Last oder mehr Wdh. gegenüber dem letzten Mal. Steht als Delta über jeder Heavy-Übung.</p>
            <p><b>2. Nähe zum Versagen</b> — der Reizauslöser pro Satz. Ein Satz, bei dem noch fünf Wdh. drin gewesen wären, zählt kaum.</p>
            <p><b>3. Erholung</b> — Schlaf, Protein, Stress. Das Fundament, ohne das die ersten beiden nichts bringen.</p>
            <p>Das <b>Volumen</b> (Anzahl Sätze) ist der Dosis-Regler darüber. Man liest oft „10–20 Sätze pro Muskel und Woche" — diese Zahl stammt aber überwiegend aus Studien mit unterschiedlich großer Versagensnähe. Hier wird bewusst versagensnah trainiert; Techniken wie Lengthened Partials können optional dazukommen. Ein Satz ist also nicht gleich ein Satz, und die Zahl lässt sich nicht 1:1 übertragen. Genau deshalb zeigt das Set-O-Meter bewusst <b>keinen Zielwert</b>.</p>
            <p>Muskelkater ist übrigens kein Maß für irgendetwas.</p>
          </div>
        </details>

        <details class="faq"><summary>Was ist Overreach und Deload?</summary>
          <div class="faq-a">
            <p><b>Overreach</b> = 6 Wochen progressiv (Level steigend): bewusst etwas mehr, als du dauerhaft wegstecken würdest. Am Ende fühlst du dich platt — das ist kein Fehler, sondern der Plan.</p>
            <p>Nach Woche 6 entscheidest du: Fühlst du dich erholt und leistungsfähig, kannst du direkt eine <b>neue Phase</b> beginnen. Ist Ermüdung aufgelaufen, wählst du standardmäßig <b>1 Woche Deload</b>: Volumen und Frequenz runter, nur Clusters. Danach beginnt die nächste Phase.</p>
            <p><b>Warum dann ausgerechnet Clusters?</b> Weil im Deload das <b>Volumen</b> fallen soll, der <b>Reiz</b> aber nicht. Genau das ist der Befund der Deload-Forschung: Volumen und Frequenz darf man deutlich senken — solange die Intensität oben bleibt, bleibt die Anpassung erhalten, statt abzubauen. Ein Cluster liefert genau das in kompakter Form: wenig Gesamtvolumen, aber ein echter Versagenspunkt im letzten Minisatz. Du erholst dich, ohne den Faden zu verlieren.</p>
          </div>
        </details>

        <p class="faq-sektion">Die App bedienen</p>

        <details class="faq"><summary>Wie finde ich mich zurecht?</summary>
          <div class="faq-a">
            <p>Die App hat <b>eine Leiste am unteren Rand</b>, und die ist überall gleich. Links die vier Einstellungen deiner Einheit — <b>Woche, Tag, Level, Datum</b> — rechts das fliederfarbene <b>Menü</b>. Unter dem Menü-Symbol steht immer, wo du gerade bist.</p>
            <p>Über das Menü erreichst du:</p>
            <p><b>Log</b> — das Trainingstagebuch. Hier bist du fast immer.<br>
            <b>Set-O-Meter</b> — welcher Muskel diese Woche wie viel Arbeit bekommt.<br>
            <b>Progression</b> — die Kurve deiner Leistung über die Wochen.<br>
            <b>Profil</b> — über dein Bild oben rechts.</p>
            <p>Auf jeder Unterseite steht oben rechts <b>← Log</b>. Das ist der kürzeste Weg zurück; über das Menü wären es zwei Tipps.</p>
            <p>Jede Seite hat ihre eigene Farbe, damit du auf einen Blick siehst, wo du bist: Das Log ist hellblau, das Set-O-Meter flieder, die Progression rosa, das FAQ gelb, das Profil grün.</p>
            <p><b>Die vier Einstellfelder wirken nur im Log.</b> Auf den anderen Seiten stehen sie weiter da — damit die Leiste überall gleich aussieht — sind dort aber ohne Funktion und zeigen den zuletzt gesehenen Stand.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie benutze ich die App?</summary>
          <div class="faq-a">
            <p><b>1. Woche und Tag wählen.</b> In der Leiste ganz unten. Jedes Feld zeigt oben den Wert und darunter, wofür er steht — die Woche also mit A- oder B-Rotation. Ob Overreach oder Deload steht als Chip oben neben dem Logo.</p>
            <p><b>2. Level nach Tagesform wählen.</b> Ebenfalls unten, I, II oder III. Danach richtet sich, wie viele Sätze heute fällig sind — nicht nach Ehrgeiz, sondern danach, wie du dich fühlst.</p>
            <p><b>3. Wochenvolumen planen.</b> Tippe auf die kleine violette <b>Set-O</b>-Lasche unter dem Header. Sie klappt sich nach unten auf und zeigt <b>Öffnen</b>. Tippe im Set-O-Mat einen Muskel an und setze ihn bei Bedarf direkt in seiner Zeile auf Priorität. Das geht schon, bevor du eine Pump-Übung gewählt hast.</p>
            <p><b>4. Übungen auswählen.</b> Jedes Feld bietet dir nur Übungen an, die zu diesem Block passen. Die <b>Heavy-Übungen wählst du einmalig in Woche 1 und Woche 2</b> — ab Woche 3 stehen sie von selbst da (siehe unten). Pump und Cluster wählst du jede Woche neu. Eine vorgemerkte Priorität greift, sobald die passende Pump-Übung gewählt ist.</p>
            <p><b>5. Eintragen.</b> Gewicht und Wiederholungen je Satz. Über der Übung siehst du die Werte vom letzten Mal, damit du weißt, was du schlagen musst. Der Pausentimer startet über den Chip mit der Uhr.</p>
            <p><b>Einen Speichern-Knopf gibt es nicht.</b> Die App sichert nach jeder Eingabe von selbst — zuerst auf dem Gerät, dann auf dem Server. Ob das geklappt hat, sagt das kleine Zeichen links neben deinem Profilbild.</p>
          </div>
        </details>

        <details class="faq"><summary>Woher kommen die Übungen zur Auswahl?</summary>
          <div class="faq-a">
            <p>Aus einem festen <b>Katalog</b>. Jedes Feld zeigt nur die Übungen, die dort hineinpassen — gefiltert nach der Muskelgruppe des Blocks und, bei Heavy, danach ob eine <b>Comp</b>- oder eine <b>Iso</b>-Übung gefragt ist. Innerhalb der Liste sind sie nach Muskel gruppiert, zuletzt Benutztes steht oben.</p>
            <p><b>Freitext gibt es bewusst nicht.</b> Nur so weiß die App, auf welchen Muskel ein Satz einzahlt — und nur so kann das Set-O-Meter überhaupt rechnen. Ein Tippfehler wäre sonst still eine zweite Übung.</p>
            <p>Steht in einem Feld noch ein alter Name, den der Katalog nicht kennt, bleibt er sichtbar und ist als <i>„Nicht im Katalog"</i> markiert. Verloren geht nichts.</p>
          </div>
        </details>

        <details class="faq"><summary>Was zeigt das Set-O-Meter?</summary>
          <div class="faq-a">
            <p>Wie viel Arbeit jeder Muskel <b>in dieser Woche</b> abbekommt. Zu öffnen über die kleine violette <b>Set-O</b>-Lasche unter dem Header oder über das Menü rechts in der unteren Leiste. Priorisierte Muskeln stehen oben; alle übrigen folgen nach geplantem Volumen.</p>
            <p><b>Gezählt wird der Plan, nicht das Eingetragene.</b> Sobald eine Übung gewählt ist, zählen die Sätze, die Level und Vorlage dafür vorsehen. Deshalb steht das Bild schon, <i>bevor</i> du trainiert hast — und genau dann nützt es: Du siehst, was deine Heavy-Wahl liefert, und wählst Pump und Cluster gegen die Lücken.</p>
            <p><b>Direkte und indirekte Arbeit haben eigene Balkenabschnitte.</b> Ein indirekter Satz wird als 1 angezeigt, im Vergleich aber mit 0,5 gewichtet. Ein Satz Rudern erscheint deshalb als ein indirekter Satz für Bizeps und trägt dort einen halb gewichteten Balkenanteil bei.</p>
            <p><b>Tippe eine Muskelzeile an und wähle „Als Priorität setzen".</b> Die Planung klappt unmittelbar unter diesem Muskel auf. Die Priorität gibt ihm auf jedem Level einen zusätzlichen Pump-Satz. Du kannst sie bereits vormerken, bevor du die konkrete Pump-Übung im Log ausgewählt hast; die zusätzliche Eingabezeile erscheint sofort im passenden leeren Pumpfeld.</p>
            <p>Danach entscheidest du zwischen <b>Umverteilen</b> und <b>Aufschlagen</b>. Umverteilen bedeutet: +1 Satz für den Zielmuskel und −1 Satz bei einer von dir bestätigten, nicht priorisierten Pump-Übung derselben Einheit. Die App ordnet mögliche Spender nach ihrer bereits geplanten direkten und indirekten Wochenarbeit, entscheidet aber nie selbst. Aufschlagen erhöht das Gesamtvolumen bewusst um einen Satz.</p>
            <p><b>Prioritäten wirken auch auf Level I.</b> Ist die passende Pump-Übung oder der bestätigte Spender nicht gewählt, pausiert eine Umverteilung vollständig — aus einem fehlenden Spender wird nie still ein Volumenaufschlag.</p>
            <p><b>Es gibt keinen Zielwert und keine Warnung</b>, und das ist Absicht. Das Meter vergleicht die Muskeln nur untereinander. Ob dir auffällt, dass die Waden einen längeren Balken haben als die Brust, und ob dich das stört, ist deine Entscheidung — nicht die der App.</p>
            <p>Ein Cluster zählt dabei als <b>ein</b> Satz.</p>
          </div>
        </details>

        <details class="faq"><summary>Was zeigt die Heavy-Progression?</summary>
          <div class="faq-a">
            <p>Die Kurve deiner Leistung über die Wochen — <b>der wichtigste Wert, den die App hat</b>. Sie hat eine eigene Seite: im Menü unter „Progression".</p>
            <p><b>Warum ausgerechnet die?</b> Muskelaufbau folgt der progressiven Überlastung: Wächst deine Leistung über die Wochen nicht, fehlt dem Körper der Grund, sich anzupassen. Alles andere — Volumen, Übungswahl, Ernährung — zahlt erst darauf ein. Ob ein Muskel gewachsen ist, siehst du im Spiegel frühestens nach Monaten; ob die Leistung steigt, siehst du hier nach zwei Wochen.</p>
            <p><b>Was genau aufgetragen wird:</b> das <b>geschätzte 1RM</b> deines besten Satzes je Woche — also die Last, die du rechnerisch genau einmal schaffen würdest. Berechnet nach der Epley-Formel aus Gewicht und Wiederholungen.</p>
            <p><b>Wozu die Umrechnung?</b> Damit beide Wege zählen. Sind 85 kg × 6 besser als 80 kg × 8? Am reinen Gewicht kannst du das nicht ablesen, am geschätzten 1RM schon: <b>102 kg gegen 101,3 kg</b> — also ja, aber denkbar knapp. Ohne diese Umrechnung müsstest du Gewicht und Wiederholungen im Kopf gegeneinander abwägen.</p>
            <p><b>Es zählt der beste Satz der Woche</b>, nicht der letzte — ein schwacher Abschlusssatz nach vier harten drückt die Kurve sonst grundlos.</p>
            <p><b>Nur Heavy-Sätze.</b> Pump und Cluster sind nicht zum Messen von Fortschritt gedacht, sie tauchen hier gar nicht auf.</p>
            <p>Eine Übung erscheint, sobald sie in <b>mindestens zwei Wochen</b> steht — aus einem Punkt lässt sich keine Entwicklung lesen. Weil die Heavy-Tage zwischen A und B wechseln, kommt jede Übung alle zwei Wochen dran: Die Kurve hat also Punkte bei Woche 1, 3, 5 oder bei 2, 4, 6.</p>
            <p><b>Das geschätzte 1RM ist eine Rechnung, kein Test.</b> Sie wird ungenauer, je weiter die Wiederholungszahl von einem echten Maximalversuch entfernt liegt. Für den Vergleich mit dir selbst über die Wochen reicht das völlig — geh nicht los, um die Zahl auszutesten.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie merkt sich die App meine Übungen und Gewichte?</summary>
          <div class="faq-a">
            <p><b>Heavy-Übungen gehören fest zum Tag — du wählst sie genau zweimal.</b> In <b>Woche 1</b> legst du die Übungen der A-Tage fest, in <b>Woche 2</b> die der B-Tage. Ab Woche 3 stehen sie automatisch da: Woche 3 und 5 holen sich die Wahl aus Woche 1, Woche 4 und 6 die aus Woche 2. Du musst also nie zweimal dasselbe eintragen.</p>
            <p>Über der Übung siehst du <i>„Wo 3: 80×8, 80×7"</i> — die Werte vom letzten Mal, plus <b>▲ gesteigert</b> / <b>= gehalten</b> / <b>▼ gesunken</b>, sobald du heute etwas einträgst.</p>
            <p>Änderst du eine Heavy-Übung später doch noch, gilt die Änderung <b>für alle Wochen dieser Rotation</b> — auch rückwirkend für die Beschriftung schon eingetragener Sätze. Die Zahlen bleiben stehen, nur der Name darüber wechselt.</p>
            <p><b>Pump- und Cluster-Übungen</b> rotierst du frei. Sie hängen deshalb nicht am Tag, sondern <b>am Namen</b>: Wählst du dieselbe Übung irgendwann wieder — egal an welchem Tag oder in welcher Woche — erscheint automatisch <i>„zuletzt: 30 kg × 18 Wdh · Wo 3"</i> bzw. beim Cluster <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>.</p>
            <p>Bei Pump und Cluster gibt es bewusst <b>kein</b> ▲/▼-Delta: Diese Sätze sind nicht zum Messen von Fortschritt gedacht — der Wert dient nur als Anhaltspunkt fürs Einstellen. Gemessen wird an den Heavy-Sätzen.</p>
          </div>
        </details>

        <details class="faq"><summary>Kann ich zusätzliche Sätze machen?</summary>
          <div class="faq-a">
            <p><b>Nicht direkt an einer Übung.</b> Die Satzzahlen der Vorlage bleiben fest, damit es nur einen eindeutigen Weg für zusätzliches Volumen gibt.</p>
            <p>Willst du einem Muskel mehr geben, setzt du ihn im <b>Set-O-Meter auf Priorität</b>. Dort entscheidest du bewusst, ob der zusätzliche Pump-Satz umverteilt oder auf das Wochenvolumen aufgeschlagen wird. Im Log erscheint er als „Priorität +1" beziehungsweise „Umverteilung −1" am Übungsfeld.</p>
            <p><b>Heavy und Cluster bleiben ebenfalls fest.</b> Heavy ist die Messlatte deiner Progression — Sätze dort zu verändern macht den Vergleich über die Wochen unsauber.</p>
          </div>
        </details>

        <details class="faq"><summary>Was bedeutet der Punkt auf den Tag-Feldern?</summary>
          <div class="faq-a">
            <p>Er zeigt, wie weit die Einheit in dieser Woche ist:</p>
            <p><b>Offener Ring</b> — angefangen, aber die Soll-Sätze fehlen noch.<br>
            <b>Gefüllt (grün)</b> — alle Soll-Sätze des Tages sind eingetragen.<br>
            <b>Kein Punkt</b> — hier steht noch nichts.</p>
            <p>Gezählt wird gegen dasselbe Ziel wie unten in der Volumen-Leiste („X / Y Arbeitssätze") — die beiden können sich also nicht widersprechen. Maßgeblich ist das Level, das du für den Tag gewählt hast.</p>
          </div>
        </details>

        <details class="faq"><summary>Was heißt das kleine Zeichen neben meinem Profilbild?</summary>
          <div class="faq-a"><p>Oben rechts, links neben deinem Profilbild, steht der Sync-Status: <b>✓</b> gespeichert · <b>↻</b> speichert gerade oder noch nicht gesichert · <b>↑</b> auf dem Gerät gesichert, wartet auf Verbindung · <b>⚠</b> Upload fehlgeschlagen. In den letzten beiden Fällen sind deine Daten trotzdem sicher — sie liegen lokal und werden automatisch nachgereicht, sobald wieder Netz da ist.</p></div>
        </details>

        <details class="faq"><summary>Wofür ist das Notizfeld?</summary>
          <div class="faq-a"><p>„+ Notiz" gehört zur Übung und gilt für <b>alle</b> Wochen — gedacht für Einstellungen und Cues, die gleich bleiben: Sitzhöhe, Griffbreite, Fußposition.</p></div>
        </details>

        <details class="faq"><summary>Was passiert nach Woche 6?</summary>
          <div class="faq-a">
            <p>Die App bietet zwei Wege an: <b>„Weitertrainieren · neue Phase"</b> startet direkt wieder in Woche 1; <b>„1 Woche Deload"</b> führt zuerst durch Woche 7 mit reduziertem Cluster-Training.</p>
            <p>Beim Start der neuen Phase werden Übungen, Gewichte, Wdh., RIR und Notizen der abgeschlossenen Phase geleert. Das Level ist für neue Einheiten zunächst auf <b>Level II</b> vorausgewählt und kann weiterhin nach Tagesform geändert werden.</p>
            <p><b>Dein Pump- und Cluster-Übungspool bleibt aber erhalten</b> — siehe unten.</p>
          </div>
        </details>

        <details class="faq"><summary>Was ist der Übungs-Pool?</summary>
          <div class="faq-a">
            <p>Zu jeder Pump- und Cluster-Übung, die du schon einmal gefahren hast, merkt sich die App dauerhaft die zuletzt geschaffte Last — über Phasen hinweg. Wählst du sie in einer späteren Phase wieder, siehst du sofort: <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>, markiert mit <b>Pool</b>.</p>
            <p>Der Pool überlebt „Neue Phase starten" bewusst — genau dafür ist er da. Gelöscht wird er nie.</p>
            <p>Solange die <b>laufende</b> Phase schon Werte zu der Übung hat, gewinnen die: dann steht dort <b>Wo 3</b> statt <b>Pool</b>. Die Wochennummer wäre bei Pool-Werten auch irreführend, weil sie mit jeder Phase wieder bei 1 startet.</p>
          </div>
        </details>

        <p class="faq-sektion">Die Bestandteile</p>

        <details class="faq"><summary>Was heißt Comp und Iso?</summary>
          <div class="faq-a">
            <p><b>Comp</b> steht für <b>Verbundübung</b> (englisch <i>compound</i>): Über der Bewegung arbeiten <b>mehrere Gelenke</b> und damit mehrere Muskeln zusammen. Bankdrücken bewegt Schulter <i>und</i> Ellenbogen, beteiligt sind Brust, vordere Schulter und Trizeps. Hier kannst du am meisten Gewicht bewegen — das ist der Hauptreiz.</p>
            <p><b>Iso</b> steht für <b>Isolationsübung</b>: <b>ein Gelenk</b>, ein Muskel. Fliegende bewegen nur die Schulter, Curls nur den Ellenbogen. Weniger Gewicht, dafür trifft die Arbeit gezielt einen Muskel — auch den, der bei der Verbundübung als erstes ermüdet wäre.</p>
            <p>An den Heavy-Tagen wechseln sich beide ab: <b>Comp → Iso → Comp → Iso</b>. Die Verbundübung liefert die Last, die Isolationsübung füllt auf, was dabei zu kurz kam. Welches Feld gerade welches ist, steht als kleines Schild links neben dem Übungsnamen.</p>
            <p>Die Auswahlliste ist entsprechend gefiltert: Im Comp-Feld erscheinen nur mehrgelenkige Übungen, im Iso-Feld nur eingelenkige.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie trainiere ich die Heavy-Sätze?</summary>
          <div class="faq-a">
            <p>6–12 Wdh., 0–2 RIR (also 0–2 Wiederholungen in Reserve). Im Wechsel <b>Comp → Iso</b>. Versagen nur im <b>letzten Comp-Satz</b>; Iso-Sätze dürfen ans Versagen. Pause: Oberkörper 90 s, Unterkörper 120 s, Waden 60 s.</p>
            <p>Das sind die Sätze, an denen dein Fortschritt gemessen wird — hier lohnt es sich, genau einzutragen.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie trainiere ich die Pump-Sätze?</summary>
          <div class="faq-a">
            <p>15–25 Wdh., leichte Last (~50 % 1RM), Pause 60 s, im Supersatz gekoppelt. Trainiere <b>versagensnah</b>: Die letzten Wiederholungen sollen deutlich anstrengend sein, ohne dass ein besonderer „metabolischer" Mechanismus angenommen werden muss. Übungen frei wählen.</p>
            <p><b>Lengthened Partials sind optional</b>, nicht der vorgeschriebene Abschluss jedes Pump-Satzes. Du kannst sie nach einem passenden Satz einsetzen, wenn saubere volle Wiederholungen nicht mehr möglich sind. Es sind Teilwiederholungen <b>nur im gedehnten Bereich</b>, also dort, wo der Muskel lang und weiterhin belastet ist.</p>
            <p>Das funktioniert nur, wo unten auch Spannung anliegt: Fly-Maschine, Latzug, Beinstrecker, sitzender Beinbeuger, Schrägbank-Curl. Bei KH-Seitheben oder stehenden KH-Curls hängt der Arm unten spannungslos — dort bringt es nichts.</p>
            <p>Nicht zu verwechseln mit der <b>1¼-Wdh.</b> („1/4 Wdh. unten"): volle Wiederholung <i>plus</i> ein Viertel unten, bei jeder Wdh. Verwandtes Prinzip, aber ohne eigene Studienlage.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie funktionieren die Clusters?</summary>
          <div class="faq-a">
            <p>Ein Cluster ist <b>ein Satz, der in sechs Häppchen zerlegt ist</b>: 6 Minisätze à 4 Wdh., dazwischen jeweils nur ~10 s Pause. Zusammen 24 Wiederholungen mit einem Gewicht, das du normalerweise nur etwa 15-mal am Stück schaffen würdest.</p>
            <p>Der Sinn der kurzen Pausen: Sie reichen, um die nächsten vier Wiederholungen sauber zu schaffen, aber nicht, um sich wirklich zu erholen. So sammelst du viele Wiederholungen nahe am Versagen, ohne einen einzigen langen Satz durchzustehen.</p>
            <p><b>Nur ein Versagenspunkt</b>, und zwar im letzten Minisatz. Das ist wichtig: Die Technik ist trotz der hohen Wiederholungszahl vergleichsweise schonend, weil du eben <i>nicht</i> sechsmal ans Limit gehst.</p>
            <p>Gewicht ≈ dein 15RM. Eingetragen wird das Gewicht und die Wiederholungszahl, die du im <b>letzten</b> Minisatz noch geschafft hast. Rechne mit 5–10 min pro Cluster.</p>
          </div>
        </details>

        <details class="faq"><summary>Was bedeuten die Level (I/II/III)?</summary>
          <div class="faq-a"><p><b>Level I</b> = wenig Sätze, schlechter Tag. <b>Level II</b> = Standard und bei einer neuen Phase vorausgewählt. <b>Level III</b> = volles Volumen, guter Tag. Nach Tagesform wählen, nicht nach Ehrgeiz. Das Level gilt je Tag und Woche — du kannst also Montag III und Mittwoch I fahren.</p></div>
        </details>

        <details class="faq"><summary>Wie kommen die Satzzahlen zustande?</summary>
          <div class="faq-a">
            <p>Die Zahl hinter <b>Sätze</b> ist fest in der App hinterlegt und hängt am gewählten Level — du musst nichts selbst rechnen.</p>
            <p><b>Heavy:</b> die Sätze des Muskels werden im Wechsel auf Comp und Iso verteilt. Rücken Level III = 4 → 2 Comp + 2 Iso. Level I = 1 → nur der Comp-Satz, das Iso-Feld bleibt leer.</p>
            <p><b>Pump und Cluster:</b> gekoppelte Übungen sind Supersätze, die Zahl gilt <b>je Übung</b>. Brust/Rücken Level III = 2 heißt also 2 Sätze Brust <i>und</i> 2 Sätze Rücken.</p>
          </div>
        </details>

        <details class="faq"><summary>Was bedeutet die A/B-Woche?</summary>
          <div class="faq-a">
            <p>Die Heavy-Tage wechseln wöchentlich zwischen zwei Übungs-Gruppierungen: <b>A</b> in ungeraden, <b>B</b> in geraden Wochen. So kommt jede Übung alle zwei Wochen wieder — oft genug, um Fortschritt sauber zu vergleichen, aber ohne dass du sechs Wochen lang dieselben vier Übungen machst.</p>
            <p><b>Der Zweck ist auch ein mentaler.</b> Sechs Wochen Overreach sind lang, und das größte Risiko ist nicht die falsche Satzzahl, sondern dass man keine Lust mehr hat. Die A/B-Rotation und die freie Wahl bei Pump und Clustern sorgen dafür, dass jede Einheit etwas anders aussieht — ohne dass die Messgröße darunter leidet: Verglichen wird immer nur A mit A und B mit B.</p>
            <p>Pump und Cluster sind von der Rotation nicht betroffen, die wählst du jedes Mal völlig frei.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie steigere ich mich (Progression)?</summary>
          <div class="faq-a"><p>Doppelte Progression: erst Wdh. ans obere Ende, dann Last hoch (2,5–5 kg), Wdh. zurück. <b>2 Einheiten ohne Fortschritt</b> → Übung tauschen.</p></div>
        </details>

        <p class="faq-sektion">Hintergrund</p>

        <details class="faq"><summary>Soll ich stretchen?</summary>
          <div class="faq-a">
            <p><b>1. Kein Verletzungsschutz.</b> Krafttraining senkt Verletzungen um rund zwei Drittel, Dehnen zeigt keinen günstigen Effekt — die Daten stützen einen Schutzeffekt schlicht nicht.</p>
            <p><b>2. Als Wachstumsreiz zu klein.</b> Aktuelle Meta-Analysen finden triviale bis kleine Effekte (d = 0,12–0,20) — und das nur bei 30–60 Minuten Dehnen pro Tag und Muskel. Neben deinem Heavy-, Pump- und Cluster-Volumen fällt das nicht ins Gewicht.</p>
            <p><b>3. Die Begründung ist überholt.</b> Die alte Begründung fürs Dehnen stützt sich auf GH-Ausschüttung und „metabolischen Stress". Die Hormon-Hypothese gilt seit rund 2010 als widerlegt, metabolischer Stress als eigenständiger Treiber wurde stark zurückgestuft. Heute gilt mechanische Spannung als Haupttreiber.</p>
            <p><b>4. Der gute Kern lebt woanders.</b> Was wirkt, ist Belastung bei <b>langer Muskellänge</b> — über Übungsauswahl und volle ROM in den Arbeitssätzen, nicht über einen 60–90-Sekunden-Halt danach.</p>
            <p><b>5. Beweglichkeit kommt ohnehin.</b> Krafttraining über volle ROM verbessert die Beweglichkeit genauso stark wie dediziertes Dehnen.</p>
            <p><b>Wann Dehnen trotzdem sinnvoll ist:</b> gezielt gegen eine konkrete Einschränkung, die deine Technik verschlechtert — verkürzte Hüftbeuger oder Brust vom Sitzen etwa. Das ist ein Technik-Argument, kein Gelenk-Argument, und es ist das stärkste Argument fürs Dehnen. Vor dem Heben kurz und dynamisch halten; langes statisches Dehnen (über 60 s) senkt die Kraft kurzfristig.</p>
          </div>
        </details>

        <p class="src">Evidenz: Pelland et al. 2025 · Baz-Valle et al. 2022 · Schoenfeld et al. 2021 · Wolf/Schoenfeld 2025 · Bell et al. 2023 (Deload).</p>
`;
  container.appendChild(wrap);
}
