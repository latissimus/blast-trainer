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
