# BLAST Trainer

Multi-User Trainings-Log auf Basis des BLAST-Prinzips (Load / Pump / Muscle-Round).
Frontend: **Vite + Vanilla JS**. Backend: **Supabase** (Auth, Postgres mit Row-Level-Security, Storage).
Hosting: **GitHub Pages**.

## Rollen

- **Admin** (du): sieht alle Nutzer und deren Logs (Nur-Lese-Einsicht), plus eigenes Log & Profil.
- **Kunde**: sieht ausschließlich die eigenen Daten (per RLS erzwungen), pflegt Log & Profil.

Die Rolle `admin` wird automatisch vergeben, wenn sich jemand mit der E-Mail
`flrn.rau@gmail.com` registriert (siehe DB-Trigger `handle_new_user`). Alle anderen
werden `customer`. Willst du eine andere Admin-Adresse, passe den Trigger an.

## Lokal starten

1. `npm install`
2. `.env.local` anlegen (aus `.env.example` kopieren) und ausfüllen:
   ```
   VITE_SUPABASE_URL=https://bjtnpmselziqpwnthukj.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_wPAzLdRgAvy46B5KMNuyCQ_-KGAbm5T
   ```
3. `npm run dev` → http://localhost:5173

> **Sicherheitshinweis:** `VITE_SUPABASE_URL` und der Publishable-/Anon-Key sind bei
> Client-Apps **öffentlich by design** – sie landen im Browser-Bundle. Der echte Schutz
> ist Row-Level-Security. Der **`service_role`-Key** gehört **niemals** ins Frontend,
> ins Repo oder in eine `VITE_`-Variable.

## Deployment auf GitHub Pages

Der Workflow `.github/workflows/deploy.yml` baut die App und deployt sie bei jedem Push
auf `main`. Er liest die Supabase-Werte aus **GitHub Actions Repository Secrets** und
backt sie zur Build-Zeit ins Bundle.

### 1. Repository-Secrets eintragen
GitHub → dein Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret-Name              | Wert                                                  |
| ------------------------ | ----------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://bjtnpmselziqpwnthukj.supabase.co`            |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_wPAzLdRgAvy46B5KMNuyCQ_-KGAbm5T`      |

### 2. Pages aktivieren
GitHub → Repo → **Settings → Pages** → **Source: „GitHub Actions"**.

### 3. Push
```
git init && git add . && git commit -m "BLAST Trainer"
git branch -M main
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```
Nach dem Push baut die Action und veröffentlicht die Seite unter
`https://<user>.github.io/<repo>/`.

### 4. Supabase Redirect-URL (wichtig)
Damit Login/E-Mail-Bestätigung auf der Live-Domain funktioniert:
Supabase → **Authentication → URL Configuration** → deine Pages-URL bei
**Site URL** und **Redirect URLs** eintragen.

## E-Mail-Bestätigung

Neue Supabase-Projekte haben **E-Mail-Bestätigung standardmäßig aktiv**. Nach der
Registrierung muss der Nutzer den Link aus der E-Mail klicken, bevor er sich einloggen kann.

- Für **einfaches Onboarding** kannst du das abschalten:
  Supabase → **Authentication → Providers → Email** → „Confirm email" aus.
- Für **Produktion** solltest du eigenes SMTP hinterlegen
  (Supabase → **Authentication → Emails → SMTP Settings**), da der eingebaute
  Mailversand stark limitiert ist.

## Datenmodell (Supabase)

- `public.profiles` — `id` (→ `auth.users`), `role` (`admin`/`customer`), `full_name`,
  `email`, `avatar_url`. Wird per Trigger bei der Registrierung automatisch angelegt.
- `public.training_logs` — `user_id` (→ `auth.users`), `payload` (jsonb, das komplette
  Log), `updated_at`. Genau **eine Zeile pro Nutzer**.
- `public.profiles.avatar_url` — das **Profilbild**: wird im Browser auf ein kleines
  Thumbnail (~256 px, JPEG, ~5–40 KB) komprimiert und direkt als Data-URL im Profil
  gespeichert (kein Storage-Bucket nötig). Siehe „Bekannte Punkte".
- Storage-Bucket `avatars` (public read, Policies auf eigenen `{user_id}/…`-Ordner) ist
  eingerichtet, wird von der App aber **aktuell nicht** genutzt (siehe „Bekannte Punkte").

Alle Tabellen haben RLS aktiv: Kunden sehen/ändern nur ihre eigene Zeile, der Admin
(`public.is_admin()`) sieht alle. Kunden können ihre Rolle nicht selbst ändern
(Trigger `prevent_role_escalation`).

## Projektstruktur

```
src/
  main.js       App-Shell, Session, Hash-Router, Login/Signup
  supabase.js   Supabase-Client aus Env-Variablen
  auth.js       signIn / signUp / signOut / loadProfile
  template.js   BLAST-Trainingsvorlage (TPL)
  log.js        Trainings-Log (editierbar + read-only), Persistenz auf training_logs
  profile.js    Profil-Seite + Profilbild (Client-Komprimierung → Data-URL)
  admin.js      Admin: Nutzerliste + Nur-Lese-Log-Einsicht
  styles.css    RetroMuscle-Designsystem
```

## Bekannte Punkte

### Profilbild: warum kein Supabase Storage?
Der `avatars`-Bucket samt Ordner-Policies ist eingerichtet, aber die Storage-API dieses
(brandneuen) Projekts erkennt das ES256-signierte Login-Token aktuell nicht als
eingeloggten Nutzer (`auth.uid()` ist dort leer), sodass die Ordner-Policy jeden Upload
ablehnt. Die Tabellen-RLS (`profiles`, `training_logs`) ist davon **nicht** betroffen –
Postgres/PostgREST verifiziert dasselbe Token korrekt.

Deshalb speichert die App das Profilbild als komprimiertes Thumbnail direkt im Profil.
Falls du später doch echten Storage willst: im Supabase-Dashboard unter
**Settings → JWT Keys** das Signing-Key-/Legacy-Secret-Thema lösen, dann kann `profile.js`
wieder auf `supabase.storage.from('avatars').upload(...)` umgestellt werden.

### Test-Accounts
Für die Verifikation wurden zwei bestätigte Test-Accounts angelegt:

| Rolle  | E-Mail                  | Passwort   |
| ------ | ----------------------- | ---------- |
| Admin  | `admin.test@blast.app`  | `Test1234!`|
| Kunde  | `kunde.test@blast.app`  | `Test1234!`|

Damit kannst du die App sofort ausprobieren. **Lösche sie**, wenn du fertig bist
(Supabase → Authentication → Users), und registriere deinen echten Admin-Account mit
`flrn.rau@gmail.com` – der wird per Trigger automatisch zum Admin.

### E-Mail-Bestätigung beim echten Onboarding
Da die Bestätigung standardmäßig aktiv ist (siehe oben), entweder im Dashboard
abschalten **oder** eigenes SMTP hinterlegen, bevor du dich mit deiner echten E-Mail
registrierst – sonst kommt die Bestätigungsmail über den limitierten Standard-Mailer
evtl. nicht an.
