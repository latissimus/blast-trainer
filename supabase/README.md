# Supabase-Backend

Das Backend lebt im Supabase-Projekt `blast-log` (`bjtnpmselziqpwnthukj`). Dieser
Ordner ist die im Repo versionierte Kopie davon – damit es einen Verlauf gibt und
das Schema nicht nur in der Cloud existiert.

## `migrations/`

Die Migrationen werden in zeitlicher Reihenfolge angewendet. Bereits ausgeführte
Migrationen bleiben als ehrlicher Verlauf erhalten; entfernte Funktionen werden
deshalb durch eine spätere Löschmigration aufgehoben statt rückwirkend aus der
Historie gestrichen.

## `functions/`

Die Edge Function (Deno):

- **`pausentimer`** – schläft im Hintergrund und schickt nach Ablauf der Pause
  eine Push. Arbeitet im Namen des Aufrufers (RLS greift), `verify_jwt: true`.

## Was hier NICHT liegt

Geheimnisse. Bewusst nicht im Repo:

- `VAPID_PRIVATE_KEY` – als Function-Secret in Supabase hinterlegt.

Der `VAPID_PUBLIC`-Key und der `sb_publishable_`-Key stehen im Klartext im Code –
das ist Absicht, beide sind öffentlich by design.

## Wiederherstellen

Bei einem leeren Projekt: Migrationen der Reihenfolge nach anwenden, Functions
deployen und danach das VAPID-Paar neu setzen. Storage-Objekte (Profilbilder)
sind NICHT in den Migrationen enthalten – die liegen im `avatars`-Bucket und
bräuchten einen eigenen Export.
