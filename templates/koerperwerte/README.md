# Template: Körperwerte (Hautfalten & Gewicht)

Herausgelöst aus LOGMAN, damit die beiden Boxen später in der Ernährungs-App
weiterleben können. Läuft hier **noch** produktiv mit — dieser Ordner ist die
Kopie zum Mitnehmen, keine Auslagerung.

## Was drin ist

| Datei | Zweck |
|---|---|
| `messung.js` | Rechenlogik: die zwölf YPSI-Stellen, Summenbildung, 7-Tage-Schnitt. Ohne DB-Client, damit testbar. |
| `kurve.js` | Kleines SVG-Liniendiagramm (keine Bibliothek). Achse kann Datum **oder** Zahl. |
| `erfolg.js` | Die beiden Karten: Anzeige, Eingabe, Erinnerungs-Einstellungen, Reset. Enthält den DB-Zugriff. |
| `styles-koerperwerte.css` | Zugehörige Styles. |
| `sql/01-tabellen.sql` | Tabellen `skinfolds`, `weights`, Profil-Spalten, RLS. |
| `sql/02-erinnerung.sql` | Fälligkeits-Logik, Vault-Token, pg_cron-Job für die Push-Erinnerung. |
| `faltenwecker-edge-function.ts` | Die Function, die die Erinnerung verschickt. |

## Einbau in eine neue App

1. **SQL**: `01-tabellen.sql` anwenden. Setzt eine Tabelle `profiles` mit
   `id → auth.users(id)` voraus.
2. **Frontend**: die drei JS-Dateien übernehmen, `styles-koerperwerte.css`
   einbinden, und `mountErfolg(wrap, { session, profile, onProfileUpdated })`
   dort aufrufen, wo die Boxen stehen sollen.
   `erfolg.js` importiert `./supabase.js` und `./log.js` (nur für `toast`) —
   beide Importe auf die Gegenstücke der Zielapp umbiegen.
3. **Erinnerung** (optional, nur für die Hautfalten): Edge Function deployen,
   dann `02-erinnerung.sql`. **Vorher die Platzhalter ersetzen**:
   Projekt-URL, Publishable-Key, VAPID-Key, Kontaktadresse.
   Setzt eine Tabelle `push_subscriptions` (endpoint, user_id, p256dh, auth,
   updated_at) und einen registrierten Service Worker voraus.

## Entscheidungen, die man nicht wegwerfen sollte

- **Nur die Summe in mm, keine Deutung einzelner Falten.** Die Zuordnung
  einzelner Stellen zu Hormonen hat der Überprüfung nie standgehalten, und eine
  Umrechnung in Körperfett-Prozent addiert nur Fehler. „112 → 104 mm" ist
  ehrlicher und für den Verlauf genauso brauchbar.
- **Alle zwölf Falten sind Pflicht.** Eine Summe aus elf sieht aus wie eine
  gültige Zahl, ist aber mit früheren Messungen nicht vergleichbar.
- **Beim Gewicht zählt der 7-Tage-Schnitt**, nicht der Tageswert: Wasser und
  Salz schwanken stärker als der Fortschritt einer Woche. Gemittelt wird über
  das Kalenderfenster, nicht über die letzten sieben Einträge — sonst bekäme man
  nach einer Pause einen Schnitt aus alten Werten.
- **Nur die Falten werden angemahnt, nicht das Gewicht.** Tägliches Wiegen
  braucht keinen Wecker; die Faltenmessung hat einen Termin.
- **Erinnert wird einmal, dann ein volles Intervall Ruhe.** Ohne das käme die
  Push ab dem Fälligkeitstag jeden Tag wieder.
