# LOGMAN

Offline-faehiges Trainingslog fuer den rollierenden LOGMAN-Split mit HEAVYS,
MIDDLES, PUMPS, CYCLES und Set-O-Meter. Das Frontend besteht aus Vite und
Vanilla JavaScript; Authentifizierung, Synchronisation und Push-Dienste laufen
ueber Supabase. Veröffentlicht wird die PWA ueber GitHub Pages.

## Grundsaetze

- Das Training wird bei jeder Eingabe zuerst lokal gespeichert.
- Die App-Huelle und statischen Dateien stehen ueber den Service Worker offline bereit.
- Supabase synchronisiert im Hintergrund; langsame Requests haben ein Zeitlimit.
- Row-Level Security trennt Kundendaten. Kunden koennen nur ihre eigenen Daten lesen und aendern.
- Es gibt keinen Adminzugang innerhalb der App. Feedback wird im geschuetzten
  Supabase-Projekt bearbeitet.

## Lokal starten

1. `npm ci`
2. `.env.local` aus `.env.example` anlegen und die Werte des eigenen Supabase-Projekts eintragen.
3. `npm run dev`

Vor einem Release:

```sh
npm test
npm run build
npm audit --omit=dev
```

Der Publishable-/Anon-Key ist in einer Browser-App oeffentlich. Der Schutz liegt
in den RLS-Regeln. Ein `service_role`-Key darf niemals in einer `VITE_`-Variable,
im Frontend oder im Repository stehen.

## Supabase einrichten

Die SQL-Dateien unter `supabase/migrations/` in zeitlicher Reihenfolge anwenden
und die Edge Functions deployen. Fuer Push-Benachrichtigungen werden mindestens
`VAPID_PRIVATE_KEY` und `VAPID_CONTACT` als Function-Secrets benoetigt.

E-Mail-Bestaetigung sollte in Produktion aktiviert bleiben. Fuer einen
zuverlaessigen Versand ein eigenes SMTP-Konto konfigurieren und unter
Authentication → URL Configuration die Live-Domain als Site URL und Redirect
URL eintragen.

## Deployment

Der Workflow `.github/workflows/deploy.yml` fuehrt bei jedem Push auf `main`
zuerst alle Tests und danach den Produktionsbuild aus. Erst ein erfolgreicher
Build wird zu GitHub Pages ausgeliefert. Folgende Repository-Secrets werden
benoetigt:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

GitHub Pages muss als Quelle „GitHub Actions“ verwenden. Edge Functions und
Migrationen sind davon getrennt und muessen ueber Supabase ausgerollt werden.

## Datenmodell

- `profiles`: Name, E-Mail und komprimiertes Profilbild
- `training_logs`: ein JSON-Trainingsstand je Nutzer
- `notizen` und privater Storage-Bucket `notizbuch`: persoenliche Notizen und Bilder
- `feedback`: Kundenfeedback fuer die Bearbeitung im geschuetzten Backend
- `push_subscriptions`, `rest_timers`, `push_versuche`: Push- und Pausentimer-Infrastruktur

Alle nutzerbezogenen Tabellen verwenden RLS. Das Profilbild wird vor dem
Speichern im Browser verkleinert und als Data-URL im eigenen Profil hinterlegt.

## Wichtige Dateien

```text
src/main.js              App-Shell, Routing und Sitzung
src/log.js               Trainingslog und lokale Eingaben
src/template.js          Trainingsvorlage
src/meter.js             Set-O-Meter
src/localstore.js         lokaler Offline-Spiegel
src/trainingssync.js      geordnete Hintergrund-Synchronisation
src/sw.js                 Offline-Cache, Push und Updates
supabase/functions/       serverseitige Funktionen
supabase/migrations/      Datenbank und RLS
```

Testzugänge, Passwoerter und private Schluessel gehoeren nicht in diese Datei
oder in Git. Vor einer oeffentlichen Freigabe alle frueher verwendeten
Testkonten loeschen und bekannte Passwoerter rotieren.
