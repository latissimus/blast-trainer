import { describe, expect, it, vi } from 'vitest';
import { createLatestTrainingQueue } from './trainingssync.js';

const offen = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

describe('Trainings-Synchronisation', () => {
  it('versucht offline keinen Upload und markiert nichts als sauber', async () => {
    const upload = vi.fn();
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({
      upload,
      markClean,
      isOnline: () => false,
    });

    const result = await queue.enqueue({ v: 4, week: 1 });

    expect(result.status).toBe('offline');
    expect(upload).not.toHaveBeenCalled();
    expect(markClean).not.toHaveBeenCalled();
  });

  it('kann den neuesten lokalen Stand nach der Offlinephase nachholen', async () => {
    let online = false;
    const upload = vi.fn().mockResolvedValue(null);
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({
      upload,
      markClean,
      isOnline: () => online,
    });

    await expect(queue.enqueue({ v: 4, week: 1 })).resolves.toEqual({ status: 'offline' });
    online = true;
    await expect(queue.enqueue({ v: 4, week: 2 })).resolves.toEqual({ status: 'saved' });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].week).toBe(2);
    expect(markClean.mock.calls[0][0].week).toBe(2);
  });

  it('laesst nie zwei Uploads gleichzeitig laufen und sendet danach den neuesten Stand', async () => {
    const erster = offen();
    const zweiter = offen();
    const upload = vi.fn()
      .mockImplementationOnce(() => erster.promise)
      .mockImplementationOnce(() => zweiter.promise);
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({ upload, markClean });

    const a = queue.enqueue({ v: 4, week: 1 });
    const b = queue.enqueue({ v: 4, week: 2 });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].week).toBe(1);

    erster.resolve(null);
    await vi.waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(upload.mock.calls[1][0].week).toBe(2);
    expect(markClean).not.toHaveBeenCalled();

    zweiter.resolve(null);
    await expect(a).resolves.toEqual({ status: 'superseded' });
    await expect(b).resolves.toEqual({ status: 'saved' });
    expect(markClean).toHaveBeenCalledTimes(1);
    expect(markClean.mock.calls[0][0].week).toBe(2);
  });

  it('ueberspringt noch nicht gestartete Zwischenstaende', async () => {
    const erster = offen();
    const upload = vi.fn()
      .mockImplementationOnce(() => erster.promise)
      .mockResolvedValueOnce(null);
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({ upload, markClean });

    const a = queue.enqueue({ v: 4, week: 1 });
    const b = queue.enqueue({ v: 4, week: 2 });
    const c = queue.enqueue({ v: 4, week: 3 });

    await expect(b).resolves.toEqual({ status: 'superseded' });
    erster.resolve(null);
    await expect(a).resolves.toEqual({ status: 'superseded' });
    await expect(c).resolves.toEqual({ status: 'saved' });

    expect(upload.mock.calls.map(([p]) => p.week)).toEqual([1, 3]);
    expect(markClean.mock.calls[0][0].week).toBe(3);
  });

  it('behaelt bei einem Uploadfehler den lokalen Stand als dirty', async () => {
    const fehler = new Error('Netz weg');
    const upload = vi.fn().mockResolvedValue(fehler);
    const markClean = vi.fn();
    const statuses = [];
    const queue = createLatestTrainingQueue({ upload, markClean });

    const result = await queue.enqueue(
      { v: 4, week: 1 },
      (status) => statuses.push(status),
    );

    expect(result.status).toBe('error');
    expect(markClean).not.toHaveBeenCalled();
    expect(statuses).toEqual(['saving', 'error']);
  });

  it('gibt bei einer haengenden Verbindung nach dem Zeitlimit frei und bricht den Request ab', async () => {
    vi.useFakeTimers();
    const upload = vi.fn((_payload, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const markClean = vi.fn();
    const statuses = [];
    const queue = createLatestTrainingQueue({ upload, markClean, timeoutMs: 100 });

    const gespeichert = queue.enqueue({ v: 4, cycle: 2 }, (status) => statuses.push(status));
    await vi.advanceTimersByTimeAsync(101);
    const result = await gespeichert;

    expect(result.status).toBe('error');
    expect(result.error.name).toBe('TimeoutError');
    expect(upload.mock.calls[0][1].aborted).toBe(true);
    expect(markClean).not.toHaveBeenCalled();
    expect(statuses).toEqual(['saving', 'error']);
    vi.useRealTimers();
  });

  it('friert den Stand beim Einreihen ein', async () => {
    const erster = offen();
    const upload = vi.fn().mockImplementation(() => erster.promise);
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({ upload, markClean });
    const payload = { v: 4, week: 1, data: { wert: 'alt' } };

    const gespeichert = queue.enqueue(payload);
    payload.data.wert = 'neu';
    erster.resolve(null);
    await gespeichert;

    expect(upload.mock.calls[0][0].data.wert).toBe('alt');
    expect(markClean.mock.calls[0][0].data.wert).toBe('alt');
  });

  it('markiert nach einem Zusammenfuehren den tatsaechlich gesendeten Stand als sauber', async () => {
    const vereinigt = { v: 4, week: 2, data: { vom: 'server+lokal' } };
    const upload = vi.fn().mockResolvedValue({ error: null, gesendet: vereinigt });
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({ upload, markClean });

    const result = await queue.enqueue({ v: 4, week: 1, data: {} });

    expect(result.status).toBe('saved');
    expect(markClean).toHaveBeenCalledWith(vereinigt);
  });

  it('markiert nichts als sauber, wenn auch der zusammengefuehrte Upload scheitert', async () => {
    const upload = vi.fn().mockResolvedValue({ error: new Error('weg'), gesendet: { v: 4 } });
    const markClean = vi.fn();
    const queue = createLatestTrainingQueue({ upload, markClean });

    const result = await queue.enqueue({ v: 4, week: 1 });

    expect(result.status).toBe('error');
    expect(markClean).not.toHaveBeenCalled();
  });
});

