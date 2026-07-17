// Benachrichtigungen: Diagnose und Anmeldung.
//
// Zweck ist zunaechst eine einzige Frage: Geht Web Push auf DIESEM Geraet in
// DIESER Region ueberhaupt? Die Quellenlage zur EU widerspricht sich, und darauf
// laesst sich nichts bauen. Statt zu recherchieren wird gemessen.
//
// Der oeffentliche VAPID-Schluessel darf im Code stehen – er ist per Definition
// oeffentlich. Der private liegt ausserhalb des Repos und wird erst gebraucht,
// wenn tatsaechlich jemand Pushes verschickt.
const VAPID_PUBLIC = 'BEi1duvMCessLiCp4mxksfnoMPI6tXOqziOXyllyLpsr_px2_WhmNwwO3Cb4NxYLeLvUyZ-rDYQUh2Ac3T5z1y8';

// iOS liefert Push nur an Web-Apps aus, die vom Homescreen gestartet wurden –
// im Safari-Tab bleibt alles stumm. Das ist die erste Bedingung ueberhaupt.
export const istHomescreenApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function diagnose() {
  return {
    homescreen: istHomescreenApp(),
    serviceWorker: 'serviceWorker' in navigator,
    pushManager: 'PushManager' in window,
    notification: 'Notification' in window,
    erlaubnis: 'Notification' in window ? Notification.permission : '—',
    sichererKontext: window.isSecureContext,
  };
}

export async function registriereSW() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker werden hier nicht unterstützt.');
  // Relativ zur Seite: unter GitHub Pages liegt die App in einem Unterordner,
  // ein absoluter Pfad wuerde am falschen Ort suchen.
  return navigator.serviceWorker.register('./sw.js');
}

const base64UrlZuUint8 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const roh = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...roh].map((c) => c.charCodeAt(0)));
};

// Der eigentliche Beweis. Erst dieser Aufruf spricht mit Apples Push-Dienst –
// vorhandene APIs allein sagen noch nicht, dass die Kette bis zum Ende traegt.
export async function abonniere() {
  const reg = await registriereSW();
  await navigator.serviceWorker.ready;
  const vorhanden = await reg.pushManager.getSubscription();
  if (vorhanden) return vorhanden;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlZuUint8(VAPID_PUBLIC),
  });
}

export async function testMitteilung() {
  const reg = await navigator.serviceWorker.ready;
  // Auf iOS gibt es kein new Notification() – nur ueber den Service Worker.
  return reg.showNotification('BLAST', {
    body: 'Benachrichtigungen funktionieren auf diesem Gerät.',
    icon: 'icon-192.png',
    tag: 'blast-test',
  });
}
