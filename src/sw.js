// Service Worker: Offline-Start (Stufe 2) und Benachrichtigungen.
//
// WAS GECACHT WIRD: ausschliesslich die App-Dateien aus dem Build
// (self.__WB_MANIFEST). Genau deshalb startet die App ohne Empfang.
//
// WAS NIEMALS GECACHT WIRD: die Supabase-Aufrufe. Das ist die wichtigste Regel
// dieser Datei. Kaemen Trainingsdaten aus einem Cache, bekaeme man stillschweigend
// alte Gewichte serviert – Datenmuell statt einer sichtbar kaputten Oberflaeche.
// Workbox' Router antwortet nur, wenn eine Route passt; alles andere faellt durch
// ins Netz. Fuer die API gibt es hier bewusst keine Route.
//
// NOTAUSGANG, falls doch etwas schiefgeht: eine sw.js ausliefern, die nur
// self.registration.unregister() und caches.delete() aufruft. Beim naechsten
// Start ist der Worker weg. Browser holen sw.js immer aus dem Netz (HTTP-Cache
// dafuer auf 24h gedeckelt) – der Fix kommt also an.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

precacheAndRoute(self.__WB_MANIFEST);
// Caches frueherer Versionen wegraeumen, sonst waechst der Speicher endlos.
cleanupOutdatedCaches();

// Die App ist eine einzige index.html mit Hash-Routing – jeder Aufruf bekommt sie.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// skipWaiting + clientsClaim: Eine neue Version uebernimmt beim naechsten Start,
// statt zu warten, bis alle Fenster geschlossen sind.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let daten = {};
  try {
    daten = event.data ? event.data.json() : {};
  } catch (e) {
    daten = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(daten.title || 'BLAST', {
      body: daten.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: daten.tag || 'blast',
      // Ziel mitfuehren: Der Klick-Handler laeuft spaeter und sieht vom Push
      // sonst nichts mehr. Ohne das waere ein url im Payload eine Attrappe.
      data: { url: daten.url || '' },
    }),
  );
});

// Tipp auf die Mitteilung: vorhandenes Fenster nach vorn holen, sonst oeffnen.
//
// Nennt die Mitteilung ein Ziel (der Falten-Wecker tut es), dann auch dorthin.
// Beim schon offenen Fenster per Nachricht statt client.navigate(): Letzteres ist
// in WebKit nicht verlaesslich – und genau dort laeuft die App.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ziel = event.notification.data?.url || '';
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenster) {
      if ('focus' in f) {
        if (ziel) f.postMessage({ typ: 'gehe-zu', url: ziel });
        return f.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(ziel ? `./${ziel}` : './');
    return undefined;
  })());
});