describe('Schutzfehler des Servers', () => {
  it('erkennt die Ablehnung des Schutz-Triggers an der Meldung', async () => {
    const { istSchutzFehler } = await import('./trainingssync.js');
    expect(istSchutzFehler({ message: 'LOGMAN_SCHUTZ: Upload wuerde eingetragene Saetze entfernen' })).toBe(true);
    expect(istSchutzFehler({ message: 'new row violates row-level security policy' })).toBe(false);
    expect(istSchutzFehler(null)).toBe(false);
  });
});

describe('Speichern mit Versionspruefung', () => {
  const zusammenfuehren = (server, lokal) => ({ ...server, ...lokal, zusammen: true });

  it('speichert direkt, wenn die Basis aktuell ist', async () => {
    const { speichereVersioniert } = await import('./trainingssync.js');
    const speichern = vi.fn().mockResolvedValue({ data: { status: 'ok', version: 8 }, error: null });
    const ergebnis = await speichereVersioniert({
      payload: { week: 2 }, basis: 7, speichern, ladeServer: vi.fn(), zusammenfuehren,
    });
    expect(speichern).toHaveBeenCalledWith({ week: 2 }, 7);
    expect(ergebnis).toMatchObject({ error: null, version: 8, zusammengefuehrt: false });
  });

  it('fuehrt bei einem Konflikt mit dem Serverstand zusammen und sendet auf dessen Version', async () => {
    const { speichereVersioniert } = await import('./trainingssync.js');
    const speichern = vi.fn()
      .mockResolvedValueOnce({ data: { status: 'konflikt', version: 9, payload: { vomServer: 1 } }, error: null })
      .mockResolvedValueOnce({ data: { status: 'ok', version: 10 }, error: null });
    const ergebnis = await speichereVersioniert({
      payload: { week: 2 }, basis: 7, speichern, ladeServer: vi.fn(), zusammenfuehren,
    });
    expect(speichern.mock.calls[1]).toEqual([{ vomServer: 1, week: 2, zusammen: true }, 9]);
    expect(ergebnis).toMatchObject({ error: null, version: 10, basis: 9, zusammengefuehrt: true });
  });

  it('holt bei einer Ablehnung durch den Schutz den Serverstand und fuehrt zusammen', async () => {
    const { speichereVersioniert } = await import('./trainingssync.js');
    const speichern = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'LOGMAN_SCHUTZ: Upload wuerde eingetragene Saetze entfernen' } })
      .mockResolvedValueOnce({ data: { status: 'ok', version: 5 }, error: null });
    const ladeServer = vi.fn().mockResolvedValue({ payload: { saetze: 60 }, version: 4 });
    const ergebnis = await speichereVersioniert({
      payload: { leer: true }, basis: 4, speichern, ladeServer, zusammenfuehren,
    });
    expect(ladeServer).toHaveBeenCalledTimes(1);
    expect(speichern.mock.calls[1][0]).toMatchObject({ saetze: 60, leer: true });
    expect(ergebnis).toMatchObject({ error: null, version: 5, zusammengefuehrt: true });
  });

  it('gibt einen Netzfehler unveraendert zurueck, ohne zusammenzufuehren', async () => {
    const { speichereVersioniert } = await import('./trainingssync.js');
    const netz = new Error('Failed to fetch');
    const ergebnis = await speichereVersioniert({
      payload: { week: 1 }, basis: 3,
      speichern: vi.fn().mockResolvedValue({ data: null, error: netz }),
      ladeServer: vi.fn(), zusammenfuehren,
    });
    expect(ergebnis).toMatchObject({ error: netz, zusammengefuehrt: false });
  });

  it('bricht nach wiederholten Konflikten mit Fehler ab, behaelt aber den zusammengefuehrten Stand', async () => {
    const { speichereVersioniert } = await import('./trainingssync.js');
    const speichern = vi.fn().mockResolvedValue({ data: { status: 'konflikt', version: 2, payload: { s: 1 } }, error: null });
    const ergebnis = await speichereVersioniert({
      payload: { week: 1 }, basis: 1, speichern, ladeServer: vi.fn(), zusammenfuehren, maxVersuche: 3,
    });
    expect(speichern).toHaveBeenCalledTimes(3);
    expect(ergebnis.error).toBeInstanceOf(Error);
    expect(ergebnis).toMatchObject({ zusammengefuehrt: true, basis: 2 });
  });

  it('gibt der Warteschlange den beim Einreihen gueltigen Kontext mit', async () => {
    let epoche = 1;
    const upload = vi.fn().mockResolvedValue(null);
    const queue = createLatestTrainingQueue({ upload, markClean: vi.fn(), holeKontext: () => epoche });
    const gespeichert = queue.enqueue({ v: 4 });
    epoche = 2;
    await gespeichert;
    expect(upload.mock.calls[0][2]).toBe(1);
  });
});
