import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// iOS friert JavaScript im Hintergrund ein. Die Pausen-Erinnerung muss deshalb
// serverseitig warten. Ein Edge-Worker darf jedoch nicht beliebig lange leben.
// Laengere Pausen werden in kurze, authentifizierte Etappen geteilt; dadurch
// werden 2.5 und 3 Minuten nicht mehr faelschlich nach 140 Sekunden gemeldet.

const VAPID_PUBLIC = 'BEi1duvMCessLiCp4mxksfnoMPI6tXOqziOXyllyLpsr_px2_WhmNwwO3Cb4NxYLeLvUyZ-rDYQUh2Ac3T5z1y8';
const ETAPPE_MS = 105_000;
const MAX_SEKUNDEN = 10 * 60;

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
  webpush.setVapidDetails(
    Deno.env.get('VAPID_CONTACT') || 'mailto:admin@example.invalid',
    VAPID_PUBLIC,
    privat,
  );

  const auth = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ fehler: 'nicht angemeldet' }, 401);

  const body = await req.json().catch(() => ({}));
  const aktion = body.aktion ?? 'start';

  if (aktion === 'stop') {
    await supabase.from('rest_timers').delete().eq('user_id', user.id);
    return json({ ok: true, aktion: 'gestoppt' });
  }

  const notiere = (felder: Record<string, unknown>) =>
    supabase.from('push_versuche').insert({ user_id: user.id, quelle: 'pausentimer', ...felder });

  const timerLesen = async (token: string) => {
    const { data } = await supabase
      .from('rest_timers')
      .select('token, ends_at, label')
      .eq('user_id', user.id)
      .maybeSingle();
    return data?.token === token ? data : null;
  };

  const pushSenden = async (token: string, label: string) => {
    const aktuell = await timerLesen(token);
    if (!aktuell) {
      await notiere({ antwort: 'ueberholt – nicht gesendet', ok: false });
      return;
    }

    await supabase.from('rest_timers').delete().eq('user_id', user.id).eq('token', token);
    const { data: abos } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user.id);

    const payload = JSON.stringify({
      title: '⏹ Pause vorbei',
      body: label ? `${label} — nächster Satz` : 'Nächster Satz',
      tag: 'pause',
    });
    await Promise.allSettled((abos ?? []).map((a) =>
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
          await notiere({
            endpunkt: a.endpoint.slice(-14),
            status: e?.statusCode ?? null,
            antwort: String(e?.body || e?.message || e).slice(0, 600),
            ok: false,
          });
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', a.endpoint);
          }
        },
      ),
    ));
  };

  const etappeAusfuehren = async (token: string) => {
    const timer = await timerLesen(token);
    if (!timer) return;
    const verbleibend = Math.max(0, Date.parse(timer.ends_at) - Date.now());
    await new Promise((r) => setTimeout(r, Math.min(verbleibend, ETAPPE_MS)));

    const danach = await timerLesen(token);
    if (!danach) return;
    const rest = Math.max(0, Date.parse(danach.ends_at) - Date.now());
    if (rest <= 500) {
      await pushSenden(token, String(danach.label || ''));
      return;
    }

    // Ein neuer Worker uebernimmt die naechste Etappe. Der Nutzer-JWT und die
    // Token-Marke sorgen dafuer, dass nur der eigene, noch aktuelle Timer
    // fortgesetzt wird. Abbruch oder Neustart ersetzen/loeschen die Marke.
    const antwort = await fetch(`${supabaseUrl}/functions/v1/pausentimer`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ aktion: 'fortsetzen', token }),
    });
    if (!antwort.ok) {
      await notiere({ status: antwort.status, antwort: 'Fortsetzung fehlgeschlagen', ok: false });
    }
  };

  if (aktion === 'fortsetzen') {
    const token = String(body.token || '');
    if (!/^[0-9a-f-]{36}$/i.test(token) || !(await timerLesen(token))) {
      return json({ ok: true, aktion: 'ueberholt' });
    }
    EdgeRuntime.waitUntil(etappeAusfuehren(token));
    return json({ ok: true, aktion: 'fortgesetzt' });
  }

  const sekunden = Math.min(Math.max(Number(body.sekunden) || 0, 5), MAX_SEKUNDEN);
  const label = String(body.label ?? '').slice(0, 60);
  const token = crypto.randomUUID();
  const endetUm = new Date(Date.now() + sekunden * 1000).toISOString();

  const { error: upErr } = await supabase.from('rest_timers').upsert({
    user_id: user.id,
    token,
    ends_at: endetUm,
    label,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (upErr) return json({ fehler: upErr.message }, 500);

  const { data: abos } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', user.id)
    .limit(1);
  if (!abos?.length) {
    await supabase.from('rest_timers').delete().eq('user_id', user.id).eq('token', token);
    return json({ fehler: 'kein Push-Abo auf diesem Konto' }, 400);
  }

  EdgeRuntime.waitUntil(etappeAusfuehren(token));
  return json({ ok: true, sekunden, endetUm });
});
