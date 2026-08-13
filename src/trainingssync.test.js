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
});
