// Minimaler Service Worker – ausschliesslich fuer Benachrichtigungen.
//
// BEWUSST OHNE fetch-Handler. Das ist der entscheidende Punkt: Die gefaehrliche
// Haelfte eines Service Workers ist das Caching. Ein Worker, der Anfragen
// abfaengt, kann einen kaputten Build festhalten, den man nicht mehr per Push
// repariert. Ohne fetch-Handler greift er gar nicht ins Ausliefern ein – die App
// laedt weiter ganz normal aus dem Netz.
//
// Das Caching (Offline Stufe 2) kommt spaeter und getrennt.

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
    }),
  );
});

// Tipp auf die Mitteilung: vorhandenes Fenster nach vorn holen, sonst oeffnen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenster) => {
      for (const f of fenster) if ('focus' in f) return f.focus();
      if (self.clients.openWindow) return self.clients.openWindow('./');
      return undefined;
    }),
  );
});
