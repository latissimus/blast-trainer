import { supabase } from './supabase.js';

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || '' } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Schickt den Zuruecksetzen-Link. Ziel ist die App selbst: Supabase haengt das
// Recovery-Token an die URL, der Client liest es (detectSessionInUrl) und meldet
// PASSWORD_RECOVERY – daraufhin zeigt main.js die Maske fuer das neue Passwort.
//
// Die Adresse muss in Supabase unter Auth -> URL Configuration als Redirect-URL
// erlaubt sein, sonst landet der Link auf der Site-URL.
export async function resetPassword(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Laedt (oder wartet auf) die Profilzeile des eingeloggten Nutzers.
// Der DB-Trigger legt sie bei der Registrierung an; kurz danach kann es
// eine Millisekunde dauern, daher ein kleiner Retry.
export async function loadProfile(userId) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}
