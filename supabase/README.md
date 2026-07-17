# Supabase-Backend

Das Backend lebt im Supabase-Projekt `blast-log` (`bjtnpmselziqpwnthukj`). Dieser
Ordner ist die im Repo versionierte Kopie davon – damit es einen Verlauf gibt und
das Schema nicht nur in der Cloud existiert.

## `migrations/`

Die zehn Migrationen in der Reihenfolge, in der sie angewendet wurden. Sie sind
1:1 aus `supabase_migrations.schema_migrations` gezogen. Reihenfolge zählt: Jede
baut auf der vorigen auf.

Zwei Migrationen betreffen denselben Cron-Job: `faltenwecker_cron` war der erste
Anlauf mit einem ungültigen Legacy-Key, `faltenwecker_cron_v2` setzt ihn korrekt
neu auf. Beide bleiben erhalten, damit der Verlauf ehrlich ist.

## `functions/`

Die beiden Edge Functions (Deno):

- **`pausentimer`** – schläft im Hintergrund und schickt nach Ablauf der Pause
  eine Push. Arbeitet im Namen des Aufrufers (RLS greift), `verify_jwt: true`.
- **`faltenwecker`** – wird viertelstündlich von pg_cron angestoßen, prüft, wer
  zur Faltenmessung dran ist, und schickt die Erinnerung. Läuft über alle Nutzer
  (service_role), weist sich per Wecker-Token aus.

## Was hier NICHT liegt

Geheimnisse. Bewusst nicht im Repo:

- `VAPID_PRIVATE_KEY` – als Function-Secret in Supabase hinterlegt.
- `wecker_token` – im Supabase Vault, wird zur Laufzeit erzeugt (siehe
  `20260717115134_faltenwecker_token.sql`).

Der `VAPID_PUBLIC`-Key und der `sb_publishable_`-Key stehen im Klartext im Code –
das ist Absicht, beide sind öffentlich by design.

## Wiederherstellen

Bei einem leeren Projekt: Migrationen der Reihenfolge nach anwenden, Functions
deployen, dann die beiden Geheimnisse neu setzen (VAPID-Paar erzeugen, Vault-Token
legt die Token-Migration selbst an). Storage-Objekte (Profilbilder) sind NICHT in
den Migrationen enthalten – die liegen im `avatars`-Bucket und bräuchten einen
eigenen Export.
