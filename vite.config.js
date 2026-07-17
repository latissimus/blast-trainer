import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Version zur Bauzeit einbrennen. Zweck: Der Service Worker liefert die App aus
// dem Cache, beim ersten Oeffnen nach einem Push sieht man also noch den alten
// Stand. Ohne Anzeige raet man bei jedem Fehler, ob der Code oder der Cache
// schuld ist. Die Action baut mit Git-Historie, daher klappt rev-parse auch dort.
const commit = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch (e) { return 'lokal'; }
})();
const gebaut = new Date().toISOString().slice(0, 16).replace('T', ' ');

// Relative base so the build works both at a domain root and under a
// GitHub Pages project path (https://user.github.io/<repo>/).
// Routing is hash-based, so no SPA history fallback is required.
export default defineConfig({
  base: './',
  server: { port: 5173 },
  define: {
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_TIME__: JSON.stringify(gebaut),
  },
  plugins: [
    VitePWA({
      // injectManifest statt generateSW: Wir haben einen eigenen Service Worker
      // (Push-Behandlung). Ein generierter wuerde den ersetzen.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // Neue Version uebernimmt beim naechsten Start (sw.js macht skipWaiting).
      registerType: 'autoUpdate',
      // Wir registrieren selbst in push.js – dort haengt die Registrierung
      // ohnehin schon an der Benachrichtigungs-Logik.
      injectRegister: false,
      // manifest.webmanifest pflegen wir von Hand in public/.
      manifest: false,
      injectManifest: {
        // Nur App-Dateien. Nichts davon spricht mit Supabase.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});
