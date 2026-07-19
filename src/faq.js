// Das FAQ-Sheet.
//
// Bewusst ein eigenes Modul und nicht Teil des Logs: Der FAQ-Knopf sitzt in der
// Kopfleiste und muss aus jeder Ansicht funktionieren – auch aus Profil und
// Admin, wo gar kein Log gemountet ist.
//
// Reihenfolge: vom Grossen zum Kleinen. Erst was die App ueberhaupt ist und wie
// die Woche aussieht, dann die Bedienung, dann die einzelnen Satzarten, zuletzt
// Hintergrund. Wer zum ersten Mal aufmacht, liest von oben und versteht mit
// jedem Eintrag mehr – statt bei "Wie trainiere ich die Heavy-Saetze?" zu
// starten, ohne zu wissen, was Heavy ist.
let sheet = null;
let onClose = null;

function hide() {
  if (sheet) sheet.hidden = true;
  if (onClose) { onClose(); onClose = null; }
}

function build() {
  sheet = document.createElement('div');
  sheet.className = 'sheet'; sheet.hidden = true;
  sheet.innerHTML = `
      <div class="sheet-in">
        <div class="sheet-hd"><h2>FAQ</h2><button class="sp-x" id="faq-x" aria-label="schließen">×</button></div>

        <p class="faq-sektion">LOGMAN und das Prinzip</p>

        <details class="faq"><summary>Was ist LOGMAN?</summary>
          <div class="faq-a">
            <p>Ein <b>Trainingstagebuch für ein bestimmtes System</b> — keine allgemeine Fitness-App. LOGMAN kennt den Plan bereits: Es weiß, welche Tage es gibt, welche Muskelgruppen wann drankommen und wie viele Sätze bei welchem Level fällig sind. Du trägst nur noch Gewicht und Wiederholungen ein.</p>
            <p>Alles, was die App darüber hinaus tut, dient einer einzigen Frage: <b>Wirst du stärker?</b> Deshalb steht über jeder Heavy-Übung, was du beim letzten Mal geschafft hast, und im Profil eine Kurve deiner Entwicklung.</p>
            <p>Die App läuft auch <b>ohne Empfang</b>. Was du eintippst, liegt sofort auf dem Gerät; hochgeladen wird, sobald wieder Netz da ist. Im Keller-Studio kannst du also normal weiterarbeiten.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie sieht die Trainingswoche aus?</summary>
          <div class="faq-a">
            <p><b>Drei Einheiten pro Woche</b>, jede mit einem anderen Schwerpunkt:</p>
            <p><b>Tag 1 — Oberkörper schwer, Unterkörper leicht.</b> Oben die harten Sätze, unten Durchblutungsarbeit.<br>
            <b>Tag 2 — genau umgekehrt.</b> Unterkörper schwer, Oberkörper leicht.<br>
            <b>Tag 3 — Clusters für den ganzen Körper.</b> Kurze, dichte Sätze.</p>
            <p>Jeder Muskel wird so <b>dreimal pro Woche</b> berührt — einmal schwer, einmal leicht, einmal als Cluster. Das ist der Kerngedanke: nicht ein großer Reiz pro Woche, sondern drei verschiedene.</p>
            <p>Darüber liegt ein größerer Rhythmus: <b>6 Wochen Overreach, dann 2 Wochen Deload.</b> Mehr dazu weiter unten.</p>
          </div>
        </details>

        <details class="faq"><summary>Worauf kommt es beim Training an?</summary>
          <div class="faq-a">
            <p><b>1. Progressive Überlastung</b> — mehr Last oder mehr Wdh. gegenüber dem letzten Mal. Steht als Delta über jeder Heavy-Übung.</p>
            <p><b>2. Nähe zum Versagen</b> — der Reizauslöser pro Satz. Ein Satz, bei dem noch fünf Wdh. drin gewesen wären, zählt kaum.</p>
            <p><b>3. Erholung</b> — Schlaf, Protein, Stress. Das Fundament, ohne das die ersten beiden nichts bringen.</p>
            <p>Das <b>Volumen</b> (Anzahl Sätze) ist der Dosis-Regler darüber. Man liest oft „10–20 Sätze pro Muskel und Woche" — diese Zahl stammt aber überwiegend aus Studien, in denen die Sätze <i>nicht</i> bis zum Versagen gingen. Hier gehen sie das, und dazu kommen Techniken wie Lengthened Partials und Clusters. Ein Satz ist also nicht gleich ein Satz, und die Zahl lässt sich nicht 1:1 übertragen. Genau deshalb zeigt das Set-O-Meter bewusst <b>keinen Zielwert</b>.</p>
            <p>Muskelkater ist übrigens kein Maß für irgendetwas.</p>
          </div>
        </details>

        <details class="faq"><summary>Was ist Overreach und Deload?</summary>
          <div class="faq-a">
            <p><b>Overreach</b> = 6 Wochen progressiv (Level steigend): bewusst etwas mehr, als du dauerhaft wegstecken würdest. Am Ende fühlst du dich platt — das ist kein Fehler, sondern der Plan.</p>
            <p><b>Deload</b> = 2 Wochen danach: Volumen und Frequenz runter, nur Clusters. <b>Erst hier kommt der Zugewinn an</b> — der Körper holt nicht nur auf, sondern legt drauf. Ohne diese zwei Wochen wäre der Overreach nur Erschöpfung.</p>
            <p><b>Warum dann ausgerechnet Clusters?</b> Weil im Deload das <b>Volumen</b> fallen soll, der <b>Reiz</b> aber nicht. Genau das ist der Befund der Deload-Forschung: Volumen und Frequenz darf man deutlich senken — solange die Intensität oben bleibt, bleibt die Anpassung erhalten, statt abzubauen. Ein Cluster liefert genau das in kompakter Form: wenig Gesamtvolumen, aber ein echter Versagenspunkt im letzten Minisatz. Du erholst dich, ohne den Faden zu verlieren.</p>
          </div>
        </details>

        <p class="faq-sektion">Die App bedienen</p>

        <details class="faq"><summary>Wie benutze ich die App?</summary>
          <div class="faq-a">
            <p><b>1. Woche und Tag wählen.</b> Ganz oben stellst du die Woche ein, darunter den Tag. Die Chips daneben zeigen, ob A- oder B-Woche und ob Overreach oder Deload.</p>
            <p><b>2. Level nach Tagesform wählen.</b> I, II oder III. Danach richtet sich, wie viele Sätze heute fällig sind — nicht nach Ehrgeiz, sondern danach, wie du dich fühlst.</p>
            <p><b>3. Übungen auswählen.</b> Jedes Feld bietet dir nur Übungen an, die zu diesem Block passen. Bei Heavy stehen sie nach der ersten Wahl dauerhaft; Pump und Cluster wählst du jede Woche neu.</p>
            <p><b>4. Eintragen.</b> Gewicht und Wiederholungen je Satz. Über der Übung siehst du die Werte vom letzten Mal, damit du weißt, was du schlagen musst. Der Pausentimer startet über den Chip mit der Uhr.</p>
            <p><b>5. Zwischendurch ins Set-O-Meter schauen</b> (der Knopf unten rechts), um zu sehen, welche Muskeln diese Woche zu kurz kommen — und die freien Pump- und Cluster-Übungen danach auszuwählen.</p>
            <p>Gespeichert wird nach jeder Eingabe automatisch. Den Knopf „Einheit speichern" brauchst du nur, wenn du sofort sichern willst.</p>
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
            <p>Wie viel Arbeit jeder Muskel <b>in dieser Woche</b> abbekommt — als Balken, absteigend sortiert. Zu öffnen über den fliederfarbenen Knopf neben „Einheit speichern", aus jeder Scroll-Position.</p>
            <p><b>Gezählt wird der Plan, nicht das Eingetragene.</b> Sobald eine Übung gewählt ist, zählen die Sätze, die Level und Vorlage dafür vorsehen. Deshalb steht das Bild schon, <i>bevor</i> du trainiert hast — und genau dann nützt es: Du siehst, was deine Heavy-Wahl liefert, und wählst Pump und Cluster gegen die Lücken.</p>
            <p><b>Ein Satz zählt für den Hauptspieler ganz, für die Nebenspieler halb.</b> Ein Satz Rudern ist ein voller Satz für den oberen Rücken und ein halber für Bizeps und Lat. Zwei halbe ergeben einen — deshalb wird das nicht getrennt ausgewiesen.</p>
            <p><b>Es gibt keinen Zielwert und keine Warnung</b>, und das ist Absicht. Das Meter vergleicht die Muskeln nur untereinander. Ob dir auffällt, dass die Waden einen längeren Balken haben als die Brust, und ob dich das stört, ist deine Entscheidung — nicht die der App.</p>
            <p>Ein Cluster zählt dabei als <b>ein</b> Satz.</p>
          </div>
        </details>

        <details class="faq"><summary>Wie merkt sich die App meine Übungen und Gewichte?</summary>
          <div class="faq-a">
            <p><b>Heavy-Übungen</b> gehören fest zum Tag: einmal gewählt, stehen sie in jeder Woche derselben A/B-Woche wieder da. Darunter siehst du <i>„Wo 3: 80×8, 80×7"</i> — die Werte vom letzten Mal, plus <b>▲ gesteigert</b> / <b>= gehalten</b> / <b>▼ gesunken</b>, sobald du heute etwas einträgst.</p>
            <p><b>Pump- und Cluster-Übungen</b> rotierst du frei. Sie hängen deshalb nicht am Tag, sondern <b>am Namen</b>: Wählst du dieselbe Übung irgendwann wieder — egal an welchem Tag oder in welcher Woche — erscheint automatisch <i>„zuletzt: 30 kg × 18 Wdh · Wo 3"</i> bzw. beim Cluster <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>.</p>
            <p>Bei Pump und Cluster gibt es bewusst <b>kein</b> ▲/▼-Delta: Diese Sätze sind nicht zum Messen von Fortschritt gedacht — der Wert dient nur als Anhaltspunkt fürs Einstellen. Gemessen wird an den Heavy-Sätzen.</p>
          </div>
        </details>

        <details class="faq"><summary>Kann ich zusätzliche Sätze machen?</summary>
          <div class="faq-a">
            <p>Bei <b>Pump</b> ja: Unter den Satzzeilen steht „+ Satz". Damit holst du dir gezielt mehr Volumen für einen Muskel, der im Set-O-Meter zu kurz kommt.</p>
            <p><b>Heavy und Cluster bleiben fest.</b> Heavy ist die Messlatte deiner Progression — Sätze dort zu verändern macht den Vergleich über die Wochen unsauber. Und ein schwerer Satz kostet deutlich mehr Erholung als ein Pump-Satz. Deshalb ist Pump die richtige Stelle, um nachzulegen.</p>
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

        <details class="faq"><summary>Was heißt das Zeichen oben rechts?</summary>
          <div class="faq-a"><p>Der Sync-Status: <b>✓</b> gespeichert · <b>↻</b> speichert gerade oder noch nicht gesichert · <b>↑</b> auf dem Gerät gesichert, wartet auf Verbindung · <b>⚠</b> Upload fehlgeschlagen. In den letzten beiden Fällen sind deine Daten trotzdem sicher — sie liegen lokal und werden automatisch nachgereicht.</p></div>
        </details>

        <details class="faq"><summary>Wofür ist das Notizfeld?</summary>
          <div class="faq-a"><p>„+ Notiz" gehört zur Übung und gilt für <b>alle</b> Wochen — gedacht für Einstellungen und Cues, die gleich bleiben: Sitzhöhe, Griffbreite, Fußposition.</p></div>
        </details>

        <details class="faq"><summary>Was macht der Button in Woche 8?</summary>
          <div class="faq-a">
            <p>„🔄 Neue Phase starten" leert alle eingetragenen Daten und setzt dich zurück auf Woche 1: Übungen, Gewichte, Wdh., RIR und Notizen. Gedacht für den Start einer komplett neuen Overreach-Phase.</p>
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
            <p>15–25 Wdh., leichte Last (~50 % 1RM), Pause 60 s, im Supersatz gekoppelt. Bis zum <b>metabolischen Versagen</b>, dann <b>Lengthened Partials</b>. Übungen frei wählen.</p>
            <p><b>Lengthened Partials</b> sind Teilwiederholungen <b>nur im gedehnten Bereich</b> — du kommst nicht mehr in die volle Kontraktion, sondern arbeitest weiter dort, wo der Muskel am längsten ist. Genau diese Position treibt das Wachstum überproportional; Teilwdh. dort erzielen ähnliche Anpassungen wie volle Wiederholungen.</p>
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
          <div class="faq-a"><p><b>Level I</b> = wenig Sätze, schlechter Tag. <b>Level III</b> = volles Volumen, guter Tag. Nach Tagesform wählen, nicht nach Ehrgeiz. Das Level gilt je Tag und Woche — du kannst also Montag III und Mittwoch I fahren.</p></div>
        </details>

        <details class="faq"><summary>Wie kommen die Satzzahlen zustande?</summary>
          <div class="faq-a">
            <p>Die Zahl hinter <b>Sätze</b> ist fest in der App hinterlegt und hängt am gewählten Level — du musst nichts selbst rechnen.</p>
            <p><b>Heavy:</b> die Sätze des Muskels werden im Wechsel auf Comp und Iso verteilt. Rücken Level III = 4 → 2 Comp + 2 Iso. Level I = 1 → nur der Comp-Satz, das Iso-Feld bleibt leer.</p>
            <p><b>Pump und Cluster:</b> gekoppelte Übungen sind Supersätze, die Zahl gilt <b>je Übung</b>. Brust/Rücken Level III = 2 heißt also 2 Sätze Brust <i>und</i> 2 Sätze Rücken.</p>
          </div>
        </details>

        <details class="faq"><summary>Was bedeutet die A/B-Woche?</summary>
          <div class="faq-a"><p>Die Heavy-Tage wechseln wöchentlich zwischen zwei Übungs-Gruppierungen: <b>A</b> in ungeraden, <b>B</b> in geraden Wochen. So kommt jede Übung alle zwei Wochen wieder — oft genug, um Fortschritt sauber zu vergleichen, aber mit genug Abwechslung. Pump und Cluster sind davon nicht betroffen, die wählst du jedes Mal frei.</p></div>
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
      </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector('#faq-x').onclick = hide;
  sheet.onclick = (e) => { if (e.target === sheet) hide(); };
}

// cb laeuft, wenn das Sheet zugeht – damit der Knopf seine Markierung verliert.
export function openFaq(cb) {
  if (!sheet) build();
  onClose = cb || null;
  sheet.hidden = false;
}
