import { supabase } from './supabase.js';
import { readLog, writeLog, mergePayload } from './localstore.js';

// Der Server lehnt Uploads ab, die ein Log mit Eintraegen leeren oder mehr als
// die Haelfte der Saetze verlieren wuerden (Trigger training_logs_schutz).
export const istSchutzFehler = (error) =>
  String(error?.message || '').startsWith('LOGMAN_SCHUTZ');

export const TRAININGSSTAND_EREIGNIS = 'logman:trainingsstand';

// Serverstand nur mit echter Anmeldung lesen. Beim Start nutzt die App die
// lokal gespeicherte Sitzung sofort, waehrend Supabase sie im Hintergrund
// erneuert. In diesem Fenster gingen Anfragen anonym raus; die Datenbank
// blendete die Zeile per RLS aus und antwortete "keine Zeile" – und die App
// hielt ein volles Log fuer leer (Datenverlust am 29.09.2026). getSession()
// wartet die Erneuerung ab; stimmt der Nutzer danach nicht, gilt der
// Serverstand als unbekannt, nicht als leer.
export async function ladeServerTraining(userId) {
  const { data: auth } = await supabase.auth.getSession();
  if (auth?.session?.user?.id !== userId) {
    throw Object.assign(new Error('Keine gültige Anmeldung – Trainingsstand vom Server nicht geprüft.'),
      { name: 'KeineSitzung' });
  }
  const { data, error } = await supabase
    .from('training_logs').select('payload').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data?.payload || null;
}

// Server-Synchronisation fuer das Trainingslog.
//
// Lokal wird weiterhin vom jeweiligen Aufrufer SOFORT gespeichert. Diese
// Warteschlange ordnet nur die anschliessenden Server-Uploads. Dadurch kann ein
// langsamer alter Upload nie nach einem neueren fertig werden und dessen Stand
// auf dem Server wieder ueberschreiben.

const kopie = (payload) => {
  if (typeof structuredClone === 'function') return structuredClone(payload);
  return JSON.parse(JSON.stringify(payload));
};

export function createLatestTrainingQueue({
  upload,
  markClean,
  isOnline = () => true,
  timeoutMs = 8_000,
}) {
  let sequence = 0;
  let pending = null;
  let running = false;

  const status = (job, value) => {
    try { job?.onStatus?.(value); } catch (e) { /* Statusanzeige darf Sync nie stoppen. */ }
  };

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;

        if (!isOnline()) {
          status(job, 'offline');
          job.resolve({ status: 'offline' });
          continue;
        }

        status(job, 'saving');
        const controller = new AbortController();
        let timer = null;
        let uploadVersuch;
        try {
          uploadVersuch = upload(job.payload, controller.signal);
        } catch (error) {
          uploadVersuch = Promise.reject(error);
        }
        // Ein Upload darf statt des Fehlers auch { error, gesendet } liefern,
        // wenn er einen anderen Stand als den eingereihten hochgeladen hat
        // (nach dem Zusammenfuehren mit dem Server). Dann wird genau dieser
        // Stand als sauber markiert, nicht der urspruengliche.
        const uploadResultat = Promise.resolve(uploadVersuch)
          .then(
            (ergebnis) => (ergebnis && 'gesendet' in ergebnis ? ergebnis : { error: ergebnis }),
            (error) => ({ error }),
          );
        const zeitlimit = new Promise((resolve) => {
          timer = setTimeout(() => {
            const error = Object.assign(
              new Error('Training konnte wegen eines langsamen Netzwerks nicht synchronisiert werden.'),
              { name: 'TimeoutError' },
            );
            controller.abort(error);
            resolve({ error });
          }, timeoutMs);
        });
        const { error, gesendet } = await Promise.race([uploadResultat, zeitlimit]);
        clearTimeout(timer);

        if (error) {
          status(job, isOnline() ? 'error' : 'offline');
          job.resolve({ status: isOnline() ? 'error' : 'offline', error });
          // Ein neuerer Stand darf nach einem Netzfehler nicht sofort in
          // dieselbe kaputte Verbindung laufen. Er bleibt lokal dirty und wird
          // durch den Online-Listener oder den ruhigen Retry-Takt nachgeholt.
          if (pending) {
            status(pending, isOnline() ? 'error' : 'offline');
            pending.resolve({ status: isOnline() ? 'error' : 'offline', error });
            pending = null;
          }
          break;
        }

        // Kam waehrend dieses Uploads eine neuere Eingabe, ist der Serverstand
        // nur ein Zwischenstand. Lokal darf er deshalb noch nicht als sauber
        // markiert werden; die Schleife sendet direkt den neuesten Stand nach.
        if (job.sequence === sequence && !pending) {
          markClean(gesendet || job.payload);
          status(job, 'saved');
          job.resolve({ status: 'saved' });
        } else {
          job.resolve({ status: 'superseded' });
        }
      }
    } finally {
      running = false;
      // Ein Enqueue kann genau zwischen dem letzten Schleifentest und diesem
      // finally eintreffen. Dann noch einmal anlaufen lassen.
      if (pending) queueMicrotask(drain);
    }
  }

  function enqueue(payload, onStatus) {
    const sequenceForJob = ++sequence;
    return new Promise((resolve) => {
      if (pending) pending.resolve({ status: 'superseded' });
      pending = {
        sequence: sequenceForJob,
        payload: kopie(payload),
        onStatus,
        resolve,
      };
      drain();
    });
  }

  return { enqueue };
}

const queues = new Map();

function queueFor(userId) {
  if (queues.has(userId)) return queues.get(userId);
  const queue = createLatestTrainingQueue({
    isOnline: () => navigator.onLine,
    upload: async (payload, signal) => {
      const hochladen = async (stand) => {
        const { error } = await supabase.from('training_logs').upsert(
          { user_id: userId, payload: stand, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        ).abortSignal(signal);
        return error;
      };
      const error = await hochladen(payload);
      if (!istSchutzFehler(error)) return error;

      // Der Server kennt Saetze, die dieser Stand nicht mehr hat – typisch fuer
      // ein Geraet mit veraltetem oder leerem Spiegel. Nicht erneut draengeln,
      // sondern den Serverstand holen, blockweise zusammenfuehren und genau
      // den vereinigten Stand senden. Ein bewusster Phasenreset kommt hier nie
      // an, weil der Server ihn am neueren meta.phasenReset erkennt.
      const { data, error: ladeFehler } = await supabase
        .from('training_logs').select('payload').eq('user_id', userId)
        .maybeSingle().abortSignal(signal);
      if (ladeFehler || !data?.payload) return error;
      const vereinigt = mergePayload(data.payload, payload);
      writeLog(userId, vereinigt, true, false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(TRAININGSSTAND_EREIGNIS, { detail: { userId } }));
      }
      return { error: await hochladen(vereinigt), gesendet: vereinigt };
    },
    markClean: (payload) => writeLog(userId, payload, false, false),
  });
  queues.set(userId, queue);
  return queue;
}

export function synchronisiereTraining(userId, payload, onStatus) {
  return queueFor(userId).enqueue(payload, onStatus);
}

// iOS meldet den Online-Wechsel nicht immer, deshalb bleibt zusaetzlich der
// vorhandene Retry-Takt im Log bestehen. Wenn das Ereignis kommt, wird aber
// auch eine im Set-O-Meter offline vorgenommene Aenderung sofort nachgeholt.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    queues.forEach((queue, userId) => {
      const lokal = readLog(userId);
      if (lokal?.dirty && lokal.payload) queue.enqueue(lokal.payload);
    });
  });
}
