import { defineConfig } from 'vite';

// Relative base so the build works both at a domain root and under a
// GitHub Pages project path (https://user.github.io/<repo>/).
// Routing is hash-based, so no SPA history fallback is required.
export default defineConfig({
  base: './',
  server: { port: 5173 },
});
