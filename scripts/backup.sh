#!/usr/bin/env bash
#
# BLAST Trainer – Daten-Backup.
#
# Warum es das gibt: Das Supabase-Projekt liegt auf dem Free-Plan, und der hat
# KEINE automatischen taeglichen Backups (nur Pro aufwaerts). Ein Trainingslog
# laesst sich nicht rekonstruieren – also braucht es eine zweite Kopie ausser
# Haus. Dieses Skript zieht einen vollstaendigen Dump (Schema + alle Daten) und
# legt ihn in iCloud.
#
# So oft laufen lassen, wie du magst – alle paar Wochen reicht beim aktuellen
# Tempo. Einfach im Terminal:  bash scripts/backup.sh
#
# Dein Datenbank-Passwort steht NIRGENDS in dieser Datei. Das Skript fragt bei
# jedem Lauf danach (verdeckt) und reicht es nur ueber eine Umgebungsvariable an
# pg_dump weiter – es taucht damit auch nicht in der Prozessliste (ps) auf.

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Verbindungsstring aus dem Supabase-Dashboard.
#
#    Dashboard -> oben "Connect" -> Reiter "Session pooler" -> URI kopieren.
#    Den Platzhalter [YOUR-PASSWORD] im String SO STEHEN LASSEN – das Skript
#    ersetzt ihn zur Laufzeit durch das, was du eingibst.
#
#    (Der Pooler statt der direkten db.<ref>-Adresse, weil letztere nur ueber
#    IPv6 erreichbar ist und die meisten Heimnetze das nicht haben.)
# ---------------------------------------------------------------------------
CONN_TEMPLATE="postgresql://postgres.bjtnpmselziqpwnthukj:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# ---------------------------------------------------------------------------
# 2. Wohin. iCloud, plus die letzten 12 Dumps behalten.
# ---------------------------------------------------------------------------
ZIEL="$HOME/Library/Mobile Documents/com~apple~CloudDocs/BLAST-Backups"
BEHALTEN=12

# ---------------------------------------------------------------------------
# pg_dump finden – aus dem PATH oder aus Homebrews libpq.
# ---------------------------------------------------------------------------
PG_DUMP="$(command -v pg_dump || true)"
if [ -z "$PG_DUMP" ]; then
  for kandidat in /opt/homebrew/opt/libpq/bin/pg_dump /usr/local/opt/libpq/bin/pg_dump; do
    [ -x "$kandidat" ] && PG_DUMP="$kandidat" && break
  done
fi
if [ -z "$PG_DUMP" ]; then
  cat <<'HILFE'
pg_dump ist nicht installiert. Einmalig einrichten mit Homebrew:

    brew install libpq

Danach dieses Skript erneut starten. (Ein volles Postgres brauchst du nicht –
libpq bringt pg_dump allein mit.)
HILFE
  exit 1
fi

# ---------------------------------------------------------------------------
# Passwort verdeckt erfragen und aus dem String loesen: pg_dump bekommt die URI
# OHNE Passwort, das Passwort separat ueber PGPASSWORD.
# ---------------------------------------------------------------------------
printf 'Datenbank-Passwort (Eingabe bleibt verborgen): '
read -rs DB_PASS
echo

if printf '%s' "$CONN_TEMPLATE" | grep -q '\[YOUR-PASSWORD\]'; then
  CONN_OHNE_PW="${CONN_TEMPLATE/\[YOUR-PASSWORD\]/}"
else
  echo "Hinweis: Im Verbindungsstring fehlt der Platzhalter [YOUR-PASSWORD]." >&2
  echo "Trage oben die URI aus dem Dashboard ein (mit dem Platzhalter)." >&2
  exit 1
fi

mkdir -p "$ZIEL"
STAMPEL="$(date +%Y-%m-%d-%H%M)"
DATEI="$ZIEL/blast-$STAMPEL.sql"

echo "Sichere nach: $DATEI"
PGPASSWORD="$DB_PASS" "$PG_DUMP" "$CONN_OHNE_PW" \
  --no-owner --no-privileges \
  --file "$DATEI"

# Passwort aus dem Speicher werfen.
unset DB_PASS PGPASSWORD

GROESSE="$(du -h "$DATEI" | cut -f1)"
echo "Fertig – $GROESSE."

# Alte Dumps aufraeumen, die neuesten $BEHALTEN bleiben.
ANZAHL="$(ls -1 "$ZIEL"/blast-*.sql 2>/dev/null | wc -l | tr -d ' ')"
if [ "$ANZAHL" -gt "$BEHALTEN" ]; then
  ls -1t "$ZIEL"/blast-*.sql | tail -n +"$((BEHALTEN + 1))" | while read -r alt; do
    echo "Raeume alt weg: $(basename "$alt")"
    rm -f "$alt"
  done
fi
