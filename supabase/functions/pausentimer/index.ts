import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// Pausentimer per Push.
//
// Warum das ueberhaupt noetig ist: iOS kennt keine lokal geplanten
// Benachrichtigungen. Sobald die App im Hintergrund ist, friert das JavaScript
// ein – ein setTimeout im Browser feuert nie. Die Erinnerung MUSS also von
// aussen kommen, und irgendetwas muss dafuer die Zeit abwarten.
//
// Warum kein pg_cron: Der wacht hoechstens jede Minute auf. Fuer "in 127
// Sekunden" zu grob.
//
// Also schlaeft diese Function. Sie antwortet SOFORT (sonst liefe die Anfrage in
// den 150s-Timeout) und arbeitet per EdgeRuntime.waitUntil im Hintergrund weiter.
// Warten kostet keine CPU-Zeit, nur Lebenszeit des Workers.
//
// GRENZE: Der Worker lebt auf dem Free-Plan 150s – und zwar ab seinem Start,
// nicht ab unserer Anfrage. Bei einer 2-Minuten-Pause bleiben also nur ~30s
// Puffer. Laengere Pausen gehen hier nicht.

const VAPID_PUBLIC = 'BEi1duvMCessLiCp4mxksfnoMPI6tXOqziOXyllyLpsr_px2_WhmNwwO3Cb4NxYLeLvUyZ-rDYQUh2Ac3T5z1y8';
const MAX_SEKUNDEN = 140;   // knapp unter der Worker-Lebenszeit

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const privat = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!privat) return json({ fehler: 'VAPID_PRIVATE_KEY fehlt' }, 500);
  webpush.setVapidDetails('mailto:flrn.rau@gmail.com', VAPID_PUBLIC, privat);

  // Im Namen des Aufrufers arbeiten: Damit greift RLS wie ueberall sonst und
  // niemand kann einem anderen einen Timer stellen. Kein service_role noetig.
  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ fehler: 'nicht angemeldet' }, 401);

  const body = await req.json().catch(() => ({}));
  const aktion = body.aktion ?? 'start';

  // Abbrechen: Zeile weg -> der schlafende Auftrag findet seine Marke nicht mehr
  // und schweigt.
  if (aktion === 'stop') {
    await supabase.from('rest_timers').delete().eq('user_id', user.id);
    return json({ ok: true, aktion: 'gestoppt' });
  }

  const sekunden = Math.min(Math.max(Number(body.sekunden) || 0, 5), MAX_SEKUNDEN);
  const label = String(body.label ?? '').slice(0, 60);
  const token = crypto.randomUUID();

  // Protokollzeile schreiben. Ersetzt console.log: Dessen Ausgaben tauchen im
  // Log-Werkzeug nicht auf, dort stehen nur Request-Zeilen – Apples Antwort war
  // damit von aussen unsichtbar.
  const notiere = (felder: Record<string, unknown>) =>
    supabase.from('push_versuche').insert({ user_id: user.id, quelle: 'pausentimer', ...felder });

  const { error: upErr } = await supabase.from('rest_timers').upsert({
    user_id: user.id,
    token,
    ends_at: new Date(Date.now() + sekunden * 1000).toISOString(),
    label,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (upErr) return json({ fehler: upErr.message }, 500);

  const abos = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', user.id);
  if (!abos.data?.length) return json({ fehler: 'kein Push-Abo auf diesem Konto' }, 400);

  const arbeit = (async () => {
    await new Promise((r) => setTimeout(r, sekunden * 1000));

    // Gilt die Marke noch? Neustart oder Abbruch haben sie ersetzt bzw. geloescht.
    const { data: jetzt } = await supabase.from('rest_timers').select('token').eq('user_id', user.id).maybeSingle();
    if (!jetzt || jetzt.token !== token) {
      await notiere({ antwort: 'ueberholt – nicht gesendet', ok: false });
      return;
    }

    await supabase.from('rest_timers').delete().eq('user_id', user.id).eq('token', token);

    // TTL: Wie lange Apple die Nachricht aufheben darf, wenn das Geraet gerade
    // nicht erreichbar ist. Stand lange auf 0 ("sofort oder wegwerfen"), was zu
    // scharf war; 45s ueberbruecken eine kurze Nichterreichbarkeit, ohne eine
    // Pausen-Erinnerung von vorgestern nachzureichen.
    const payload = JSON.stringify({
      title: '⏹ Pause vorbei',
      body: label ? `${label} — nächster Satz` : 'Nächster Satz',
      tag: 'pause',
    });
    await Promise.allSettled((abos.data ?? []).map((a) =>
      webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        payload,
        { TTL: 45, urgency: 'high' },
      ).then(
        (r: { statusCode?: number; body?: string; headers?: Record<string, string> }) =>
          notiere({
            endpunkt: a.endpoint.slice(-14),
            status: r?.statusCode ?? null,
            antwort: JSON.stringify({ body: r?.body ?? '', headers: r?.headers ?? {} }).slice(0, 600),
            ok: true,
          }),
        async (e: { statusCode?: number; body?: string; message?: string }) => {
          // JEDEN Fehlschlag festhalten, nicht nur die behandelten. Vorher
          // verschwand hier alles ausser 404/410 spurlos: allSettled schluckt
          // die Ablehnung, und die Funktion hatte laengst mit 200 geantwortet.
          await notiere({
            endpunkt: a.endpoint.slice(-14),
            status: e?.statusCode ?? null,
            antwort: String(e?.body || e?.message || e).slice(0, 600),
            ok: false,
          });
          // 404/410 = Geraet hat das Abo weggeworfen (App vom Homescreen geloescht).
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', a.endpoint);
          }
        },
      ),
    ));
  })();

  // Sofort antworten, im Hintergrund weiterschlafen. Ohne das liefe die Anfrage
  // in den 150s-Timeout und die App haenge zwei Minuten am Timer-Knopf.
  EdgeRuntime.waitUntil(arbeit);
  return json({ ok: true, sekunden, endetUm: new Date(Date.now() + sekunden * 1000).toISOString() });
});
