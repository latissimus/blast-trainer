// Service Worker und Push-Anmeldung.
//
// Beides haengt am App-Start und an keiner Oberflaeche. Der Grund steht in der
// Projektgeschichte: Erst hing die Worker-Registrierung am Diagnose-Knopf im
// Profil und waere mit dessen Wegfall still gestorben; danach ist mir beim
// Aufraeumen das Push-Abo mit rausgeflogen, und die App konnte sich nicht mehr
// anmelden. Was funktionieren soll, darf nicht davon abhaengen, dass jemand
// irgendwo tippt.
import { supabase } from './supabase.js';

const VAPID_PUBLIC = 'BEi1duvMCessLiCp4mxksfnoMPI6tXOqziOXyllyLpsr_px2_WhmNwwO3Cb4NxYLeLvUyZ-rDYQUh2Ac3T5z1y8';

const WEG_KEY = 'blast:push-hinweis-weg';

export async function registriereSW() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker werden hier nicht unterstützt.');
  // Relativ zur Seite: Unter GitHub Pages liegt die App in einem Unterordner,
  // ein absoluter Pfad wuerde am falschen Ort suchen.
  return navigator.serviceWorker.register('./sw.js');
}

// iOS liefert Push nur an Web-Apps aus, die vom Homescreen gestartet wurden.
// Im Safari-Tab zu fragen waere sinnlos – die Erlaubnis brächte dort nichts.
const istHomescreenApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Ob der einmalige Hinweis gezeigt werden soll.
//
// Eine native App darf die Abfrage beim ersten Start selbst ausloesen. Eine
// Web-App darf das nicht – Apple verlangt eine echte Nutzeraktion. Dieser
// Hinweis ist das Aequivalent dazu: einmal tippen, danach nie wieder.
export const pushHinweisZeigen = () => {
  try {
    if (!istHomescreenApp()) return false;
    if (!('Notification' in window) || !('PushManager' in window)) return false;
    if (Notification.permission !== 'default') return false;   // schon erlaubt oder abgelehnt
    return localStorage.getItem(WEG_KEY) !== '1';
  } catch (e) {
    return false;
  }
};

export const pushHinweisWegwischen = () => {
  try { localStorage.setItem(WEG_KEY, '1'); } catch (e) { /* egal */ }
};

// Muss aus einem echten Tipp heraus laufen – iOS lehnt die Abfrage sonst
// kommentarlos ab.
export async function erlaubnisFragen(userId) {
  const erlaubnis = await Notification.requestPermission();
  pushHinweisWegwischen();   // gefragt ist gefragt, egal wie die Antwort ausfiel
  if (erlaubnis !== 'granted') return false;
  return !!(await abonniereStill(userId));
}

const base64UrlZuUint8 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const roh = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...roh].map((c) => c.charCodeAt(0)));
};

// Meldet das Geraet still fuer Push an – aber nur, wenn die Erlaubnis schon
// erteilt ist. Von sich aus fragen waere zwecklos (iOS erlaubt die Abfrage nur
// aus einem echten Tipp heraus) und aufdringlich.
//
// Wichtig: Ein Abo gehoert zur Service-Worker-Registrierung. Loescht man die
// App vom Homescreen, ist beides weg – die alten Endpunkte in der Datenbank
// zeigen dann ins Leere, und Apple nimmt sie trotzdem noch mit 201 an. Darum
// wird bei jedem Start geprueft und notfalls neu angelegt.
export async function abonniereStill(userId) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return null;
    if (!('PushManager' in window)) return null;
    const reg = await navigator.serviceWorker.ready;
    let abo = await reg.pushManager.getSubscription();
    if (!abo) {
      abo = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlZuUint8(VAPID_PUBLIC),
      });
    }
    const j = abo.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        endpoint: j.endpoint,
        user_id: userId,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );
    if (error) return null;

    // Leichen desselben Geraets wegraeumen.
    //
    // iOS gibt beim Neuanlegen eines Abos einen NEUEN Endpunkt aus; der alte
    // bleibt als Zeile stehen. Das Aufraeumen per 404/410 in der Edge Function
    // greift hier nicht, weil Apple tote Endpunkte mit 201 annimmt (siehe
    // oben). Beobachtet: zwei Abos fuer ein Telefon, 10 Minuten auseinander.
    //
    // Abgrenzung ueber user_agent statt nur user_id: Wer die App auf iPhone
    // UND iPad benutzt, soll beide behalten.
    await supabase.from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('user_agent', navigator.userAgent.slice(0, 200))
      .neq('endpoint', j.endpoint);

    return abo;
  } catch (e) {
    return null;   // Push ist Beiwerk – es darf die App nie aufhalten
  }
}
