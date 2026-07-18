// HINWEIS: VAPID-Key und Kontaktadresse sind Platzhalter.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Der Wecker fuer die Hautfalten-Messung.
//
// Laeuft NICHT auf Zuruf aus der App, sondern viertelstuendlich per pg_cron.
// Der Grund ist derselbe wie beim Pausentimer: iOS kennt keine lokal geplanten
// Benachrichtigungen. Eine Erinnerung in zwei Wochen kann nur von aussen kommen.
//
// Anders als der Pausentimer arbeitet diese Function NICHT im Namen eines
// Aufrufers – sie geht ueber alle Nutzer. Deshalb der service_role-Client, und
// deshalb die Token-Pruefung unten.
//
// Wer faellig ist, entscheidet die Datenbank (falten_faellige_abos). Hier steht
// nur der Versand.

const VAPID_PUBLIC = 'DEIN_VAPID_PUBLIC_KEY';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const privat = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!privat) return json({ fehler: 'VAPID_PRIVATE_KEY fehlt' }, 500);

  // Der von der Plattform mitgegebene Schluessel. Er ist gueltig, waehrend der
  // alte Legacy-JWT dieses Projekts es nicht mehr ist – nichts selbst mitbringen.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // verify_jwt am Gateway laesst JEDEN Projekt-Schluessel durch – auch den
  // publishable, der im App-Bundle steht. Das ist kein Ausweis. Der Ausweis ist
  // dieses Token, das nur im Vault und im Cron-Job existiert.
  const token = req.headers.get('x-wecker-token') ?? '';
  const { data: echt } = await supabase.rpc('wecker_token_gueltig', { t: token });
  if (echt !== true) return json({ fehler: 'nur der Wecker selbst' }, 403);

  webpush.setVapidDetails('mailto:DEINE@MAIL.DE', VAPID_PUBLIC, privat);

  const { data: abos, error } = await supabase.rpc('falten_faellige_abos');
  if (error) return json({ fehler: error.message }, 500);
  if (!abos?.length) return json({ ok: true, faellig: 0 });

  const payload = JSON.stringify({
    title: '📏 Hautfalten messen',
    body: 'Nüchtern und vor dem Training – sonst misst du Schwankung statt Fortschritt.',
    tag: 'falten',
    url: '#profile',
  });

  // Wem der Versand geglueckt ist. Nur die werden als erinnert markiert – ein
  // Fehler beim Senden darf die Erinnerung nicht stillschweigend verschlucken.
  const erreicht = new Set<string>();

  await Promise.allSettled(abos.map(async (a: { user_id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      // Anders als beim Pausentimer KEIN TTL 0: Diese Nachricht ist auch eine
      // Stunde spaeter noch richtig. Liegt das Handy aus, soll sie warten.
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        payload,
        { TTL: 6 * 3600 },
      );
      erreicht.add(a.user_id);
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      // 404/410 = Geraet hat das Abo weggeworfen (App vom Homescreen geloescht).
      // Aufraeumen, sonst sammeln sich Leichen, die Apple sogar mit 201 annimmt.
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', a.endpoint);
      }
    }
  }));

  if (erreicht.size) {
    await supabase.rpc('falten_erinnert_markieren', { ids: [...erreicht] });
  }
  return json({ ok: true, abos: abos.length, erinnert: erreicht.size });
});
