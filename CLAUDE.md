# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Befehle

```bash
npm install
npm run dev          # Vite auf http://localhost:5173 (Service Worker ist im Dev aktiv!)
npm run build        # nach dist/
npm run preview
npm test             # vitest run
npm run test:watch
npx vitest run src/progression.test.js            # eine Datei
npx vitest run -t "nimmt pro Woche den besten Satz" # ein Test
node scripts/gen-icons.mjs                        # App-Icons neu rastern (@resvg/resvg-js)
```

`.env.local` aus `.env.example` anlegen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
Ohne die Werte startet die App nicht. Deployment läuft automatisch per
`.github/workflows/deploy.yml` auf GitHub Pages; die Env-Werte kommen dort aus
Repository-Secrets. Der Nutzer pusht selbst über GitHub Desktop.

## Namensstand

Die App heißt **LOGMAN**. Das Repo, der `package.json`-Name, die localStorage-Präfixe
(`blast:*`) und Teile der `README.md` tragen noch den alten Namen *BLAST Trainer* —
das ist bekannt und bewusst nicht umbenannt worden (Speicher-Schlüssel zu ändern würde
lokale Daten wegwerfen). Die `README.md` ist an mehreren Stellen veraltet (alte
Marken- und Tier-Begriffe, Test-Accounts); im Zweifel gilt der Code.

Anzeige-Begriffe und interne Keys gehen auseinander und müssen es bleiben:

| intern (nie ändern) | Anzeige |
|---|---|
| `type: 'load'` | HEAVY |
| `type: 'pump'` | PUMP |
| `type: 'mr'` | CLUSTER |
| `tier` | LEVEL I/II/III |
| Wochen 1–6 / 7–8 | Overreach / Deload |

Die internen Keys stecken in gespeicherten Payloads von Nutzern. Ein Rename dort
macht bestehende Logs ungültig.

## Architektur

**Vanilla JS, kein Framework.** Views sind `mount*(container, opts)`-Funktionen, die
DOM bauen und optional `{ destroy }` zurückgeben. `main.js` ist Shell + Hash-Router
(`#log`, `#profile`, `#admin`) und ruft `cleanupActive()` vor jedem Wechsel; ein
`routeToken` verwirft veraltete async-Mounts.

**Das ganze Trainings-Log ist eine einzige jsonb-Zeile.** `training_logs` hat genau
eine Zeile pro Nutzer, das `payload` enthält alles:

```
payload = { week, day, data[Tag][Woche][BlockId], ex[Tag][BlockId][], notes, tier, rot, mem, v:3 }
```

Es gibt keine Tabelle pro Satz. Wer eine neue Auswertung baut, liest dieses eine
Payload und rechnet in einem reinen Modul (siehe `progression.js`).

**Local-first.** `localstore.js` schreibt jede Änderung synchron nach localStorage
und markiert sie `dirty`; der Server ist die Sicherungskopie, nicht die Voraussetzung.
Beim Laden wird nur zusammengeführt, wenn lokal `dirty` liegt — `mergePayload()`
merged **pro Block**, nicht als Ganzes. Entscheidendes Detail: Die App legt beim
bloßen Ansehen eines Tages leere Blöcke an, deshalb gewinnt lokal nur, wenn dort
tatsächlich Daten stehen (`blockHasData`). Das `replace`-Flag umgeht den Merge nach
„Neue Phase starten" — Leeren ist eine Absicht, kein fehlender Stand.

**Template-getrieben.** `template.js` (`TPL`) beschreibt Tage → Blöcke → Sätze je
Level. `log.js` rendert daraus; die Ableitungen (wie viele Sätze auf welche Übung,
welcher Typ bei welchem Level) stehen in `saetze.js`. Änderungen am Trainingsplan
gehören nach `template.js`, nicht in Render-Code. `LEGACY` mappt alte index-basierte
Payloads auf Block-IDs — beim Umbenennen von Block-IDs mitziehen.

**Reine Module sind absichtlich vom DOM und von Supabase getrennt**, weil ihre Fehler
stumm bleiben (ein falscher Vorschlag, eine falsche Kurve — nichts bricht sichtbar):
`saetze.js`, `pool.js`, `progression.js`, `localstore.js`, `kurve.js`. Nur diese
haben Tests. Neue Rechenlogik gehört in so ein Modul, nicht in eine Mount-Funktion.

**PWA.** Eigener Service Worker (`src/sw.js`, `injectManifest` — ein generierter
würde ihn ersetzen). Er precacht **nur App-Dateien**; für Supabase-Aufrufe gibt es
bewusst *keine* Route, sonst bekäme man alte Gewichte serviert. Registriert wird in
`push.js` beim App-Start, bewusst an keiner Oberfläche hängend. `notificationclick`
schickt `postMessage` an das Fenster statt `client.navigate()` (in WebKit unzuverlässig).
Die Version aus `__BUILD_COMMIT__`/`__BUILD_TIME__` steht im Profil, weil man sonst
bei jedem Fehler rät, ob Code oder Cache schuld ist.

**Push (iOS).** Nur aus einer Homescreen-App heraus; die Erlaubnis darf nur aus einem
echten Tipp gefragt werden — daher die einmalige `pushbar`. Abos sterben mit dem
Löschen der App vom Homescreen, und **Apple quittiert tote Endpunkte trotzdem mit
201**; deshalb wird bei jedem Start `abonniereStill()` aufgerufen und ein Cron räumt
alte Zeilen weg.

## Backend

`supabase/` ist die versionierte **Kopie** des Cloud-Projekts (`bjtnpmselziqpwnthukj`),
nicht die Quelle. Migrationen sind 1:1 aus `schema_migrations` gezogen: nur anhängen,
nie bestehende editieren. Zwei Edge Functions (Deno): `pausentimer` (im Namen des
Aufrufers, RLS greift) und `faltenwecker` (pg_cron, service_role, weist sich per
Vault-Token aus).

Schutz ist ausschließlich RLS. `VITE_SUPABASE_URL`, der `sb_publishable_`-Key und
`VAPID_PUBLIC` stehen absichtlich im Klartext im Code. Dieses Projekt nutzt das
**neue** Key-Format — ein Legacy-`service_role`-JWT wird vom Gateway abgelehnt.
Edge Functions nehmen den plattformseitig injizierten Key, nichts aus Vault.

## Konventionen

- **Kommentare sind deutsch und erklären das *Warum*, nicht das Was** — meist einen
  konkreten Fehlschlag aus der Projektgeschichte („Ohne das kam die Push jeden Tag
  wieder"). Beim Ändern von Code den zugehörigen Kommentar mitpflegen; er ist oft die
  einzige Aufzeichnung der Entscheidung.
- Neuere Module verwenden deutsche Bezeichner (`heavyReihen`, `verlauf`, `zeichne`),
  ältere englische. Innerhalb einer Datei konsistent bleiben.
- Kein CSS-Framework, keine Chart-Bibliothek: `styles.css` ist das komplette
  Designsystem (Themes `retro`/`dark` über `data-theme`), `kurve.js` das komplette
  Diagramm.
- Der Nutzer will **vor jeder Änderung gefragt werden**.

## Was hier nicht (mehr) liegt

`templates/koerperwerte/` ist eine mitnehmbare Kopie der Hautfalten-/Gewichts-Boxen
für eine spätere Ernährungs-App. Sie sind aus LOGMAN entfernt (Körperdaten, kein
Trainings-Log), das Backend dazu läuft aber noch. Nicht wieder einbauen.
