-- Das Trainingslog darf nur noch ueber training_log_speichern() bzw.
-- training_log_wiederherstellen() geschrieben werden (Versionspruefung).
--
-- Solange direkte Schreibrechte bestanden, konnte eine alte App-Version – etwa
-- auf einem lange nicht geoeffneten Geraet, bevor der Service Worker die neue
-- Fassung laedt – ihren Stand weiterhin blind hochladen. Ohne Rechte scheitert
-- dieser Upload; der Stand bleibt lokal erhalten und wird nach dem App-Update
-- mit Versionspruefung abgeglichen.
--
-- Lesen bleibt erlaubt (RLS). Konto-Loeschen loescht per Kaskade als
-- Tabelleneigentuemer und ist davon nicht betroffen.
-- Eingespielt am 29.09.2026, nachdem die RPC-Version deployed und auf dem
-- iPhone bestaetigt war.

revoke insert, update, delete on public.training_logs from anon, authenticated;
