// Das FAQ-Sheet.
//
// Bewusst ein eigenes Modul und nicht Teil des Logs: Der FAQ-Knopf sitzt in der
// Kopfleiste und muss aus jeder Ansicht funktionieren – auch aus Profil und
// Admin, wo gar kein Log gemountet ist.
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
        <details class="faq"><summary>Worauf kommt es beim Training an?</summary>
          <div class="faq-a">
            <p><b>1. Progressive Überlastung</b> — mehr Last oder mehr Wdh. gegenüber dem letzten Mal. Steht als Delta über jeder Übung.</p>
            <p><b>2. Nähe zum Versagen</b> — 0–3 RIR. Der Reizauslöser pro Satz.</p>
            <p><b>3. Erholung</b> — Schlaf, Protein, Stress. Das Fundament.</p>
            <p>Volumen ist der Dosis-Regler (~10–20 Sätze/Muskel/Woche). Frequenz verteilt nur — 2–3×/Muskel. Kater ist kein Maß.</p>
          </div>
        </details>
        <details class="faq"><summary>Wie trainiere ich die Heavy-Sätze?</summary>
          <div class="faq-a"><p>6–12 Wdh., 0–2 RIR. Im Wechsel: <b>Comp → Iso → Comp → Iso</b>. Versagen nur im <b>letzten Comp-Satz</b>; Iso-Sätze dürfen ans Versagen. Pause: Oberkörper 90 s, Unterkörper 120 s, Waden 60 s.</p></div>
        </details>
        <details class="faq"><summary>Wie trainiere ich die Pump-Sätze?</summary>
          <div class="faq-a">
            <p>15–25 Wdh., leichte Last (~50 % 1RM), Pause 60 s, im Supersatz gekoppelt. Bis zum <b>metabolischen Versagen</b>, dann <b>Lengthened Partials</b>. Übungen frei rotieren.</p>
            <p><b>Lengthened Partials</b> sind Teilwiederholungen <b>nur im gedehnten Bereich</b> — du kommst nicht mehr in die volle Kontraktion, sondern arbeitest weiter dort, wo der Muskel am längsten ist. Genau diese Position treibt das Wachstum überproportional; Teilwdh. dort erzielen ähnliche Anpassungen wie volle Wiederholungen.</p>
            <p>Das funktioniert nur, wo unten auch Spannung anliegt: Fly-Maschine, Latzug, Beinstrecker, sitzender Beinbeuger, Schrägbank-Curl. Bei KH-Seitheben oder stehenden KH-Curls hängt der Arm unten spannungslos — dort bringt es nichts.</p>
            <p>Nicht zu verwechseln mit der <b>1¼-Wdh.</b> („1/4 Wdh. unten"): volle Wiederholung <i>plus</i> ein Viertel unten, bei jeder Wdh. Verwandtes Prinzip, aber ohne eigene Studienlage.</p>
          </div>
        </details>
        <details class="faq"><summary>Wie funktionieren die Clusters?</summary>
          <div class="faq-a"><p>6 Minisätze à 4 Wdh., ~10 s Pause, 5–10 min pro Round. Gewicht ≈ 15RM. <b>Nur ein Versagenspunkt</b>, im letzten Minisatz.</p></div>
        </details>
        <details class="faq"><summary>Was bedeuten die Level (I/II/III)?</summary>
          <div class="faq-a"><p><b>Level I</b> = wenig Sätze, schlechter Tag. <b>Level III</b> = volles Volumen, guter Tag. Nach Tagesform wählen, nicht nach Ehrgeiz.</p></div>
        </details>
        <details class="faq"><summary>Wie steigere ich mich (Progression)?</summary>
          <div class="faq-a"><p>Doppelte Progression: erst Wdh. ans obere Ende, dann Last hoch (2,5–5 kg), Wdh. zurück. <b>2 Einheiten ohne Fortschritt</b> → Übung tauschen.</p></div>
        </details>
        <details class="faq"><summary>Was ist Overreach und Deload?</summary>
          <div class="faq-a">
            <p><b>Overreach</b> = 6 Wochen progressiv (Level steigend): bewusst etwas mehr, als du dauerhaft wegstecken würdest. Am Ende fühlst du dich platt — das ist kein Fehler, sondern der Plan.</p>
            <p><b>Deload</b> = 2 Wochen danach: Volumen und Frequenz runter, nur Clusters. <b>Erst hier kommt der Zugewinn an</b> — der Körper holt nicht nur auf, sondern legt drauf. Ohne diese zwei Wochen wäre der Overreach nur Erschöpfung.</p>
          </div>
        </details>
        <details class="faq"><summary>Wie merkt sich die App meine Übungen und Gewichte?</summary>
          <div class="faq-a">
            <p><b>Heavy-Übungen</b> gehören fest zum Tag: einmal eingetragen, stehen sie in jeder Woche derselben A/B-Woche wieder da. Darunter siehst du <i>„Wo 3: 80×8, 80×7"</i> — die Werte vom letzten Mal, plus <b>▲ gesteigert</b> / <b>= gehalten</b> / <b>▼ gesunken</b>, sobald du heute etwas einträgst.</p>
            <p><b>Pump- und Cluster-Übungen</b> rotierst du frei. Sie hängen deshalb nicht am Tag, sondern <b>am Namen</b>: Trägst du dieselbe Übung irgendwann wieder ein — egal an welchem Tag oder in welcher Woche — erscheint automatisch <i>„zuletzt: 30 kg × 18 Wdh · Wo 3"</i> bzw. beim Cluster <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>.</p>
            <p>Der Name muss dafür gleich geschrieben sein — Groß-/Kleinschreibung und Leerzeichen am Rand sind egal, aber <i>„Beinstrecker"</i> und <i>„Beinstrecker Maschine"</i> gelten als zwei verschiedene Übungen.</p>
            <p>Bei Pump und Cluster gibt es bewusst <b>kein</b> ▲/▼-Delta: Diese Sätze sind nicht zum Progressions-Tracking gedacht — der Wert dient nur als Anhaltspunkt fürs Einstellen.</p>
          </div>
        </details>
        <details class="faq"><summary>Was bedeutet die A/B-Woche?</summary>
          <div class="faq-a"><p>Die Heavy-Tage wechseln wöchentlich zwischen zwei Übungs-Gruppierungen: <b>A</b> in ungeraden, <b>B</b> in geraden Wochen. So kommt jede Übung alle zwei Wochen wieder — oft genug, um Fortschritt sauber zu vergleichen. Pump und Cluster sind davon nicht betroffen, die wählst du jedes Mal frei.</p></div>
        </details>
        <details class="faq"><summary>Wie kommen die Satzzahlen zustande?</summary>
          <div class="faq-a">
            <p>Die Zahl hinter <b>Sätze</b> ist fest in der App hinterlegt und hängt am gewählten Level — du musst nichts selbst rechnen.</p>
            <p><b>Heavy:</b> die Sätze des Muskels werden im Wechsel auf Comp und Iso verteilt. Rücken Level III = 4 → 2 Comp + 2 Iso. Level I = 1 → nur der Comp-Satz, das Iso-Feld bleibt leer.</p>
            <p><b>Pump und Cluster:</b> gekoppelte Übungen sind Supersätze, die Zahl gilt <b>je Übung</b>. Brust/Rücken Level III = 2 heißt also 2 Sätze Brust <i>und</i> 2 Sätze Rücken.</p>
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
          <div class="faq-a"><p>Oben rechts in der Wochen-Leiste steht der Sync-Status: <b>✓</b> gespeichert · <b>↻</b> speichert gerade oder noch nicht gesichert · <b>⚠</b> Fehler, nicht gespeichert. Die App speichert nach jeder Eingabe von selbst — „Einheit speichern" unten ist nur da, wenn du sofort sichern willst.</p></div>
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
            <p>Deine Pump- und Cluster-Übungen sammeln sich dauerhaft an — über Phasen hinweg. Wählst du in der nächsten Overreach-Phase wieder eine Übung, die du früher schon mal gemacht hast, siehst du sofort, was du damals geschafft hast: <i>„zuletzt: 40 kg · 3 Wdh. im letzten Cluster"</i>, markiert mit <b>Pool</b>.</p>
            <p>Der Pool überlebt „Neue Phase starten" bewusst — genau dafür ist er da. Gelöscht wird er nie.</p>
            <p>Solange die <b>laufende</b> Phase schon Werte zu der Übung hat, gewinnen die: dann steht dort <b>Wo 3</b> statt <b>Pool</b>. Die Wochennummer wäre bei Pool-Werten auch irreführend, weil sie mit jeder Phase wieder bei 1 startet.</p>
          </div>
        </details>
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
        <p class="src">Evidenz: Pelland et al. 2025 · Baz-Valle et al. 2022 · Schoenfeld et al. 2021 · Wolf/Schoenfeld 2025.</p>
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
