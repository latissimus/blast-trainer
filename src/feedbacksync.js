import { supabase } from './supabase.js';

const SPEICHER_PREFIX = 'blast:feedback-ausgang:';

const kopie = (wert) => JSON.parse(JSON.stringify(wert));

// Reiner, testbarer Ausgang: Lokal vormerken, der Reihe nach senden und bei
// Fehlern nichts verlieren. Der konkrete Browser-/Supabase-Teil folgt darunter.
export function createFeedbackAusgang({ lesen, schreiben, senden, istOnline = () => true }) {
  let laufend = null;

  const wartend = () => lesen().length;

  const vormerken = (eintrag) => {
    const liste = lesen();
    liste.push(kopie(eintrag));
    schreiben(liste);
    return eintrag;
  };

  const synchronisieren = () => {
    if (laufend) return laufend;
    laufend = (async () => {
      let liste = lesen();
      if (!liste.length) return { status: 'leer', wartend: 0 };
      if (!istOnline()) return { status: 'offline', wartend: liste.length };

      while (liste.length) {
        try {
          await senden(liste[0]);
        } catch (error) {
          return { status: istOnline() ? 'fehler' : 'offline', wartend: liste.length, error };
        }
        liste = liste.slice(1);
        schreiben(liste);
      }
      return { status: 'gesendet', wartend: 0 };
    })().finally(() => { laufend = null; });
    return laufend;
  };

  return { vormerken, synchronisieren, wartend };
}

const ausgaenge = new Map();

function browserAusgang(userId) {
  if (ausgaenge.has(userId)) return ausgaenge.get(userId);
  const key = SPEICHER_PREFIX + userId;
  const lesen = () => {
    try {
      const wert = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(wert) ? wert : [];
    } catch (e) {
      return [];
    }
  };
  const schreiben = (liste) => {
    try {
      if (liste.length) localStorage.setItem(key, JSON.stringify(liste));
      else localStorage.removeItem(key);
    } catch (e) { /* Der direkte Versand bleibt weiterhin moeglich. */ }
  };
  const senden = async (eintrag) => {
    // Falls der Server den ersten Versuch gespeichert, die Antwort aber das
    // Geraet nie erreicht hat, verhindert diese Marke ein doppeltes Feedback.
    const { data: vorhanden, error: pruefFehler } = await supabase
      .from('feedback')
      .select('id')
      .eq('user_id', userId)
      .eq('kategorie', eintrag.kategorie)
      .eq('nachricht', eintrag.nachricht)
      .eq('created_at', eintrag.createdAt)
      .maybeSingle();
    if (pruefFehler) throw pruefFehler;
    if (vorhanden) return;

    const { error } = await supabase.from('feedback').insert({
      user_id: userId,
      kategorie: eintrag.kategorie,
      nachricht: eintrag.nachricht,
      created_at: eintrag.createdAt,
    });
    if (error) throw error;
  };
  const ausgang = createFeedbackAusgang({
    lesen,
    schreiben,
    senden,
    istOnline: () => navigator.onLine,
  });
  ausgaenge.set(userId, ausgang);
  return ausgang;
}

export function feedbackVormerken(userId, { kategorie, nachricht }) {
  const token = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return browserAusgang(userId).vormerken({
    token,
    kategorie,
    nachricht,
    createdAt: new Date().toISOString(),
  });
}

export const feedbackSynchronisieren = (userId) => browserAusgang(userId).synchronisieren();
export const feedbackWartend = (userId) => browserAusgang(userId).wartend();
