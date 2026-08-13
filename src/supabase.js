import { createClient } from '@supabase/supabase-js';

// Ein schwaches Mobilfunknetz meldet dem Browser oft weiterhin "online",
// obwohl Requests minutenlang keine Antwort liefern. Supabase bekommt deshalb
// zentral eine echte Obergrenze. Lokale Daten bleiben davon unberuehrt.
export const NETZWERK_TIMEOUT_MS = 8_000;

export async function fetchMitZeitlimit(input, init = {}) {
  const controller = new AbortController();
  const externesSignal = init.signal;
  const externAbbrechen = () => controller.abort(externesSignal?.reason);

  if (externesSignal?.aborted) externAbbrechen();
  else externesSignal?.addEventListener('abort', externAbbrechen, { once: true });

  const timer = setTimeout(() => {
    const fehler = typeof DOMException === 'function'
      ? new DOMException('Das Netzwerk antwortet zu langsam.', 'TimeoutError')
      : Object.assign(new Error('Das Netzwerk antwortet zu langsam.'), { name: 'TimeoutError' });
    controller.abort(fehler);
  }, NETZWERK_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externesSignal?.removeEventListener('abort', externAbbrechen);
  }
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Supabase-Konfiguration fehlt. Lege eine .env.local mit VITE_SUPABASE_URL ' +
    'und VITE_SUPABASE_ANON_KEY an (siehe .env.example).'
  );
}

export const supabase = createClient(url, key, {
  global: {
    fetch: fetchMitZeitlimit,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
